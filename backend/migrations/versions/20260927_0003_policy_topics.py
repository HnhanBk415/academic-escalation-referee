"""Persist semantic policy topics for questions and scoped exceptions.

Revision ID: 20260927_0003
Revises: 20260926_0002
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "20260927_0003"
down_revision = "20260926_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    question_columns = {item["name"] for item in inspector.get_columns("questions")}
    if "policy_topic" not in question_columns:
        op.add_column("questions", sa.Column("policy_topic", sa.String(100), nullable=True))
    question_indexes = {item["name"] for item in inspect(bind).get_indexes("questions")}
    if "ix_questions_policy_topic" not in question_indexes:
        op.create_index("ix_questions_policy_topic", "questions", ["policy_topic"])

    exception_columns = {
        item["name"] for item in inspect(bind).get_columns("policy_exceptions")
    }
    if "policy_topic" not in exception_columns:
        op.add_column(
            "policy_exceptions",
            sa.Column(
                "policy_topic",
                sa.String(100),
                nullable=False,
                server_default="GENERAL",
            ),
        )
    exception_indexes = {
        item["name"] for item in inspect(bind).get_indexes("policy_exceptions")
    }
    if "ix_policy_exceptions_policy_topic" not in exception_indexes:
        op.create_index(
            "ix_policy_exceptions_policy_topic",
            "policy_exceptions",
            ["policy_topic"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "ix_policy_exceptions_policy_topic" in {
        item["name"] for item in inspector.get_indexes("policy_exceptions")
    }:
        op.drop_index(
            "ix_policy_exceptions_policy_topic",
            table_name="policy_exceptions",
        )
    if "policy_topic" in {
        item["name"] for item in inspect(bind).get_columns("policy_exceptions")
    }:
        op.drop_column("policy_exceptions", "policy_topic")

    if "ix_questions_policy_topic" in {
        item["name"] for item in inspect(bind).get_indexes("questions")
    }:
        op.drop_index("ix_questions_policy_topic", table_name="questions")
    if "policy_topic" in {
        item["name"] for item in inspect(bind).get_columns("questions")
    }:
        op.drop_column("questions", "policy_topic")
