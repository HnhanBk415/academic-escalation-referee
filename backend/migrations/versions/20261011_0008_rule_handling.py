"""Add Flow-2 rule handling and needs-review metrics.

Revision ID: 20261011_0008
Revises: 20261011_0007
"""

import sqlalchemy as sa
from alembic import op

revision = "20261011_0008"
down_revision = "20261011_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "format_criteria",
        sa.Column("handling", sa.String(length=20), nullable=False, server_default="BLOCKING"),
    )
    op.add_column(
        "format_criteria",
        sa.Column(
            "when_unable_to_check",
            sa.String(length=30),
            nullable=False,
            server_default="UNABLE_TO_CHECK",
        ),
    )
    op.create_index("ix_format_criteria_handling", "format_criteria", ["handling"])
    op.alter_column("format_criteria", "handling", server_default=None)
    op.alter_column("format_criteria", "when_unable_to_check", server_default=None)
    op.add_column(
        "format_check_metrics",
        sa.Column("needs_review_checks", sa.Integer(), nullable=False, server_default="0"),
    )
    op.alter_column("format_check_metrics", "needs_review_checks", server_default=None)


def downgrade() -> None:
    op.drop_column("format_check_metrics", "needs_review_checks")
    op.drop_index("ix_format_criteria_handling", table_name="format_criteria")
    op.drop_column("format_criteria", "when_unable_to_check")
    op.drop_column("format_criteria", "handling")
