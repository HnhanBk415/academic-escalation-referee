import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.ai.factory import build_ai_provider
from app.core.enums import ActorRole
from app.db.session import SessionLocal
from app.models import Actor, Course, Group, GroupMembership


async def seed_demo(session: AsyncSession, provider: AIProvider | None = None) -> None:
    embedding_provider = provider or build_ai_provider()
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
    await session.commit()


async def main() -> None:
    async with SessionLocal() as session:
        await seed_demo(session, build_ai_provider())


if __name__ == "__main__":
    asyncio.run(main())
