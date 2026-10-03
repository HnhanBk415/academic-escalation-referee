"""Add clarification lineage, applied-exception tracing and case SLA timestamps.

Revision ID: 20261002_0005
Revises: 20261001_0004
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "20261002_0005"
down_revision = "20261001_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    question_columns = {item["name"] for item in inspector.get_columns("questions")}
    if "parent_question_id" not in question_columns:
        op.add_column("questions", sa.Column("parent_question_id", sa.String(64), nullable=True))
    if "clarification_round" not in question_columns:
        op.add_column(
            "questions",
            sa.Column("clarification_round", sa.Integer(), nullable=False, server_default="0"),
        )
    if "applied_exception_id" not in question_columns:
        op.add_column("questions", sa.Column("applied_exception_id", sa.String(64), nullable=True))
    question_indexes = {item["name"] for item in inspect(bind).get_indexes("questions")}
    for name, column in (
        ("ix_questions_parent_question_id", "parent_question_id"),
        ("ix_questions_applied_exception_id", "applied_exception_id"),
    ):
        if name not in question_indexes:
            op.create_index(name, "questions", [column])

    case_columns = {item["name"] for item in inspect(bind).get_columns("escalation_cases")}
    if "sla_due_at" not in case_columns:
        op.add_column(
            "escalation_cases",
            sa.Column("sla_due_at", sa.DateTime(timezone=True), nullable=True),
        )
    if bind.dialect.name == "postgresql":
        bind.execute(
            sa.text(
                "UPDATE escalation_cases "
                "SET sla_due_at = created_at + INTERVAL '48 hours' "
                "WHERE sla_due_at IS NULL"
            )
        )
    elif bind.dialect.name == "sqlite":
        bind.execute(
            sa.text(
                "UPDATE escalation_cases "
                "SET sla_due_at = datetime(created_at, '+48 hours') "
                "WHERE sla_due_at IS NULL"
            )
        )

    for table in ("questions", "policy_exceptions"):
        topics = {item["name"] for item in inspect(bind).get_columns(table)}
        if "policy_topic" not in topics:
            continue
        for old_topic, canonical_topic in (
            ("GROUP_SIZE", "GROUP_MEMBERSHIP"),
            ("GROUP_MEMBERS", "GROUP_MEMBERSHIP"),
            ("GRADE", "GRADE_APPEAL"),
            ("DEADLINE", "SUBMISSION_DEADLINE"),
            ("CAMPUS_SERVICES", "CAMPUS_LIFE"),
            ("SCHOOL_ADMINISTRATION", "COURSE_REGISTRATION"),
        ):
            bind.execute(
                sa.text(
                    f"UPDATE {table} SET policy_topic = :canonical "
                    "WHERE policy_topic = :old"
                ),
                {"canonical": canonical_topic, "old": old_topic},
            )

    if bind.dialect.name == "postgresql":
        op.execute(
            """
            CREATE OR REPLACE FUNCTION reject_audit_event_mutation()
            RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                RAISE EXCEPTION 'audit_events is append-only';
            END;
            $$;
            """
        )
        op.execute(
            """
            CREATE TRIGGER audit_events_append_only
            BEFORE UPDATE OR DELETE ON audit_events
            FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();
            """
        )
    elif bind.dialect.name == "sqlite":
        op.execute(
            """
            CREATE TRIGGER IF NOT EXISTS audit_events_no_update
            BEFORE UPDATE ON audit_events
            BEGIN
                SELECT RAISE(ABORT, 'audit_events is append-only');
            END;
            """
        )
        op.execute(
            """
            CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
            BEFORE DELETE ON audit_events
            BEGIN
                SELECT RAISE(ABORT, 'audit_events is append-only');
            END;
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS audit_events_append_only ON audit_events")
        op.execute("DROP FUNCTION IF EXISTS reject_audit_event_mutation()")
    elif bind.dialect.name == "sqlite":
        op.execute("DROP TRIGGER IF EXISTS audit_events_no_update")
        op.execute("DROP TRIGGER IF EXISTS audit_events_no_delete")

    inspector = inspect(bind)
    case_columns = {item["name"] for item in inspector.get_columns("escalation_cases")}
    if "sla_due_at" in case_columns:
        op.drop_column("escalation_cases", "sla_due_at")

    question_indexes = {item["name"] for item in inspect(bind).get_indexes("questions")}
    for name in ("ix_questions_applied_exception_id", "ix_questions_parent_question_id"):
        if name in question_indexes:
            op.drop_index(name, table_name="questions")
    question_columns = {item["name"] for item in inspect(bind).get_columns("questions")}
    for name in ("applied_exception_id", "clarification_round", "parent_question_id"):
        if name in question_columns:
            op.drop_column("questions", name)
