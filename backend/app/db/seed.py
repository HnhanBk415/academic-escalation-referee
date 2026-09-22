import asyncio
import hashlib
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.ai.factory import build_ai_provider
from app.ai.fake import FakeProvider
from app.core.config import get_settings
from app.core.enums import ActorRole, DocumentStatus
from app.db.session import SessionLocal
from app.models import Actor, Course, Document, DocumentChunk, Group, GroupMembership

POLICY_TEXT = """Mỗi nhóm đồ án có từ 3 đến 5 sinh viên.
Mọi thay đổi thành viên sau khi đăng ký phải được giảng viên phụ trách phê duyệt.
Nhóm có nhiều hơn 5 sinh viên chỉ được chấp nhận khi có quyết định của giảng viên.
Quyết định ngoại lệ phải ghi rõ nhóm, thời hạn và lý do."""

RUBRIC_TEXT = """Rubric đánh giá đồ án gồm báo cáo kỹ thuật 30%, sản phẩm 40%,
trình bày và trả lời câu hỏi 20%, hợp tác và đóng góp trong nhóm 10%.
Bài nộp trễ bị trừ 10% tổng điểm cho mỗi ngày trễ, tối đa hai ngày.
Yêu cầu thay đổi điểm hoặc phúc khảo phải được chuyển cho giảng viên phụ trách."""


async def seed_demo(session: AsyncSession, provider: AIProvider | None = None) -> None:
    embedding_provider = provider or build_ai_provider()
    embedding_model = (
        "deterministic-fake-v1"
        if isinstance(embedding_provider, FakeProvider)
        else get_settings().gemini_embed_model
    )
    actors = [
        Actor(id="student-a1", display_name="Student A1", role=ActorRole.STUDENT),
        Actor(id="student-b1", display_name="Student B1", role=ActorRole.STUDENT),
        Actor(
            id="student-dadn-a1",
            display_name="Student DADN A1",
            role=ActorRole.STUDENT,
        ),
        Actor(
            id="student-dadn-b1",
            display_name="Student DADN B1",
            role=ActorRole.STUDENT,
        ),
        Actor(id="lecturer-01", display_name="Lecturer 01", role=ActorRole.LECTURER),
    ]
    for actor in actors:
        if await session.get(Actor, actor.id) is None:
            session.add(actor)

    if await session.get(Course, "CO3001") is None:
        session.add(
            Course(id="CO3001", code="CO3001", name="Đồ án chuyên ngành", semester="261")
        )
    if await session.get(Course, "DADN-HK242") is None:
        session.add(
            Course(
                id="DADN-HK242",
                code="DADN",
                name="Đồ án Đa ngành (tài liệu HK242)",
                semester="242",
            )
        )
    await session.flush()

    groups = [
        Group(id="group-a", course_id="CO3001", name="Group A", semester="261"),
        Group(id="group-b", course_id="CO3001", name="Group B", semester="261"),
        Group(
            id="dadn-group-a",
            course_id="DADN-HK242",
            name="DADN Group A",
            semester="242",
        ),
        Group(
            id="dadn-group-b",
            course_id="DADN-HK242",
            name="DADN Group B",
            semester="242",
        ),
    ]
    for group in groups:
        if await session.get(Group, group.id) is None:
            session.add(group)
    await session.flush()

    memberships = [
        ("student-a1", "group-a"),
        ("student-b1", "group-b"),
        ("student-dadn-a1", "dadn-group-a"),
        ("student-dadn-b1", "dadn-group-b"),
    ]
    for actor_id, group_id in memberships:
        existing = await session.scalar(
            select(GroupMembership).where(
                GroupMembership.actor_id == actor_id,
                GroupMembership.group_id == group_id,
            )
        )
        if existing is None:
            session.add(GroupMembership(actor_id=actor_id, group_id=group_id))

    from app.ingestion.service import scan_and_sync_documents
    print("[Seed] Scanning data/sample-documents/ for PDFs and documents...", flush=True)
    await scan_and_sync_documents(session, provider=embedding_provider)

    document_id = "group-policy-v1"
    content_hash = hashlib.sha256(POLICY_TEXT.encode("utf-8")).hexdigest()
    if await session.get(Document, document_id) is None:
        session.add(
            Document(
                id=document_id,
                course_id="CO3001",
                title="Quy định nhóm đồ án CO3001",
                document_type="MARKDOWN",
                source_path="data/sample-documents/group-policy-v1.md",
                version="1.0",
                status=DocumentStatus.ACTIVE,
                effective_from=date(2026, 9, 1),
                effective_until=date(2027, 1, 31),
                content_hash=content_hash,
            )
        )
        await session.flush()

    policy_chunk = await session.get(DocumentChunk, "chunk-group-policy-v1-0")
    if (
        policy_chunk is None
        or (policy_chunk.chunk_metadata or {}).get("embedding_model") != embedding_model
        or policy_chunk.embedding is None
    ):
        embedding = (await embedding_provider.embed([POLICY_TEXT]))[0]
        metadata = {
            "seeded": True,
            "language": "vi",
            "embedding_dimensions": 768,
            "embedding_model": embedding_model,
        }
        if policy_chunk is None:
            session.add(
                DocumentChunk(
                    id="chunk-group-policy-v1-0",
                    document_id=document_id,
                    course_id="CO3001",
                    chunk_index=0,
                    heading="Thành viên và ngoại lệ",
                    page_number=1,
                    content=POLICY_TEXT,
                    content_hash=content_hash,
                    embedding=embedding,
                    chunk_metadata=metadata,
                )
            )
        else:
            policy_chunk.embedding = embedding
            policy_chunk.chunk_metadata = metadata

    rubric_hash = hashlib.sha256(RUBRIC_TEXT.encode("utf-8")).hexdigest()
    if await session.get(Document, "project-rubric-v1") is None:
        session.add(
            Document(
                id="project-rubric-v1",
                course_id="CO3001",
                title="Rubric đánh giá đồ án CO3001",
                document_type="MARKDOWN",
                source_path="data/sample-documents/project-rubric-v1.md",
                version="1.0",
                status=DocumentStatus.ACTIVE,
                effective_from=date(2026, 9, 1),
                effective_until=date(2027, 1, 31),
                content_hash=rubric_hash,
            )
        )
        await session.flush()

    rubric_chunk = await session.get(DocumentChunk, "chunk-project-rubric-v1-0")
    if (
        rubric_chunk is None
        or (rubric_chunk.chunk_metadata or {}).get("embedding_model") != embedding_model
        or rubric_chunk.embedding is None
    ):
        embedding = (await embedding_provider.embed([RUBRIC_TEXT]))[0]
        metadata = {
            "seeded": True,
            "language": "vi",
            "embedding_dimensions": 768,
            "embedding_model": embedding_model,
        }
        if rubric_chunk is None:
            session.add(
                DocumentChunk(
                    id="chunk-project-rubric-v1-0",
                    document_id="project-rubric-v1",
                    course_id="CO3001",
                    chunk_index=0,
                    heading="Cơ cấu điểm và phúc khảo",
                    page_number=1,
                    content=RUBRIC_TEXT,
                    content_hash=rubric_hash,
                    embedding=embedding,
                    chunk_metadata=metadata,
                )
            )
        else:
            rubric_chunk.embedding = embedding
            rubric_chunk.chunk_metadata = metadata
    await session.commit()


async def main() -> None:
    async with SessionLocal() as session:
        await seed_demo(session, build_ai_provider())


if __name__ == "__main__":
    asyncio.run(main())
