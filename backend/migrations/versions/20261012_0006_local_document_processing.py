"""Add local document extraction, review and version lineage.

Revision ID: 20261012_0006
Revises: 20261002_0005
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "20261012_0006"
down_revision = "20261002_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    document_columns = {item["name"] for item in inspector.get_columns("documents")}
    if "supersedes_document_id" not in document_columns:
        op.add_column(
            "documents",
            sa.Column("supersedes_document_id", sa.String(64), nullable=True),
        )
        if bind.dialect.name != "sqlite":
            op.create_foreign_key(
                "fk_documents_supersedes_document_id", "documents", "documents",
                ["supersedes_document_id"], ["id"],
            )
        op.create_index(
            "ix_documents_supersedes_document_id", "documents", ["supersedes_document_id"]
        )

    if not inspector.has_table("document_processing"):
        op.create_table(
            "document_processing",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("document_id", sa.String(64), sa.ForeignKey("documents.id"), nullable=False, unique=True),
            sa.Column("original_filename", sa.String(300), nullable=True),
            sa.Column("original_path", sa.String(500), nullable=True),
            sa.Column("extraction_method", sa.String(40), nullable=False),
            sa.Column("status", sa.String(40), nullable=False),
            sa.Column("confidence_threshold", sa.Float(), nullable=False, server_default="0.8"),
            sa.Column("raw_text", sa.Text(), nullable=False, server_default=""),
            sa.Column("clean_text", sa.Text(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_by", sa.String(64), sa.ForeignKey("actors.id"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_document_processing_document_id", "document_processing", ["document_id"])
        op.create_index("ix_document_processing_status", "document_processing", ["status"])

    if not inspector.has_table("document_review_items"):
        op.create_table(
            "document_review_items",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("processing_id", sa.String(64), sa.ForeignKey("document_processing.id"), nullable=False),
            sa.Column("item_index", sa.Integer(), nullable=False),
            sa.Column("predicted_text", sa.Text(), nullable=False),
            sa.Column("confirmed_text", sa.Text(), nullable=True),
            sa.Column("confidence", sa.Float(), nullable=False),
            sa.Column("context_before", sa.Text(), nullable=False, server_default=""),
            sa.Column("context_after", sa.Text(), nullable=False, server_default=""),
            sa.Column("page_number", sa.Integer(), nullable=True),
            sa.Column("crop_path", sa.String(500), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("processing_id", "item_index"),
        )
        op.create_index("ix_document_review_items_processing_id", "document_review_items", ["processing_id"])
        op.create_index("ix_document_review_items_status", "document_review_items", ["status"])


def downgrade() -> None:
    op.drop_table("document_review_items")
    op.drop_table("document_processing")
    op.drop_index("ix_documents_supersedes_document_id", table_name="documents")
    if op.get_bind().dialect.name != "sqlite":
        op.drop_constraint("fk_documents_supersedes_document_id", "documents", type_="foreignkey")
        op.drop_column("documents", "supersedes_document_id")
    else:
        with op.batch_alter_table("documents") as batch_op:
            batch_op.drop_column("supersedes_document_id")


