import asyncio
import json
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.ai.factory import build_ai_provider
from app.core.enums import ActorRole, DocumentStatus
from app.db.session import SessionLocal
from app.models import Actor, Course, Document, Group, GroupMembership


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
            {"id": "academic-affairs-01", "display_name": "Phòng Đào tạo"}
        ],
        "students": [
            {"id": "demo-student", "display_name": "Sinh viên mẫu"},
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

    # 3. Seed staff for the service-specific review queue.
    for item in cfg.get("clinic_staff", []):
        actor_id = item["id"]
        existing = await session.get(Actor, actor_id)
        if existing is None:
            session.add(Actor(id=actor_id, display_name=item.get("display_name", actor_id), role=ActorRole.CLINIC))
        else:
            existing.display_name = item.get("display_name", actor_id)
            existing.role = ActorRole.CLINIC

    # 4. Seed staff for the student affairs service queue.
    for item in cfg.get("student_affairs_staff", []):
        actor_id = item["id"]
        existing = await session.get(Actor, actor_id)
        if existing is None:
            session.add(
                Actor(
                    id=actor_id,
                    display_name=item.get("display_name", actor_id),
                    role=ActorRole.STUDENT_AFFAIRS,
                )
            )
        else:
            existing.display_name = item.get("display_name", actor_id)
            existing.role = ActorRole.STUDENT_AFFAIRS

    # 4. Seed Students from config
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

    # Index the service policies through the same Document -> Chunk -> embedding
    # pipeline. Service scopes are internal and are never offered as courses.
    from app.ingestion.service import ingest_document

    service_catalog_path = _find_data_root() / "service-catalog.json"
    service_catalog = json.loads(service_catalog_path.read_text(encoding="utf-8"))
    for service in service_catalog["services"]:
        scope = service.get("retrieval_scope")
        source = service.get("policy_source")
        if not scope or not source or not scope.startswith("SERVICE-"):
            continue
        source_file = _find_data_root().parent / source
        if not source_file.is_file():
            print(f"[Seed] Missing service policy: {source}", flush=True)
            continue
        if await session.get(Course, scope) is None:
            session.add(Course(id=scope, code=scope, name=service["display_name"], semester="SERVICE"))
            await session.commit()
        document_id = f"service-policy-{service['service_id']}"
        document = await session.get(Document, document_id)
        if document is None:
            document = Document(
                id=document_id,
                course_id=scope,
                title=f"Policy {service['display_name']}",
                document_type="MARKDOWN",
                source_path=source,
                version=service["policy_version"],
                status=DocumentStatus.PENDING,
                effective_from=date(2025, 1, 1),
                effective_until=date(2030, 12, 31),
                content_hash="",
            )
            session.add(document)
        else:
            document.course_id = scope
            document.source_path = source
            document.version = service["policy_version"]
            document.effective_until = date(2030, 12, 31)
        await session.commit()
        try:
            result = await ingest_document(session, document_id, provider=embedding_provider)
            print(f"[Seed] Indexed {source}: {result.chunk_count} chunks", flush=True)
        except Exception as exc:
            print(f"[Seed] Failed to index service policy {source}: {exc}", flush=True)

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
