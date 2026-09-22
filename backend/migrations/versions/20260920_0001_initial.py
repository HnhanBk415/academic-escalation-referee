"""Initial Academic Escalation Referee schema.

Revision ID: 20260920_0001
Revises:
"""

from alembic import op

from app.db.base import Base
from app import models  # noqa: F401


revision = "20260920_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())

