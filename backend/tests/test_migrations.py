from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config

from app.db.base import Base
from app.models import Actor, AuditEvent, Course, EscalationCase, HumanDecision, Question

# Columns recalculated by migrations on re-upgrade; excluded from round-trip checks.
_RECALCULATED_COLS: dict[str, set[str]] = {
    "escalation_cases": {"sla_due_at"},
}


def _rows_excluding(connection: sa.Connection, table: sa.Table) -> list[tuple]:
    """Return rows from *table* with recalculated columns replaced by None."""
    skip = _RECALCULATED_COLS.get(table.name, set())
    cols = [c for c in table.columns if c.name not in skip]
    return connection.execute(sa.select(*cols)).all()


def test_migration_chain_upgrades_cleanly_and_preserves_flow_one():
    """Verify the full migration chain reaches head with no stray tables and that
    Flow 1 rows survive a downgrade-then-re-upgrade cycle."""
    backend_root = Path(__file__).resolve().parents[1]
    config = Config(str(backend_root / "alembic.ini"))
    config.set_main_option("script_location", str(backend_root / "migrations"))
    engine = sa.create_engine("sqlite:///:memory:")
    try:
        with engine.begin() as connection:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            config.attributes["connection"] = connection

            # Upgrade all the way to head.
            command.upgrade(config, "head")

            # No legacy format-check tables should be present.
            all_tables = set(sa.inspect(connection).get_table_names())
            assert not {t for t in all_tables if t.startswith("format_")}

            # Schema must exactly match the ORM metadata.
            assert all_tables == {*Base.metadata.tables, "alembic_version"}

            # Seed representative Flow 1 data.
            connection.execute(
                Actor.__table__.insert(),
                [
                    {"id": "student", "display_name": "Student", "role": "STUDENT"},
                    {"id": "reviewer", "display_name": "Reviewer", "role": "LECTURER"},
                ],
            )
            connection.execute(
                Course.__table__.insert(),
                {
                    "id": "course",
                    "code": "CO3001",
                    "name": "Course",
                    "semester": "261",
                },
            )
            connection.execute(
                Question.__table__.insert(),
                {
                    "id": "question",
                    "actor_id": "student",
                    "course_id": "course",
                    "text": "Can our group have six members?",
                    "status": "ESCALATED",
                    "route": "ESCALATE",
                    "policy_topic": "GROUP_MEMBERSHIP",
                },
            )
            connection.execute(
                EscalationCase.__table__.insert(),
                {
                    "id": "case",
                    "question_id": "question",
                    "status": "DECIDED",
                    "reason_code": "AUTHORITY_REQUIRED",
                    "uncertainty_type": "AUTHORITY_REQUIRED",
                    "ai_summary": "Group size exception",
                    "decision_question": "Approve request?",
                    "assigned_reviewer_id": "reviewer",
                },
            )
            connection.execute(
                HumanDecision.__table__.insert(),
                {
                    "id": "decision",
                    "case_id": "case",
                    "reviewer_id": "reviewer",
                    "decision": "APPROVED",
                    "reason": "Approved for this group.",
                },
            )
            connection.execute(
                AuditEvent.__table__.insert(),
                {
                    "id": "audit",
                    "event_type": "HUMAN_DECISION_RECORDED",
                    "entity_type": "case",
                    "entity_id": "case",
                    "actor_id": "reviewer",
                },
            )

            before = {
                table.name: _rows_excluding(connection, table)
                for table in Base.metadata.sorted_tables
            }

            # Downgrade to the revision just before the SLA/clarification migration,
            # then re-upgrade to head; all stable Flow 1 data must survive.
            command.downgrade(config, "20261001_0004")
            command.upgrade(config, "head")

            assert set(sa.inspect(connection).get_table_names()) == {
                *Base.metadata.tables,
                "alembic_version",
            }
            assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []

            for table in Base.metadata.sorted_tables:
                after = _rows_excluding(connection, table)
                assert after == before[table.name], f"Data mismatch in {table.name}"

            # The audit immutability triggers must be present after the full cycle.
            triggers = (
                connection.exec_driver_sql("SELECT name FROM sqlite_master WHERE type = 'trigger'")
                .scalars()
                .all()
            )
            assert {"audit_events_no_update", "audit_events_no_delete"} <= set(triggers)
    finally:
        engine.dispose()
