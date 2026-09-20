import hashlib
import re
import unicodedata

from app.core.enums import Route, UncertaintyType
from app.schemas.referee import AIHealth, RefereeDecision


class FakeProvider:
    """Deterministic provider for tests and local workflow development."""

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
        if any(token in lowered for token in ("rubric", "tiêu chí", "chấm điểm")):
            return RefereeDecision(
                route=Route.ANSWER,
                uncertainty_type=UncertaintyType.NONE,
                reason_code="RUBRIC_GROUNDED_ANSWER",
                answer=(
                    "Rubric gồm: báo cáo 30%, sản phẩm 40%, trình bày 20% "
                    "và làm việc nhóm 10%."
                ),
                citation_labels=[evidence[0]["label"]],
                confidence=1,
            )
        return RefereeDecision(
            route=Route.ANSWER,
            uncertainty_type=UncertaintyType.NONE,
            reason_code="POLICY_GROUNDED_ANSWER",
            answer="Theo quy định, mỗi nhóm đồ án có từ 3 đến 5 sinh viên.",
            citation_labels=[evidence[0]["label"]],
            confidence=1,
        )

    async def health(self) -> AIHealth:
        return AIHealth(mode="fake", available=True, model="deterministic-fake-v1")
