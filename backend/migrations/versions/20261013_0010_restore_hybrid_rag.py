"""Restore temporal policy history and PostgreSQL hybrid-RAG indexes.

Revision ID: 20261013_0010
Revises: 20261013_0009
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "20261013_0010"
down_revision = "20261013_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if not inspect(bind).has_table("policy_versions"):
        op.create_table(
            "policy_versions",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("document_id", sa.String(64), sa.ForeignKey("documents.id"), nullable=False),
            sa.Column("course_id", sa.String(64), sa.ForeignKey("courses.id"), nullable=False),
            sa.Column("version_label", sa.String(64), nullable=False),
            sa.Column("content_hash", sa.String(64), nullable=False),
            sa.Column("effective_from", sa.Date(), nullable=True),
            sa.Column("effective_until", sa.Date(), nullable=True),
            sa.Column("status", sa.String(20), nullable=False),
            sa.Column("supersedes_policy_version_id", sa.String(64), sa.ForeignKey("policy_versions.id"), nullable=True),
            sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("superseded_at", sa.DateTime(timezone=True), nullable=True),
            sa.UniqueConstraint("document_id"),
        )

    if bind.dialect.name != "postgresql":
        return

    op.execute(
        """
        INSERT INTO policy_versions (
            id, document_id, course_id, version_label, content_hash,
            effective_from, effective_until, status, recorded_at, activated_at, superseded_at
        )
        SELECT
            'policy-version-backfill-' || substr(md5(d.id), 1, 18),
            d.id, d.course_id, d.version, d.content_hash,
            d.effective_from, d.effective_until, d.status, d.created_at,
            CASE WHEN d.status = 'ACTIVE' THEN d.created_at ELSE NULL END,
            CASE WHEN d.status = 'SUPERSEDED' THEN d.created_at ELSE NULL END
        FROM documents d
        WHERE NOT EXISTS (SELECT 1 FROM policy_versions pv WHERE pv.document_id = d.id)
        """
    )
    op.execute(
        """
        UPDATE policy_versions current_version
        SET supersedes_policy_version_id = previous_version.id
        FROM documents current_document
        JOIN policy_versions previous_version
          ON previous_version.document_id = current_document.supersedes_document_id
        WHERE current_version.document_id = current_document.id
          AND current_document.supersedes_document_id IS NOT NULL
        """
    )
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")
    op.execute("ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS search_vector tsvector")
    op.execute(
        """
        UPDATE document_chunks
        SET search_vector = to_tsvector(
            'simple', unaccent(coalesce(heading, '') || ' ' || coalesce(content, ''))
        )
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION document_chunks_search_vector_update()
        RETURNS trigger AS $$
        BEGIN
            NEW.search_vector := to_tsvector(
                'simple', unaccent(coalesce(NEW.heading, '') || ' ' || coalesce(NEW.content, ''))
            );
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql
        """
    )
    op.execute("DROP TRIGGER IF EXISTS document_chunks_search_vector_trigger ON document_chunks")
    op.execute(
        """
        CREATE TRIGGER document_chunks_search_vector_trigger
        BEFORE INSERT OR UPDATE OF heading, content ON document_chunks
        FOR EACH ROW EXECUTE FUNCTION document_chunks_search_vector_update()
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_document_chunks_embedding_hnsw
        ON document_chunks USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_document_chunks_search_vector_gin ON document_chunks USING gin (search_vector)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_document_chunks_course_document ON document_chunks (course_id, document_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_course_status_effective ON documents (course_id, status, effective_from, effective_until)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_policy_updates_retrieval_scope ON policy_updates (course_id, status, scope_type, scope_id, policy_topic, valid_from, valid_until)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_policy_versions_course_status_effective ON policy_versions (course_id, status, effective_from, effective_until)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_policy_versions_supersedes ON policy_versions (supersedes_policy_version_id)")


def downgrade() -> None:
    raise NotImplementedError("Restore the previous database backup to undo this reactivation.")
