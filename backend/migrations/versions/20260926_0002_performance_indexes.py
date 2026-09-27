"""Add composite indexes used by history, queue and audit queries.

Revision ID: 20260926_0002
Revises: 20260920_0001
"""

from alembic import op
from sqlalchemy import inspect

revision = "20260926_0002"
down_revision = "20260920_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    indexes = (
        ("ix_questions_actor_created", "questions", ["actor_id", "created_at"]),
        (
            "ix_escalation_cases_status_created",
            "escalation_cases",
            ["status", "created_at"],
        ),
        (
            "ix_retrieval_evidence_question_rank",
            "retrieval_evidence",
            ["question_id", "rank"],
        ),
        (
            "ix_audit_entity_created",
            "audit_events",
            ["entity_type", "entity_id", "created_at"],
        ),
    )
    bind = op.get_bind()
    inspector = inspect(bind)
    for name, table, columns in indexes:
        existing = {item["name"] for item in inspector.get_indexes(table)}
        if name not in existing:
            op.create_index(name, table, columns)


def downgrade() -> None:
    indexes = (
        ("ix_audit_entity_created", "audit_events"),
        ("ix_retrieval_evidence_question_rank", "retrieval_evidence"),
        ("ix_escalation_cases_status_created", "escalation_cases"),
        ("ix_questions_actor_created", "questions"),
    )
    bind = op.get_bind()
    inspector = inspect(bind)
    for name, table in indexes:
        existing = {item["name"] for item in inspector.get_indexes(table)}
        if name in existing:
            op.drop_index(name, table_name=table)
