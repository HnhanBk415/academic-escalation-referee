"""Restore the pre-hybrid vector RAG schema.

Revision ID: 20261013_0009
Revises: 20261012_0008
"""

from alembic import op
from sqlalchemy import inspect

revision = "20261013_0009"
down_revision = "20261012_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Remove the Hybrid Search, HNSW and temporal-version additions."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_policy_updates_retrieval_scope")
        op.execute("DROP INDEX IF EXISTS ix_documents_course_status_effective")
        op.execute("DROP INDEX IF EXISTS ix_document_chunks_course_document")
        op.execute("DROP INDEX IF EXISTS ix_document_chunks_search_vector_gin")
        op.execute("DROP INDEX IF EXISTS ix_document_chunks_embedding_hnsw")
        op.execute("DROP TRIGGER IF EXISTS document_chunks_search_vector_trigger ON document_chunks")
        op.execute("DROP FUNCTION IF EXISTS document_chunks_search_vector_update()")
        op.execute("ALTER TABLE document_chunks DROP COLUMN IF EXISTS search_vector")
        op.execute("DROP EXTENSION IF EXISTS unaccent")

    if inspect(bind).has_table("policy_versions"):
        op.drop_table("policy_versions")


def downgrade() -> None:
    raise NotImplementedError(
        "The Hybrid RAG schema rollback is intentionally irreversible; "
        "restore revision 20261012_0008 from a database backup if needed."
    )
