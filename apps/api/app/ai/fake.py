import hashlib
import re
import unicodedata

from app.core.enums import Route, UncertaintyType
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
        if applicable_exceptions and any(token in lowered for token in ("6", "sáu", "thành viên")):
            exception = applicable_exceptions[0]
            return RefereeDecision(
                route=Route.ANSWER,
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
                uncertainty_type=UncertaintyType.MISSING_FACT,
                reason_code="MISSING_CONCRETE_FACT",
                clarifying_question="Bạn đang hỏi về nhóm và học kỳ cụ thể nào?",
                confidence=1,
            )
        if evidence:
            return RefereeDecision(
                route=Route.ANSWER,
                uncertainty_type=UncertaintyType.NONE,
                reason_code="POLICY_GROUNDED_EXTRACTIVE_ANSWER",
                answer=self._extractive_answer(question, evidence),
                citation_labels=[evidence[0]["label"]],
                confidence=1,
            )
        return RefereeDecision(
            route=Route.ESCALATE,
            uncertainty_type=UncertaintyType.OUT_OF_POLICY,
            reason_code="INSUFFICIENT_EVIDENCE",
            decision_question="Giảng viên có thể cung cấp quy định áp dụng cho yêu cầu này không?",
            confidence=0,
        )

    async def health(self) -> AIHealth:
        return AIHealth(mode="fake", available=True, model="deterministic-fake-v1")
