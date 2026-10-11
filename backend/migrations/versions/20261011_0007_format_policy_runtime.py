"""Add report-profile selection and immutable pre-check policy snapshots.

Revision ID: 20261011_0007
Revises: 20261003_0006
"""

import sqlalchemy as sa
from alembic import op

from app.models.entities import FormatCheckRun

revision = "20261011_0007"
down_revision = "20261003_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("format_criteria_sets", sa.Column("semester", sa.String(length=32), nullable=True))
    op.add_column(
        "format_criteria_sets",
        sa.Column("report_type", sa.String(length=80), nullable=False, server_default="default"),
    )
    op.add_column(
        "format_criteria_sets",
        sa.Column("policy_id", sa.String(length=160), nullable=False, server_default="legacy"),
    )
    op.add_column(
        "format_criteria_sets",
        sa.Column("policy_version", sa.String(length=40), nullable=False, server_default="1.0.0"),
    )
    op.add_column("format_criteria_sets", sa.Column("template_hash", sa.String(length=64), nullable=True))

    # Existing criteria were scoped by course, whose semester is already canonical.
    op.execute(
        "UPDATE format_criteria_sets AS f SET semester = c.semester "
        "FROM courses AS c WHERE c.id = f.course_id"
    )
    op.alter_column("format_criteria_sets", "semester", nullable=False)
    op.drop_constraint("uq_format_criteria_sets_course_id", "format_criteria_sets", type_="unique")
    op.create_unique_constraint(
        "uq_format_criteria_sets_course_semester_report_version",
        "format_criteria_sets",
        ["course_id", "semester", "report_type", "version"],
    )
    op.create_index("ix_format_criteria_sets_semester", "format_criteria_sets", ["semester"])
    op.create_index("ix_format_criteria_sets_report_type", "format_criteria_sets", ["report_type"])
    op.create_index("ix_format_criteria_sets_policy_id", "format_criteria_sets", ["policy_id"])
    op.alter_column("format_criteria_sets", "report_type", server_default=None)
    op.alter_column("format_criteria_sets", "policy_id", server_default=None)
    op.alter_column("format_criteria_sets", "policy_version", server_default=None)

    FormatCheckRun.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    FormatCheckRun.__table__.drop(bind=op.get_bind(), checkfirst=True)
    op.drop_index("ix_format_criteria_sets_policy_id", table_name="format_criteria_sets")
    op.drop_index("ix_format_criteria_sets_report_type", table_name="format_criteria_sets")
    op.drop_index("ix_format_criteria_sets_semester", table_name="format_criteria_sets")
    op.drop_constraint(
        "uq_format_criteria_sets_course_semester_report_version",
        "format_criteria_sets",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_format_criteria_sets_course_id", "format_criteria_sets", ["course_id", "version"]
    )
    op.drop_column("format_criteria_sets", "template_hash")
    op.drop_column("format_criteria_sets", "policy_version")
    op.drop_column("format_criteria_sets", "policy_id")
    op.drop_column("format_criteria_sets", "report_type")
    op.drop_column("format_criteria_sets", "semester")
