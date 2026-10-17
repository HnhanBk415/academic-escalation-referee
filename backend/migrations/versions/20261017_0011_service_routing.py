"""Add service routing requests.

Revision ID: 20261017_0011
Revises: 20261013_0010
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "20261017_0011"
down_revision = "20261013_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Revision 0001 uses current Base.metadata on a fresh database, so this
    # table may already exist during a from-zero migration.
    if inspect(op.get_bind()).has_table("service_requests"):
        return
    op.create_table(
        "service_requests",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("actor_id", sa.String(64), sa.ForeignKey("actors.id"), nullable=False),
        sa.Column("request_id", sa.String(64), nullable=False),
        sa.Column("idempotency_key", sa.String(100), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("service_id", sa.String(50), nullable=False),
        sa.Column("intent", sa.String(50), nullable=False),
        sa.Column("status", sa.String(40), nullable=False),
        sa.Column("reason_code", sa.String(100), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("slots", sa.JSON(), nullable=False),
        sa.Column("missing_fields", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("policy_source", sa.String(300), nullable=True),
        sa.Column("policy_version", sa.String(64), nullable=True),
        sa.Column("sla_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by", sa.String(64), sa.ForeignKey("actors.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("actor_id", "idempotency_key", name="uq_service_requests_actor_id"),
    )
    op.create_index("ix_service_requests_actor_created", "service_requests", ["actor_id", "created_at"])
    op.create_index("ix_service_requests_actor_id", "service_requests", ["actor_id"])
    op.create_index("ix_service_requests_request_id", "service_requests", ["request_id"])
    op.create_index("ix_service_requests_service_id", "service_requests", ["service_id"])
    op.create_index("ix_service_requests_status", "service_requests", ["status"])


def downgrade() -> None:
    op.drop_table("service_requests")
