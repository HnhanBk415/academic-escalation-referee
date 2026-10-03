"""Persist escalation targets for questions and escalation cases.

Revision ID: 20261001_0004
Revises: 20260927_0003
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "20261001_0004"
down_revision = "20260927_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    question_columns = {item["name"] for item in inspector.get_columns("questions")}
    if "escalation_target" not in question_columns:
        op.add_column("questions", sa.Column("escalation_target", sa.String(40), nullable=True))
    question_indexes = {item["name"] for item in inspect(bind).get_indexes("questions")}
    if "ix_questions_escalation_target" not in question_indexes:
        op.create_index("ix_questions_escalation_target", "questions", ["escalation_target"])

    case_columns = {item["name"] for item in inspect(bind).get_columns("escalation_cases")}
    if "escalation_target" not in case_columns:
        op.add_column("escalation_cases", sa.Column("escalation_target", sa.String(40), nullable=True))
    case_indexes = {item["name"] for item in inspect(bind).get_indexes("escalation_cases")}
    if "ix_escalation_cases_escalation_target" not in case_indexes:
        op.create_index("ix_escalation_cases_escalation_target", "escalation_cases", ["escalation_target"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if "ix_escalation_cases_escalation_target" in {
        item["name"] for item in inspector.get_indexes("escalation_cases")
    }:
        op.drop_index("ix_escalation_cases_escalation_target", table_name="escalation_cases")
    case_columns = {item["name"] for item in inspector.get_columns("escalation_cases")}
    if "escalation_target" in case_columns:
        op.drop_column("escalation_cases", "escalation_target")

    if "ix_questions_escalation_target" in {
        item["name"] for item in inspector.get_indexes("questions")
    }:
        op.drop_index("ix_questions_escalation_target", table_name="questions")
    question_columns = {item["name"] for item in inspector.get_columns("questions")}
    if "escalation_target" in question_columns:
        op.drop_column("questions", "escalation_target")
