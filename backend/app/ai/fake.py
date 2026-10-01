import hashlib
import re
import unicodedata

from app.core.enums import EscalationTarget, PolicyCoverage, Route, UncertaintyType
from app.schemas.referee import AIHealth, RefereeDecision


class FakeProvider:
    """Deterministic provider for tests and local workflow development."""

    @staticmethod
    def _extractive_answer(question: str, evidence: list[dict]) -> str:
        """Return a short, grounded local-development answer without pretending to summarize."""
        content = str(evidence[0]["content"]).strip()
        lowered_question = question.casefold()
        rubric_tokens = ("điểm", "rubric", "tỷ lệ", "phần trăm", "tiêu chí", "chấm")
        if any(token in lowered_question for token in rubric_tokens):
            percentages = re.findall(r"[●•]\s*([^●•\n]{1,100}?\d+\s*%)", content)
            if percentages:
                items = "; ".join(" ".join(item.split()) for item in percentages[:6])
                return f"Theo rubric: {items}."

            match = re.search(r"[^.]{0,420}\d+\s*%[^.]{0,420}", content)
            if match:
                return f"Theo rubric: {' '.join(match.group(0).split())}."

        if any(token in lowered_question for token in ("mốc", "lịch", "tiến độ")):
            dated_items = re.findall(
                r"(\d{2}/\d{2}/\d{4})(.*?)(?=\d{2}/\d{2}/\d{4}|$)",
                content,
                flags=re.DOTALL,
            )
            if dated_items:
                milestones = []
                for item_date, detail in dated_items:
                    summary = " ".join(detail.split())[:115].rstrip(" -")
                    if len(summary) >= 25 and re.search(r"[a-zA-ZÀ-ỹ]", summary):
                        milestones.append(f"{item_date}: {summary}")
                    if len(milestones) == 4:
                        break
                if milestones:
                    return "Các mốc được trích xuất từ kế hoạch:\n• " + "\n• ".join(milestones)

        question_words = {
            word
            for word in re.findall(r"\w+", lowered_question, flags=re.UNICODE)
            if len(word) > 2
            and word
            not in {"các", "cần", "những", "theo", "được", "là", "gì", "nào", "cho"}
        }
        segments = [
            " ".join(segment.split())
            for segment in re.split(r"[●•○]+", content)
            if segment.strip()
        ]
        scored_segments = [
            (
                sum(word in segment.casefold() for word in question_words),
                segment,
            )
            for segment in segments
        ]
        if scored_segments:
            score, segment = max(scored_segments, key=lambda item: item[0])
            if score >= 2:
                concise = segment[:460].rstrip()
                suffix = "…" if len(segment) > len(concise) else ""
                return f"Theo tài liệu được truy xuất: {concise}{suffix}"

        sentences = re.split(r"(?<=[.!?])\s+", content)
        first_sentence = next((item.strip() for item in sentences if item.strip()), content)
        concise = " ".join(first_sentence.split())[:420].rstrip()
        suffix = "…" if len(first_sentence) > len(concise) else ""
        return f"Theo tài liệu được truy xuất: {concise}{suffix}"

    async def embed(
        self,
        texts: list[str],
        *,
        task_type: str = "RETRIEVAL_DOCUMENT",
    ) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            normalized = unicodedata.normalize("NFKC", text).casefold()
            tokens = re.findall(r"\w+", normalized, flags=re.UNICODE)
            vector = [0.0] * 768
            for token in tokens:
                digest = hashlib.sha256(token.encode("utf-8")).digest()
                index = int.from_bytes(digest[:4], "big") % 768
                vector[index] += 1.0
            vectors.append(vector)
        return vectors

    async def decide(
        self,
        question: str,
        actor_context: dict,
        evidence: list[dict],
        applicable_exceptions: list[dict],
    ) -> RefereeDecision:
        lowered = question.casefold()
        question_tokens = {
            token for token in re.findall(r"\w+", lowered, flags=re.UNICODE) if len(token) > 2
        }
        relevant_exceptions = [
            item
            for item in applicable_exceptions
            if len(
                question_tokens
                & {
                    token
                    for token in re.findall(
                        r"\w+", str(item.get("content", "")).casefold(), flags=re.UNICODE
                    )
                    if len(token) > 2
                }
            )
            >= 2
        ]
        if relevant_exceptions:
            exception = relevant_exceptions[0]
            return RefereeDecision(
                route=Route.ANSWER,
                policy_coverage=PolicyCoverage.APPLICABLE_EXCEPTION,
                policy_topic=self._policy_topic(question),
                uncertainty_type=UncertaintyType.NONE,
                reason_code="APPLICABLE_SCOPED_EXCEPTION",
                answer=(
                    "Theo ngoại lệ đang có hiệu lực cho phạm vi của bạn: "
                    f"{exception['content']}"
                ),
                citation_labels=[evidence[0]["label"]],
                confidence=1,
            )
        if any(token in lowered for token in ("thiếu thông tin", "chưa rõ môn", "nhóm nào")):
            return RefereeDecision(
                route=Route.CLARIFY,
                policy_coverage=PolicyCoverage.MISSING_FACT,
                policy_topic="GENERAL",
                uncertainty_type=UncertaintyType.MISSING_FACT,
                reason_code="MISSING_CONCRETE_FACT",
                clarifying_question="Bạn đang hỏi về nhóm và học kỳ cụ thể nào?",
                confidence=1,
            )
        if any(token in lowered for token in ("trường hợp này", "việc đó", "cái này")):
            return RefereeDecision(
                route=Route.CLARIFY,
                policy_coverage=PolicyCoverage.MISSING_FACT,
                policy_topic="GENERAL",
                uncertainty_type=UncertaintyType.MISSING_FACT,
                reason_code="MISSING_CONCRETE_FACT",
                clarifying_question="Bạn có thể nêu rõ tình huống hoặc quy định đang hỏi không?",
                confidence=1,
            )
        if evidence:
            evidence_text = " ".join(str(item.get("content", "")) for item in evidence).casefold()
            requests_decision = any(
                token in lowered
                for token in (
                    "xin phép",
                    "xin ngoại lệ",
                    "muốn phúc khảo",
                    "muốn đổi điểm",
                    "cho nhóm em",
                    "cho em",
                )
            )
            policy_requires_approval = any(
                token in evidence_text
                for token in (
                    "phải được giảng viên",
                    "phải được chuyển cho giảng viên",
                    "chỉ được chấp nhận khi có quyết định",
                )
            )
            exceeds_group_limit = bool(
                re.search(r"\b(?:6|sáu|7|bảy|8|tám|9|chín|10|mười)\b", lowered)
                and "thành viên" in lowered
                and "3 đến 5" in evidence_text
            )
            requests_late_waiver = "nộp" in lowered and "trễ" in lowered and "ngoại lệ" in lowered
            if (
                requests_decision and (policy_requires_approval or requests_late_waiver)
            ) or exceeds_group_limit:
                coverage = (
                    PolicyCoverage.REQUIRES_APPROVAL
                    if policy_requires_approval
                    else PolicyCoverage.REQUESTS_WAIVER
                )
                topic = self._policy_topic(question)
                if topic == "GRADE_APPEAL" or "đổi điểm" in lowered:
                    target = EscalationTarget.ACADEMIC_AFFAIRS
                    decision_question = (
                        "Phòng Đào tạo xác nhận có tiếp nhận hồ sơ phúc khảo / xem xét lại điểm này không?"
                    )
                else:
                    target = EscalationTarget.COURSE_LECTURER
                    decision_question = (
                        "Giảng viên có phê duyệt yêu cầu vượt ngoài quy định hiện hành không?"
                    )
                return RefereeDecision(
                    route=Route.ESCALATE,
                    policy_coverage=coverage,
                    policy_topic=topic,
                    uncertainty_type=UncertaintyType.AUTHORITY_REQUIRED,
                    reason_code=coverage.value,
                    escalation_target=target,
                    decision_question=decision_question,
                    confidence=1,
                )
            return RefereeDecision(
                route=Route.ANSWER,
                policy_coverage=PolicyCoverage.DIRECT,
                policy_topic=self._policy_topic(question),
                uncertainty_type=UncertaintyType.NONE,
                reason_code="POLICY_GROUNDED_EXTRACTIVE_ANSWER",
                answer=self._extractive_answer(question, evidence),
                citation_labels=[evidence[0]["label"]],
                confidence=1,
            )
        topic = self._policy_topic(question)
        return RefereeDecision(
            route=Route.ESCALATE,
            policy_coverage=PolicyCoverage.NO_POLICY,
            policy_topic=topic,
            uncertainty_type=UncertaintyType.OUT_OF_POLICY,
            reason_code="INSUFFICIENT_EVIDENCE",
            escalation_target=EscalationTarget.ACADEMIC_AFFAIRS,
            decision_question="Phòng Đào tạo / Bộ phận liên quan có tiếp nhận giải đáp thông tin này không?",
            confidence=0,
        )

    @staticmethod
    def _policy_topic(question: str) -> str:
        lowered = question.casefold()
        if "ai" in lowered or "trí tuệ nhân tạo" in lowered:
            return "AI_USAGE"
        if "thành viên" in lowered or "nhóm" in lowered:
            return "GROUP_MEMBERSHIP"
        if "điểm" in lowered or "phúc khảo" in lowered:
            return "GRADE_APPEAL"
        if "nộp" in lowered or "hạn" in lowered:
            return "SUBMISSION_DEADLINE"
        if "ký túc xá" in lowered or "xe" in lowered or "phí" in lowered:
            return "CAMPUS_LIFE"
        return "GENERAL"

    async def health(self) -> AIHealth:
        return AIHealth(mode="fake", available=True, model="deterministic-fake-v1")
