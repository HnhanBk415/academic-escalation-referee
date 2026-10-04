"""Add lecturer-approved report-format criteria and ambiguous-review retention.

Revision ID: 20261003_0006
Revises: 20261002_0005
"""

from alembic import op

from app.models.entities import (
    FormatCheckMetric,
    FormatCriteriaSet,
    FormatCriterion,
    FormatReviewCase,
)

revision = "20261003_0006"
down_revision = "20261002_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    for table in (
        FormatCriteriaSet.__table__,
        FormatCriterion.__table__,
        FormatReviewCase.__table__,
        FormatCheckMetric.__table__,
    ):
        table.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table in (
        FormatCheckMetric.__table__,
        FormatReviewCase.__table__,
        FormatCriterion.__table__,
        FormatCriteriaSet.__table__,
    ):
        table.drop(bind=bind, checkfirst=True)
