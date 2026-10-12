"""Add lecturer-published policy update layer.

Revision ID: 20261012_0007
Revises: 20261012_0006
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "20261012_0007"
down_revision = "20261012_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The original initial migration intentionally creates the current model
    # metadata for fresh installations. In that case this table already exists
    # before this historical migration is reached.
    if inspect(op.get_bind()).has_table("policy_updates"):
        return
    op.create_table(
        "policy_updates",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("source_document_id", sa.String(64), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("source_chunk_id", sa.String(64), sa.ForeignKey("document_chunks.id"), nullable=True),
        sa.Column("course_id", sa.String(64), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("scope_type", sa.String(20), nullable=False),
        sa.Column("scope_id", sa.String(64), nullable=False),
        sa.Column("policy_topic", sa.String(100), nullable=False),
        sa.Column("operation", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_until", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("supersedes_policy_update_id", sa.String(64), nullable=True),
        sa.Column("created_by", sa.String(64), sa.ForeignKey("actors.id"), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["supersedes_policy_update_id"], ["policy_updates.id"]),
    )
    for name, columns in (
        ("ix_policy_updates_source_document_id", ["source_document_id"]),
        ("ix_policy_updates_course_id", ["course_id"]),
        ("ix_policy_updates_scope_type", ["scope_type"]),
        ("ix_policy_updates_scope_id", ["scope_id"]),
        ("ix_policy_updates_policy_topic", ["policy_topic"]),
        ("ix_policy_updates_status", ["status"]),
        ("ix_policy_updates_supersedes_policy_update_id", ["supersedes_policy_update_id"]),
    ):
        op.create_index(name, "policy_updates", columns)


def downgrade() -> None:
    op.drop_table("policy_updates")
