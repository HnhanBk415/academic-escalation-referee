import hashlib
import re
import unicodedata
from typing import Any

from app.core.enums import EscalationTarget, PolicyCoverage, Route, UncertaintyType
from app.core.policy_topics import (
    canonical_policy_topic,
    infer_policy_topic,
    policy_topics_in_text,
)
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
        topic = infer_policy_topic(question)
        relevant_exceptions = [
            item
            for item in applicable_exceptions
            if canonical_policy_topic(str(item.get("policy_topic", "GENERAL"))) == topic
        ]
        if relevant_exceptions:
            exception = relevant_exceptions[0]
            return RefereeDecision(
                route=Route.ANSWER,
                policy_coverage=PolicyCoverage.APPLICABLE_EXCEPTION,
                policy_topic=topic,
                uncertainty_type=UncertaintyType.NONE,
                reason_code="APPLICABLE_SCOPED_EXCEPTION",
                answer=(
                    "Theo ngoại lệ đang có hiệu lực cho phạm vi của bạn: "
                    f"{exception['content']}"
                ),
                citation_labels=[evidence[0]["label"]] if evidence else [],
                confidence=1,
                applied_exception_id=str(exception["id"]),
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
            evidence_topics = policy_topics_in_text(evidence_text)
            requests_decision = any(
                token in lowered
                for token in (
                    "xin phép",
                    "xin ngoại lệ",
                    "xin gia hạn",
                    "xin miễn",
                    "muốn phúc khảo",
                    "muốn đổi điểm",
                    "phúc khảo",
                    "đổi điểm",
                    "xem xét lại điểm",
                    "cho nhóm em",
                    "cho team em",
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
                and topic == "GROUP_MEMBERSHIP"
                and "3 đến 5" in evidence_text
            )
            if requests_decision or exceeds_group_limit:
                coverage = (
                    PolicyCoverage.REQUIRES_APPROVAL
                    if policy_requires_approval
                    else PolicyCoverage.REQUESTS_WAIVER
                )
                topic = self._policy_topic(question)
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
            if topic != "GENERAL" and topic not in evidence_topics:
                return self._no_policy_decision(topic)
            return RefereeDecision(
                route=Route.ANSWER,
                policy_coverage=PolicyCoverage.DIRECT,
                policy_topic=topic,
                uncertainty_type=UncertaintyType.NONE,
                reason_code="POLICY_GROUNDED_EXTRACTIVE_ANSWER",
                answer=self._extractive_answer(question, evidence),
                citation_labels=[evidence[0]["label"]],
                confidence=1,
            )
        return self._no_policy_decision(topic)

    @staticmethod
    def _no_policy_decision(topic: str) -> RefereeDecision:
        return RefereeDecision(
            route=Route.ESCALATE,
            policy_coverage=PolicyCoverage.NO_POLICY,
            policy_topic=topic,
            uncertainty_type=UncertaintyType.OUT_OF_POLICY,
            reason_code="NO_POLICY_MATCH",
            escalation_target=EscalationTarget.COURSE_LECTURER,
            decision_question=(
                "Giảng viên có thể xem xét và quyết định yêu cầu này theo phạm vi môn học không?"
            ),
            confidence=0,
        )

    @staticmethod
    def _policy_topic(question: str) -> str:
        return infer_policy_topic(question)

    async def judge_format_ambiguity(
        self,
        rule_type: str,
        expected_items: list[str],
        actual_items: list[str],
        criterion_name: str,
        source_citation: str,
    ) -> "FormatSemanticJudgment":
        """Deterministic stub: pass when every expected item has enough shared tokens."""
        from app.schemas.format_checks import FormatSemanticJudgment

        SYNONYM_SETS = [
            {"khái niệm", "mở đầu", "giới thiệu", "tổng quan", "đặt vấn đề", "giới thiệu tổng quan"},
            {"hiện thực", "cài đặt", "thiết kế và cài đặt", "triển khai", "thực nghiệm"},
            {"đánh giá và kết luận", "kết luận và hướng phát triển", "kết luận", "tổng kết"},
            {"mô tả đồ án", "mô tả bài toán", "tổng quan đề tài", "giới thiệu đề tài"},
            {"tại sao cần", "lý do chọn đề tài", "tính cấp thiết"},
            {"thiết kế hệ thống", "kiến trúc hệ thống"},
            {"cài đặt và thử nghiệm", "hiện thực và kiểm thử"},
            {"kết quả đạt được", "kết quả thực nghiệm"},
            {"hướng phát triển", "hướng nghiên cứu tiếp theo"},
        ]

        def _clean(t: str) -> str:
            t_norm = unicodedata.normalize("NFC", t.lower())
            return re.sub(r"^(?:chương\s+\d+[:\.\s–-]+|\d+(?:\.\d+)*\s*[:\.\)]?\s*|[a-z0-9]\)\s*)", "", t_norm).strip()

        def _normalize(text: str) -> set[str]:
            text = unicodedata.normalize("NFC", text.lower())
            return {w for w in re.findall(r"\w+", text) if len(w) > 1}

        has_ambiguous = False
        for expected in expected_items:
            exp_clean = _clean(expected)
            exp_tokens = _normalize(expected)
            has_exact = any(exp_tokens == _normalize(actual) for actual in actual_items)
            if has_exact:
                continue

            # Check academic synonym clusters
            is_synonym = False
            for s_set in SYNONYM_SETS:
                if exp_clean in s_set and any(_clean(act) in s_set for act in actual_items):
                    is_synonym = True
                    break
            if is_synonym:
                continue

            has_some = any(bool(exp_tokens & _normalize(actual)) for actual in actual_items)
            if has_some:
                has_ambiguous = True
            else:
                return FormatSemanticJudgment(
                    verdict="FAIL",
                    reason=f"[Fake AI] Không tìm thấy đề mục tương đương với '{expected}'.",
                )

        if has_ambiguous:
            return FormatSemanticJudgment(
                verdict="AMBIGUOUS",
                reason="[Fake AI] Có đề mục tương tự nhưng cần giảng viên phán đoán cụ thể.",
            )
        return FormatSemanticJudgment(
            verdict="PASS",
            reason="[Fake AI] AI xác nhận tương đương ngữ nghĩa theo ngữ cảnh học thuật.",
        )

    async def judge_cover_page(
        self,
        first_page_text: str,
        required_elements: list[str],
    ) -> "CoverPageJudgment":
        """Deterministic cover page judgment for tests and local development."""
        from app.schemas.format_checks import CoverPageJudgment

        norm = unicodedata.normalize("NFC", first_page_text.lower())
        detected: list[str] = []
        for req in required_elements:
            req_norm = unicodedata.normalize("NFC", req.lower())
            words = [w for w in re.findall(r"\w+", req_norm) if len(w) > 1]
            if ("đề tài" in req_norm or "tiêu đề" in req_norm or "tên báo cáo" in req_norm) and any(t in norm for t in ("đồ án", "báo cáo", "luận văn", "đề tài", "tiêu đề")):
                detected.append(req)
            elif words and any(w in norm for w in words):
                detected.append(req)

        # Basic check for presence of academic structure on page 1
        has_academic_indicators = any(
            token in norm
            for token in ("trường", "đại học", "khoa", "báo cáo", "đồ án", "luận văn", "gvhd", "hướng dẫn", "sinh viên", "mssv", "học kỳ", "năm")
        )
        is_cover = len(first_page_text.strip()) > 30 and (has_academic_indicators or len(detected) >= 2)
        missing = [r for r in required_elements if r not in detected]

        if is_cover and not missing:
            reason = "[Fake AI] Trang bìa hợp lệ, đầy đủ các trường thông tin theo yêu cầu."
        elif is_cover:
            reason = f"[Fake AI] Đã nhận diện trang bìa nhưng còn thiếu: {', '.join(missing)}."
        else:
            reason = "[Fake AI] Trang đầu tiên không chứa cấu trúc trang bìa hợp lệ."

        return CoverPageJudgment(
            is_cover_page=is_cover,
            detected_elements=detected,
            missing_elements=missing,
            reason=reason,
        )

    async def extract_regulation_criteria(
        self,
        regulation_text: str,
        allow_semantic_equivalent: bool = True,
    ) -> list["FormatCriterionInput"]:
        """Deterministic criteria extractor for tests and local development."""
        from app.core.enums import FormatCriterionRuleType
        from app.schemas.format_checks import FormatCriterionInput

        doc_id = "format-guidelines-v1"
        return [
            FormatCriterionInput(
                name="1. Khổ giấy và thiết lập căn lề",
                description="Khổ giấy A4 tiêu chuẩn (210x297mm); Căn lề: top: 2.5cm, bottom: 2.5cm, left: 3.0cm, right: 2.0cm, hướng giấy dọc (Portrait).",
                rule_type=FormatCriterionRuleType.MEASUREMENT,
                expected_value={
                    "property": "margins_cm",
                    "value": {"top": 2.5, "bottom": 2.5, "left": 3.0, "right": 2.0},
                    "paper_size": "A4",
                    "orientation": "PORTRAIT",
                    "tolerance": 0.15,
                    "category": "1. Khổ giấy và thiết lập trang",
                },
                source_citation="Khổ giấy tiêu chuẩn A4... Lề trên: 2.5 cm, Lề dưới: 2.5 cm...",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="2. Phông chữ và cỡ chữ nội dung",
                description="Phông chữ Times New Roman, cỡ chữ thân bài 13.0 pt.",
                rule_type=FormatCriterionRuleType.MEASUREMENT,
                expected_value={
                    "property": "font_name",
                    "value": "Times New Roman",
                    "font_size_pt": 13.0,
                    "tolerance": 0.5,
                    "category": "2. Font chữ và cỡ chữ",
                },
                source_citation="Sử dụng font Unicode chuẩn Times New Roman... Thân bài 13 pt",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="3. Định dạng đoạn văn và giãn dòng",
                description="Khoảng cách dòng 1.3 lines; Nội dung chính căn đều hai bên (Justify).",
                rule_type=FormatCriterionRuleType.MEASUREMENT,
                expected_value={
                    "property": "line_spacing",
                    "value": 1.3,
                    "justify": True,
                    "tolerance": 0.15,
                    "category": "3. Định dạng đoạn văn",
                },
                source_citation="Khoảng cách dòng (Line Spacing): 1.3 đến 1.5 lines.",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="4.1 Mục bắt buộc: Chương 1: Khái niệm",
                description=f"Yêu cầu có Chương 1: Khái niệm (cấp độ 1, chương thứ 1). {'Cho phép tên tương đương ngữ nghĩa.' if allow_semantic_equivalent else 'Bắt buộc tên chính xác 100%.'}",
                rule_type=FormatCriterionRuleType.TEMPLATE,
                expected_value={
                    "kind": "template_chapter",
                    "chapter_name": "Chương 1: Khái niệm",
                    "chapter_number": 1,
                    "level": 1,
                    "order_index": 1,
                    "required_subheadings": ["1) Mô tả đồ án", "2) Tại sao cần"],
                    "allow_semantic_equivalent": allow_semantic_equivalent,
                    "category": "4. Heading / tiêu đề chương, mục",
                },
                source_citation="Chương 1: Khái niệm",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="4.1.1 Mục con: 1) Mô tả đồ án",
                description=f"Mục con '1) Mô tả đồ án' thuộc Chương 1: Khái niệm (cấp độ 2). {'Cho phép tên tương đương ngữ nghĩa.' if allow_semantic_equivalent else 'Bắt buộc tên chính xác 100%.'}",
                rule_type=FormatCriterionRuleType.TEMPLATE,
                expected_value={
                    "kind": "template_section",
                    "section_name": "1) Mô tả đồ án",
                    "parent_chapter": "Chương 1: Khái niệm",
                    "chapter_number": 1,
                    "sub_index": 1,
                    "level": 2,
                    "order_index": 1.1,
                    "allow_semantic_equivalent": allow_semantic_equivalent,
                    "category": "4. Heading / tiêu đề chương, mục",
                },
                source_citation="Chương 1: Khái niệm",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="4.1.2 Mục con: 2) Tại sao cần",
                description=f"Mục con '2) Tại sao cần' thuộc Chương 1: Khái niệm (cấp độ 2). {'Cho phép tên tương đương ngữ nghĩa.' if allow_semantic_equivalent else 'Bắt buộc tên chính xác 100%.'}",
                rule_type=FormatCriterionRuleType.TEMPLATE,
                expected_value={
                    "kind": "template_section",
                    "section_name": "2) Tại sao cần",
                    "parent_chapter": "Chương 1: Khái niệm",
                    "chapter_number": 1,
                    "sub_index": 2,
                    "level": 2,
                    "order_index": 1.2,
                    "allow_semantic_equivalent": allow_semantic_equivalent,
                    "category": "4. Heading / tiêu đề chương, mục",
                },
                source_citation="Chương 1: Khái niệm",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="4.2 Mục bắt buộc: Chương 2: Hiện thực",
                description=f"Yêu cầu có Chương 2: Hiện thực (cấp độ 1, chương thứ 2). {'Cho phép tên tương đương ngữ nghĩa.' if allow_semantic_equivalent else 'Bắt buộc tên chính xác 100%.'}",
                rule_type=FormatCriterionRuleType.TEMPLATE,
                expected_value={
                    "kind": "template_chapter",
                    "chapter_name": "Chương 2: Hiện thực",
                    "chapter_number": 2,
                    "level": 1,
                    "order_index": 2,
                    "required_subheadings": ["1) Thiết kế hệ thống", "2) Cài đặt và thử nghiệm"],
                    "allow_semantic_equivalent": allow_semantic_equivalent,
                    "category": "4. Heading / tiêu đề chương, mục",
                },
                source_citation="Chương 2: Hiện thực",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="4.2.1 Mục con: 1) Thiết kế hệ thống",
                description=f"Mục con '1) Thiết kế hệ thống' thuộc Chương 2: Hiện thực (cấp độ 2). {'Cho phép tên tương đương ngữ nghĩa.' if allow_semantic_equivalent else 'Bắt buộc tên chính xác 100%.'}",
                rule_type=FormatCriterionRuleType.TEMPLATE,
                expected_value={
                    "kind": "template_section",
                    "section_name": "1) Thiết kế hệ thống",
                    "parent_chapter": "Chương 2: Hiện thực",
                    "chapter_number": 2,
                    "sub_index": 1,
                    "level": 2,
                    "order_index": 2.1,
                    "allow_semantic_equivalent": allow_semantic_equivalent,
                    "category": "4. Heading / tiêu đề chương, mục",
                },
                source_citation="Chương 2: Hiện thực",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="4.2.2 Mục con: 2) Cài đặt và thử nghiệm",
                description=f"Mục con '2) Cài đặt và thử nghiệm' thuộc Chương 2: Hiện thực (cấp độ 2). {'Cho phép tên tương đương ngữ nghĩa.' if allow_semantic_equivalent else 'Bắt buộc tên chính xác 100%.'}",
                rule_type=FormatCriterionRuleType.TEMPLATE,
                expected_value={
                    "kind": "template_section",
                    "section_name": "2) Cài đặt và thử nghiệm",
                    "parent_chapter": "Chương 2: Hiện thực",
                    "chapter_number": 2,
                    "sub_index": 2,
                    "level": 2,
                    "order_index": 2.2,
                    "allow_semantic_equivalent": allow_semantic_equivalent,
                    "category": "4. Heading / tiêu đề chương, mục",
                },
                source_citation="Chương 2: Hiện thực",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="4.3 Mục bắt buộc: Chương 3: Đánh giá và Kết luận",
                description=f"Yêu cầu có Chương 3: Đánh giá và Kết luận (cấp độ 1, chương thứ 3). {'Cho phép tên tương đương ngữ nghĩa.' if allow_semantic_equivalent else 'Bắt buộc tên chính xác 100%.'}",
                rule_type=FormatCriterionRuleType.TEMPLATE,
                expected_value={
                    "kind": "template_chapter",
                    "chapter_name": "Chương 3: Đánh giá và Kết luận",
                    "chapter_number": 3,
                    "level": 1,
                    "order_index": 3,
                    "required_subheadings": ["1) Kết quả đạt được", "2) Hướng phát triển"],
                    "allow_semantic_equivalent": allow_semantic_equivalent,
                    "category": "4. Heading / tiêu đề chương, mục",
                },
                source_citation="Chương 3: Đánh giá và Kết luận",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="4.3.1 Mục con: 1) Kết quả đạt được",
                description=f"Mục con '1) Kết quả đạt được' thuộc Chương 3: Đánh giá và Kết luận (cấp độ 2). {'Cho phép tên tương đương ngữ nghĩa.' if allow_semantic_equivalent else 'Bắt buộc tên chính xác 100%.'}",
                rule_type=FormatCriterionRuleType.TEMPLATE,
                expected_value={
                    "kind": "template_section",
                    "section_name": "1) Kết quả đạt được",
                    "parent_chapter": "Chương 3: Đánh giá và Kết luận",
                    "chapter_number": 3,
                    "sub_index": 1,
                    "level": 2,
                    "order_index": 3.1,
                    "allow_semantic_equivalent": allow_semantic_equivalent,
                    "category": "4. Heading / tiêu đề chương, mục",
                },
                source_citation="Chương 3: Đánh giá và Kết luận",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="4.3.2 Mục con: 2) Hướng phát triển",
                description=f"Mục con '2) Hướng phát triển' thuộc Chương 3: Đánh giá và Kết luận (cấp độ 2). {'Cho phép tên tương đương ngữ nghĩa.' if allow_semantic_equivalent else 'Bắt buộc tên chính xác 100%.'}",
                rule_type=FormatCriterionRuleType.TEMPLATE,
                expected_value={
                    "kind": "template_section",
                    "section_name": "2) Hướng phát triển",
                    "parent_chapter": "Chương 3: Đánh giá và Kết luận",
                    "chapter_number": 3,
                    "sub_index": 2,
                    "level": 2,
                    "order_index": 3.2,
                    "allow_semantic_equivalent": allow_semantic_equivalent,
                    "category": "4. Heading / tiêu đề chương, mục",
                },
                source_citation="Chương 3: Đánh giá và Kết luận",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="5. Thứ tự và phân cấp cấu trúc đề mục (Toàn văn)",
                description=f"Kiểm tra tuần tự và phân cấp cấu trúc toàn bài. {'Cho phép tương đương ngữ nghĩa.' if allow_semantic_equivalent else 'Bắt buộc chính xác 100%.'}",
                rule_type=FormatCriterionRuleType.TEMPLATE,
                expected_value={
                    "kind": "template_sequence",
                    "chapters": [
                        "Chương 1: Khái niệm",
                        "Chương 2: Hiện thực",
                        "Chương 3: Đánh giá và Kết luận",
                    ],
                    "allow_semantic_equivalent": allow_semantic_equivalent,
                    "category": "5. Đánh số chương và mục",
                },
                source_citation="Khung Cấu trúc Báo cáo Bắt buộc (Template)",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="6. Trang bìa báo cáo",
                description="Báo cáo có trang bìa học thuật đầy đủ thông tin: tên trường, tên khoa, đề tài, GVHD, SV, MSSV, năm thực hiện.",
                rule_type=FormatCriterionRuleType.PRESENCE,
                expected_value={
                    "kind": "cover_page",
                    "required_fields": [
                        "tên trường",
                        "tên khoa",
                        "tên đề tài",
                        "giảng viên hướng dẫn",
                        "sinh viên",
                        "mssv",
                        "năm thực hiện",
                    ],
                    "category": "6. Trang bìa",
                },
                source_citation="Trang bìa chính: Tên trường, tên khoa, bộ môn...",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="7. Bảng phân công đóng góp thành viên",
                description="Bắt buộc có Bảng phân công đóng góp của các thành viên đặt ngay sau trang Lời cam đoan.",
                rule_type=FormatCriterionRuleType.PRESENCE,
                expected_value={
                    "kind": "table_columns",
                    "value": [
                        "STT",
                        "Họ và tên",
                        "Mã số sinh viên (MSSV)",
                        "Nhiệm vụ đảm nhiệm",
                        "Tỷ lệ đóng góp (%)",
                        "Chữ ký xác nhận",
                    ],
                    "category": "7. Trang phụ và lời cam đoan",
                },
                source_citation="Bảng phân công đóng góp của các thành viên: STT, Họ và tên, MSSV...",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="8. Mục lục báo cáo",
                description="Báo cáo có mục lục đề mục và số trang tương ứng.",
                rule_type=FormatCriterionRuleType.PRESENCE,
                expected_value={
                    "kind": "heading",
                    "value": "Mục lục",
                    "category": "8. Mục lục",
                },
                source_citation="Mục lục: Danh mục các chương, mục chính và số trang tương ứng.",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="18. Dung lượng và số trang báo cáo",
                description="Báo cáo có độ dài tối thiểu từ 20 trang và tối đa không quá 50 trang.",
                rule_type=FormatCriterionRuleType.MEASUREMENT,
                expected_value={
                    "property": "page_count",
                    "min_pages": 20,
                    "max_pages": 50,
                    "category": "18. Khoảng cách và bố cục trang",
                },
                source_citation="Dung lượng trang: Báo cáo có độ dài tối thiểu từ 20 trang và tối đa không quá 50 trang",
                source_document_id=doc_id,
            ),
            FormatCriterionInput(
                name="19. Danh mục tài liệu tham khảo",
                description="Có danh mục tài liệu tham khảo theo chuẩn IEEE hoặc APA.",
                rule_type=FormatCriterionRuleType.PRESENCE,
                expected_value={
                    "kind": "heading",
                    "value": "Tài liệu tham khảo",
                    "category": "19. Tài liệu tham khảo",
                },
                source_citation="Tài liệu tham khảo: Danh sách sách, bài báo khoa học...",
                source_document_id=doc_id,
            ),
        ]

    async def extract_submission_content_facts(
        self,
        full_text: str,
        cover_text: str,
    ) -> "LLMSubmissionContentFacts":
        """Deterministic submission facts extraction for tests and fake provider."""
        from app.schemas.format_checks import LLMSubmissionContentFacts

        norm = unicodedata.normalize("NFC", cover_text.lower())
        detected_cover: list[str] = []
        for field in ("tên trường", "tên khoa", "tên đề tài", "giảng viên hướng dẫn", "sinh viên", "mssv", "năm thực hiện"):
            f_norm = unicodedata.normalize("NFC", field.lower())
            if any(token in norm for token in f_norm.split() if len(token) > 2):
                detected_cover.append(field)

        lines = [line.strip() for line in full_text.splitlines() if line.strip()]
        headings = [
            line for line in lines
            if len(line) < 100 and not line.endswith(".") and (
                any(line.lower().startswith(p) for p in ("chương", "phần", "mục", "1.", "2.", "3.", "4.", "5.", "6.", "1)", "2)", "3)", "i.", "ii."))
                or line.isupper()
            )
        ][:40]

        has_member_tbl = any("bảng phân công" in line.lower() or "đóng góp" in line.lower() for line in lines)
        member_cols = ["STT", "Họ và tên", "MSSV", "Nhiệm vụ", "Tỷ lệ đóng góp (%)"] if has_member_tbl else []

        has_toc = any("mục lục" in line.lower() for line in lines[:30])
        has_lof = any("danh mục hình" in line.lower() for line in lines[:30])
        has_lot = any("danh mục bảng" in line.lower() for line in lines[:30])
        has_refs = any("tài liệu tham khảo" in line.lower() or "references" in line.lower() for line in lines)

        tbl_captions = [line for line in lines if line.lower().startswith("bảng") or line.lower().startswith("table")]
        fig_captions = [line for line in lines if line.lower().startswith("hình") or line.lower().startswith("figure")]

        return LLMSubmissionContentFacts(
            cover_page_detected_fields=detected_cover,
            headings=headings,
            has_member_contribution_table=has_member_tbl,
            member_table_columns=member_cols,
            has_table_of_contents=has_toc,
            has_list_of_figures=has_lof,
            has_list_of_tables=has_lot,
            has_references_section=has_refs,
            references_style="IEEE" if "[1]" in full_text else None,
            table_captions=tbl_captions,
            figure_captions=fig_captions,
        )

    async def batch_judge_submission_criteria(
        self,
        criteria_items: list[dict[str, Any]],
        submission_facts: dict[str, Any],
    ) -> dict[str, "LLMBatchCriterionJudgment"]:
        """Deterministic batch review stub for tests."""
        from app.schemas.format_checks import LLMBatchCriterionJudgment

        results: dict[str, LLMBatchCriterionJudgment] = {}
        for c in criteria_items:
            cid = c.get("criterion_id", "")
            exp = c.get("expected_value", {}) or {}
            kind = exp.get("kind", "")
            c_name = c.get("name", "")

            if kind == "cover_page":
                req_fields = exp.get("required_fields", [])
                cover_sample = submission_facts.get("cover_sample", "")
                cov_res = await self.judge_cover_page(cover_sample, req_fields)
                if cov_res.is_cover_page and not cov_res.missing_elements:
                    results[cid] = LLMBatchCriterionJudgment(
                        criterion_id=cid,
                        verdict="PASS",
                        reason="Trang bìa đầy đủ các trường yêu cầu.",
                        detected_element=", ".join(cov_res.detected_elements),
                    )
                elif cov_res.is_cover_page:
                    results[cid] = LLMBatchCriterionJudgment(
                        criterion_id=cid,
                        verdict="MISSING_STUDENT_INPUT",
                        reason=f"Trang bìa thiếu trường: {', '.join(cov_res.missing_elements)}",
                    )
                else:
                    results[cid] = LLMBatchCriterionJudgment(
                        criterion_id=cid,
                        verdict="FAIL",
                        reason=cov_res.reason,
                    )
            elif kind == "template_chapter":
                chap = exp.get("chapter_name", "")
                headings = submission_facts.get("headings", [])
                sem = await self.judge_format_ambiguity("TEMPLATE", [chap], headings, c_name, "")
                if sem.verdict == "FAIL":
                    results[cid] = LLMBatchCriterionJudgment(
                        criterion_id=cid,
                        verdict="MISSING_STUDENT_INPUT",
                        reason=f"Thiếu chương '{chap}' trong báo cáo.",
                    )
                else:
                    results[cid] = LLMBatchCriterionJudgment(
                        criterion_id=cid,
                        verdict=sem.verdict,
                        reason=sem.reason,
                        detected_element=chap,
                    )
            elif kind == "template_section":
                sec = exp.get("section_name", "")
                headings = submission_facts.get("headings", [])
                sem = await self.judge_format_ambiguity("TEMPLATE", [sec], headings, c_name, "")
                if sem.verdict == "FAIL":
                    results[cid] = LLMBatchCriterionJudgment(
                        criterion_id=cid,
                        verdict="MISSING_STUDENT_INPUT",
                        reason=f"Thiếu mục con '{sec}' trong báo cáo.",
                    )
                else:
                    results[cid] = LLMBatchCriterionJudgment(
                        criterion_id=cid,
                        verdict=sem.verdict,
                        reason=sem.reason,
                        detected_element=sec,
                    )
            elif kind == "table_columns":
                has_tbl = submission_facts.get("has_member_contribution_table", False)
                if has_tbl:
                    results[cid] = LLMBatchCriterionJudgment(
                        criterion_id=cid,
                        verdict="PASS",
                        reason="Có bảng phân công đóng góp thành viên.",
                    )
                else:
                    results[cid] = LLMBatchCriterionJudgment(
                        criterion_id=cid,
                        verdict="MISSING_STUDENT_INPUT",
                        reason="Thiếu bảng phân công đóng góp thành viên.",
                    )
            else:
                results[cid] = LLMBatchCriterionJudgment(
                    criterion_id=cid,
                    verdict="PASS",
                    reason="Khớp yêu cầu quy định.",
                )
        return results

    async def health(self) -> AIHealth:
        return AIHealth(mode="fake", available=True, model="deterministic-fake-v1")

