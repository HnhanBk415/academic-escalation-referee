import asyncio
import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.ai.factory import build_ai_provider
from app.core.enums import ActorRole
from app.db.session import SessionLocal
from app.models import Actor, Course, Group, GroupMembership


def _find_data_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "data").is_dir():
            return parent / "data"
    return current.parents[2] / "data" if len(current.parents) > 2 else current.parent / "data"


def load_demo_config() -> dict:
    """Reads data/demo-config.json if present, or returns default structure."""
    config_file = _find_data_root() / "demo-config.json"
    if config_file.is_file():
        try:
            return json.loads(config_file.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[Seed] Error reading {config_file}: {e}", flush=True)
    return {
        "lecturers": [{"id": "lecturer-01", "display_name": "TS. Trần Minh Tuấn"}],
        "academic_affairs": [
            {"id": "academic-affairs-01", "display_name": "Quản trị viên demo"}
        ],
        "students": [
            {"id": "demo-student", "display_name": "Sinh viên demo"},
            {"id": "student-a1", "display_name": "Nguyễn Văn A (Student A1)"},
            {"id": "student-b1", "display_name": "Trần Thị B (Student B1)"},
            {"id": "student-dadn-a1", "display_name": "Lê Văn C (DADN A1)"},
            {"id": "student-dadn-b1", "display_name": "Phạm Thị D (DADN B1)"},
            {"id": "verify-harness", "display_name": "Verify Harness"},
        ],
        "groups": [],
    }


async def seed_demo(session: AsyncSession, provider: AIProvider | None = None) -> None:
    embedding_provider = provider or build_ai_provider()
    cfg = load_demo_config()

    # 1. Seed Lecturers from config
    for item in cfg.get("lecturers", []):
        actor_id = item["id"]
        display_name = item.get("display_name", actor_id)
        existing = await session.get(Actor, actor_id)
        if existing is None:
            session.add(Actor(id=actor_id, display_name=display_name, role=ActorRole.LECTURER))
        else:
            existing.display_name = display_name
            existing.role = ActorRole.LECTURER

    # 2. Seed Academic Affairs users from config
    for item in cfg.get("academic_affairs", []):
        actor_id = item["id"]
        display_name = item.get("display_name", actor_id)
        existing = await session.get(Actor, actor_id)
        if existing is None:
            session.add(
                Actor(id=actor_id, display_name=display_name, role=ActorRole.ACADEMIC_AFFAIRS)
            )
        else:
            existing.display_name = display_name
            existing.role = ActorRole.ACADEMIC_AFFAIRS

    # 3. Seed Students from config
    student_ids: list[str] = []
    for item in cfg.get("students", []):
        actor_id = item["id"]
        display_name = item.get("display_name", actor_id)
        student_ids.append(actor_id)
        existing = await session.get(Actor, actor_id)
        if existing is None:
            session.add(Actor(id=actor_id, display_name=display_name, role=ActorRole.STUDENT))
        else:
            existing.display_name = display_name
            existing.role = ActorRole.STUDENT
    await session.commit()

    # 4. Seed the configured courses before groups and documents reference them.
    # demo-config.json is the canonical source for the public demo catalog; its
    # document_directory field maps a course to a source folder on disk.
    document_directory_map: dict[str, str] = {}
    for item in cfg.get("courses", []):
        course_id = item["id"]
        existing = await session.get(Course, course_id)
        if existing is None:
            session.add(
                Course(
                    id=course_id,
                    code=item.get("code", course_id),
                    name=item.get("name", course_id),
                    semester=item.get("semester", "261"),
                )
            )
        else:
            existing.code = item.get("code", course_id)
            existing.name = item.get("name", course_id)
            existing.semester = item.get("semester", "261")

        document_directory = item.get("document_directory")
        if document_directory:
            document_directory_map[document_directory] = course_id
    await session.commit()

    # 5. Scan and sync documents from only the configured source directories.
    # This prevents unconfigured folders from silently changing the demo catalog.
    from app.ingestion.service import scan_and_sync_documents

    print(
        "[Seed] Scanning and syncing documents from data/sample-documents/...",
        flush=True,
    )
    await scan_and_sync_documents(
        session,
        provider=embedding_provider,
        course_directory_map=document_directory_map or None,
        create_default_groups=False,
    )
    await session.commit()

    # 6. Seed configured groups and memberships.
    configured_groups = cfg.get("groups", [])
    configured_group_ids: set[str] = set()
    for g_item in configured_groups:
        grp_id = g_item["id"]
        course_id = g_item["course_id"]
        grp_name = g_item.get("name", grp_id)
        sem = g_item.get("semester", "261")
        configured_group_ids.add(grp_id)

        existing_grp = await session.get(Group, grp_id)
        if existing_grp is None:
            session.add(Group(id=grp_id, course_id=course_id, name=grp_name, semester=sem))
        else:
            existing_grp.name = grp_name
            existing_grp.course_id = course_id
            existing_grp.semester = sem
        await session.flush()

        # Add specified members
        member_ids = g_item.get("member_ids", [])
        for m_id in member_ids:
            existing_mem = await session.scalar(
                select(GroupMembership).where(
                    GroupMembership.actor_id == m_id,
                    GroupMembership.group_id == grp_id,
                )
            )
            if existing_mem is None:
                session.add(GroupMembership(actor_id=m_id, group_id=grp_id))

    # 7. For any auto-discovered groups not explicitly in config, ensure demo students are attached.
    all_groups = (await session.scalars(select(Group))).all()
    for grp in all_groups:
        if grp.id not in configured_group_ids:
            for s_id in student_ids:
                existing_mem = await session.scalar(
                    select(GroupMembership).where(
                        GroupMembership.actor_id == s_id,
                        GroupMembership.group_id == grp.id,
                    )
                )
                if existing_mem is None:
                    session.add(GroupMembership(actor_id=s_id, group_id=grp.id))
    await session.commit()


async def main() -> None:
    async with SessionLocal() as session:
        await seed_demo(session, build_ai_provider())


if __name__ == "__main__":
    asyncio.run(main())
