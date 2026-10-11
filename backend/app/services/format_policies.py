"""Load versioned Flow-2 policy files into the runtime criteria store."""

import re
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import (
    FormatCriteriaSetStatus,
    FormatCriterionRuleType,
    FormatRuleHandling,
    FormatUnableAction,
)
from app.core.errors import AppError
from app.models import Course, Document, FormatCriteriaSet, FormatCriterion
from app.services.audit import add_audit_event
from app.services.ids import new_id


def _find_policy_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / "data" / "policies"
        if candidate.is_dir():
            return candidate
    return current.parents[3] / "data" / "policies"


def _policy_files() -> list[Path]:
    return sorted(
        path
        for path in _find_policy_root().glob("*/*.yaml")
        if path.name != "course-semester-policy.template.yaml"
    )


def _as_mapping(value: Any, field: str, file_path: Path) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise AppError(
            "FORMAT_POLICY_INVALID",
            f"Policy {file_path.name} có trường '{field}' không hợp lệ.",
            status_code=422,
        )
    return value


_SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+$")
_REPORT_TYPE_RE = re.compile(r"^[a-z][a-z0-9_]*$")
_RULE_ID_RE = re.compile(r"^FMT-[A-Z0-9-]+$")
_SHA256_RE = re.compile(r"^[a-f0-9]{64}$")


def _invalid(file_path: Path, message: str) -> AppError:
    return AppError("FORMAT_POLICY_INVALID", f"Policy {file_path.name}: {message}", status_code=422)


def _require_non_empty_string(value: Any, field: str, file_path: Path) -> str:
    if not isinstance(value, str) or not value.strip():
        raise _invalid(file_path, f"'{field}' phải là chuỗi không rỗng.")
    return value.strip()


def validate_format_policy_document(raw: Any, file_path: Path) -> dict[str, Any]:
    """Validate the policy contract before it can affect runtime checks.

    The JSON Schema remains the portable contract for editors and CI. This validator
    mirrors the operational invariants that the runtime additionally needs, without
    requiring a second schema-validation dependency inside the API container.
    """

    policy = _as_mapping(raw, "root", file_path)
    if policy.get("schema_version") != "1.0":
        raise _invalid(file_path, "'schema_version' phải là '1.0'.")
    if policy.get("kind") != "course_semester_format_policy":
        raise _invalid(file_path, "'kind' không hợp lệ.")
    _require_non_empty_string(policy.get("policy_id"), "policy_id", file_path)
    version = _require_non_empty_string(policy.get("version"), "version", file_path)
    if not _SEMVER_RE.fullmatch(version):
        raise _invalid(file_path, "'version' phải theo định dạng semantic version (x.y.z).")
    try:
        FormatCriteriaSetStatus(policy.get("status"))
    except (TypeError, ValueError) as error:
        raise _invalid(file_path, "'status' phải là DRAFT, ACTIVE hoặc SUPERSEDED.") from error

    scope = _as_mapping(policy.get("scope"), "scope", file_path)
    _require_non_empty_string(scope.get("course_id"), "scope.course_id", file_path)
    _require_non_empty_string(scope.get("semester"), "scope.semester", file_path)
    owner = _as_mapping(policy.get("owner"), "owner", file_path)
    _require_non_empty_string(owner.get("lecturer_id"), "owner.lecturer_id", file_path)

    selection = _as_mapping(policy.get("selection"), "selection", file_path)
    if selection.get("mode") != "AUTO_COURSE_SEMESTER_THEN_REPORT_TYPE":
        raise _invalid(file_path, "selection.mode phải là AUTO_COURSE_SEMESTER_THEN_REPORT_TYPE.")
    _require_non_empty_string(selection.get("report_type_label"), "selection.report_type_label", file_path)
    prompt_limit = selection.get("prompt_when_active_profiles_greater_than", 1)
    if not isinstance(prompt_limit, int) or prompt_limit < 1:
        raise _invalid(file_path, "selection.prompt_when_active_profiles_greater_than phải là số nguyên dương.")

    source_documents = policy.get("source_documents", [])
    if not isinstance(source_documents, list):
        raise _invalid(file_path, "source_documents phải là danh sách.")
    source_document_ids: set[str] = set()
    source_document_checksums: dict[str, str] = {}
    workspace_root = _find_policy_root().parent.parent.resolve()
    for index, raw_document in enumerate(source_documents, start=1):
        document = _as_mapping(raw_document, f"source_documents[{index}]", file_path)
        document_id = _require_non_empty_string(document.get("document_id"), f"source_documents[{index}].document_id", file_path)
        if document_id in source_document_ids:
            raise _invalid(file_path, f"document_id '{document_id}' bị lặp trong source_documents.")
        source_document_ids.add(document_id)
        _require_non_empty_string(document.get("path"), f"source_documents[{index}].path", file_path)
        _require_non_empty_string(document.get("version"), f"source_documents[{index}].version", file_path)
        checksum = _require_non_empty_string(document.get("sha256"), f"source_documents[{index}].sha256", file_path)
        if not _SHA256_RE.fullmatch(checksum):
            raise _invalid(file_path, f"source_documents[{index}].sha256 phải là SHA-256 chữ thường gồm 64 ký tự.")
        source_path = Path(_require_non_empty_string(document.get("path"), f"source_documents[{index}].path", file_path))
        if source_path.is_absolute():
            raise _invalid(file_path, f"source_documents[{index}].path phải là đường dẫn tương đối trong workspace.")
        resolved_source_path = (workspace_root / source_path).resolve()
        try:
            resolved_source_path.relative_to(workspace_root)
        except ValueError as error:
            raise _invalid(file_path, f"source_documents[{index}].path không được đi ra ngoài workspace.") from error
        if not resolved_source_path.is_file():
            raise _invalid(file_path, f"không tìm thấy source_documents[{index}].path: {source_path}.")
        if sha256(resolved_source_path.read_bytes()).hexdigest() != checksum:
            raise _invalid(file_path, f"checksum của source_documents[{index}] không khớp với file nguồn.")
        source_document_checksums[document_id] = checksum

    profiles = policy.get("report_profiles")
    if not isinstance(profiles, list) or not profiles:
        raise _invalid(file_path, "report_profiles phải có ít nhất một profile.")
    report_types: set[str] = set()
    rule_ids: set[str] = set()
    active_profile_count = 0
    for profile_index, raw_profile in enumerate(profiles, start=1):
        profile = _as_mapping(raw_profile, f"report_profiles[{profile_index}]", file_path)
        report_type = _require_non_empty_string(profile.get("report_type"), f"report_profiles[{profile_index}].report_type", file_path)
        if not _REPORT_TYPE_RE.fullmatch(report_type):
            raise _invalid(file_path, f"report_type '{report_type}' không đúng định dạng.")
        if report_type in report_types:
            raise _invalid(file_path, f"report_type '{report_type}' bị lặp.")
        report_types.add(report_type)
        _require_non_empty_string(profile.get("label"), f"report_profiles[{profile_index}].label", file_path)
        try:
            profile_status = FormatCriteriaSetStatus(profile.get("status"))
        except (TypeError, ValueError) as error:
            raise _invalid(file_path, f"status của profile '{report_type}' không hợp lệ.") from error
        if profile_status == FormatCriteriaSetStatus.ACTIVE:
            active_profile_count += 1

        template = _as_mapping(profile.get("template"), f"report_profiles[{profile_index}].template", file_path)
        template_document_id = template.get("source_document_id")
        if template_document_id is not None and str(template_document_id) not in source_document_ids:
            raise _invalid(file_path, f"template của '{report_type}' tham chiếu document không nằm trong source_documents.")
        template_checksum = template.get("sha256")
        if template_checksum is not None and (not isinstance(template_checksum, str) or not _SHA256_RE.fullmatch(template_checksum)):
            raise _invalid(file_path, f"template.sha256 của '{report_type}' phải là SHA-256 chữ thường gồm 64 ký tự hoặc null.")
        if template_document_id and template_checksum and template_checksum != source_document_checksums[str(template_document_id)]:
            raise _invalid(file_path, f"template.sha256 của '{report_type}' không khớp checksum tài liệu nguồn.")

        rules = profile.get("rules")
        if not isinstance(rules, list):
            raise _invalid(file_path, f"rules của profile '{report_type}' phải là danh sách.")
        if profile_status == FormatCriteriaSetStatus.ACTIVE and not rules:
            raise _invalid(file_path, f"profile ACTIVE '{report_type}' phải có ít nhất một rule.")
        for rule_index, raw_rule in enumerate(rules, start=1):
            rule = _as_mapping(raw_rule, f"rules[{rule_index}]", file_path)
            rule_id = _require_non_empty_string(rule.get("rule_id"), f"rule_id của '{report_type}'", file_path)
            if not _RULE_ID_RE.fullmatch(rule_id):
                raise _invalid(file_path, f"rule_id '{rule_id}' không đúng định dạng FMT-... .")
            if rule_id in rule_ids:
                raise _invalid(file_path, f"rule_id '{rule_id}' bị lặp giữa các profile.")
            rule_ids.add(rule_id)
            _require_non_empty_string(rule.get("title"), f"title của rule '{rule_id}'", file_path)
            _require_non_empty_string(rule.get("description"), f"description của rule '{rule_id}'", file_path)
            try:
                FormatCriterionRuleType(rule.get("rule_type"))
                handling = FormatRuleHandling(rule.get("handling"))
                unable_action = FormatUnableAction(rule.get("when_unable_to_check"))
            except (TypeError, ValueError) as error:
                raise _invalid(file_path, f"rule '{rule_id}' có rule_type, handling hoặc when_unable_to_check không hợp lệ.") from error
            automation = rule.get("automation")
            if automation not in {"automatic", "manual"}:
                raise _invalid(file_path, f"rule '{rule_id}' có automation không hợp lệ.")
            if automation == "manual" and handling != FormatRuleHandling.MANUAL_REVIEW and unable_action != FormatUnableAction.NEEDS_REVIEW:
                raise _invalid(file_path, f"rule manual '{rule_id}' phải dẫn đến NEEDS_REVIEW hoặc dùng handling MANUAL_REVIEW.")
            expected = rule.get("expected")
            if not isinstance(expected, dict) or not expected:
                raise _invalid(file_path, f"rule '{rule_id}' phải có expected là object không rỗng.")
            source = _as_mapping(rule.get("source"), f"source của rule '{rule_id}'", file_path)
            rule_document_id = _require_non_empty_string(source.get("document_id"), f"source.document_id của rule '{rule_id}'", file_path)
            if rule_document_id not in source_document_ids:
                raise _invalid(file_path, f"rule '{rule_id}' tham chiếu document không nằm trong source_documents.")
            _require_non_empty_string(source.get("citation"), f"source.citation của rule '{rule_id}'", file_path)

    if policy.get("status") == FormatCriteriaSetStatus.ACTIVE and active_profile_count == 0:
        raise _invalid(file_path, "policy ACTIVE phải có ít nhất một report profile ACTIVE.")
    return policy


def _parse_activated_at(value: Any) -> datetime:
    if not value:
        return datetime.now(UTC)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError as error:
        raise AppError(
            "FORMAT_POLICY_INVALID",
            "owner.activated_at phải có định dạng ISO-8601.",
            status_code=422,
        ) from error


async def sync_format_policies(session: AsyncSession) -> int:
    """Import each unseen `policy_id + version + report_type` exactly once.

    Policy versions are immutable: editing a YAML file without raising its version does
    not rewrite historical runtime data or prior check snapshots.
    """

    imported = 0
    for file_path in _policy_files():
        raw = yaml.safe_load(file_path.read_text(encoding="utf-8"))
        policy = validate_format_policy_document(raw, file_path)

        scope = _as_mapping(policy.get("scope"), "scope", file_path)
        course_id = str(scope.get("course_id", ""))
        semester = str(scope.get("semester", ""))
        policy_id = str(policy.get("policy_id", ""))
        policy_version = str(policy.get("version", ""))
        owner = _as_mapping(policy.get("owner"), "owner", file_path)
        lecturer_id = str(owner.get("lecturer_id", ""))
        if not all((course_id, semester, policy_id, policy_version, lecturer_id)):
            raise AppError(
                "FORMAT_POLICY_INVALID",
                f"Policy {file_path.name} thiếu scope, version hoặc owner.",
                status_code=422,
            )
        course = await session.get(Course, course_id)
        if course is None or course.semester != semester:
            raise AppError(
                "FORMAT_POLICY_SCOPE_INVALID",
                f"Policy {file_path.name} không khớp môn/học kỳ đã cấu hình.",
                status_code=422,
            )

        source_documents = policy.get("source_documents", [])
        if not isinstance(source_documents, list):
            raise AppError("FORMAT_POLICY_INVALID", "source_documents phải là danh sách.", status_code=422)
        source_document_ids = [
            str(item["document_id"])
            for item in source_documents
            if isinstance(item, dict) and item.get("document_id")
        ]
        if source_document_ids:
            known_source_document_ids = set(
                (
                    await session.scalars(
                        select(Document.id).where(
                            Document.id.in_(source_document_ids),
                            Document.course_id == course_id,
                        )
                    )
                ).all()
            )
            missing_source_ids = sorted(set(source_document_ids) - known_source_document_ids)
            if missing_source_ids:
                raise AppError(
                    "FORMAT_POLICY_SOURCE_DOCUMENT_NOT_FOUND",
                    f"Policy {file_path.name} tham chiếu tài liệu không thuộc học phần: {', '.join(missing_source_ids)}.",
                    status_code=422,
                )
        profiles = policy.get("report_profiles", [])
        if not isinstance(profiles, list):
            raise AppError("FORMAT_POLICY_INVALID", "report_profiles phải là danh sách.", status_code=422)

        for raw_profile in profiles:
            profile = _as_mapping(raw_profile, "report_profiles[]", file_path)
            report_type = str(profile.get("report_type", ""))
            status_value = str(profile.get("status", "DRAFT"))
            if not report_type:
                raise AppError("FORMAT_POLICY_INVALID", "report_type không được để trống.", status_code=422)
            try:
                status = FormatCriteriaSetStatus(status_value)
            except ValueError as error:
                raise AppError("FORMAT_POLICY_INVALID", "status profile không hợp lệ.", status_code=422) from error
            existing = await session.scalar(
                select(FormatCriteriaSet).where(
                    FormatCriteriaSet.policy_id == policy_id,
                    FormatCriteriaSet.policy_version == policy_version,
                    FormatCriteriaSet.report_type == report_type,
                )
            )
            if existing is not None:
                continue

            next_version = int(
                await session.scalar(
                    select(func.coalesce(func.max(FormatCriteriaSet.version), 0)).where(
                        FormatCriteriaSet.course_id == course_id,
                        FormatCriteriaSet.semester == semester,
                        FormatCriteriaSet.report_type == report_type,
                    )
                )
                or 0
            ) + 1
            template = profile.get("template") or {}
            template_hash = template.get("sha256") if isinstance(template, dict) else None
            criteria_set = FormatCriteriaSet(
                id=new_id("format_set"),
                course_id=course_id,
                semester=semester,
                report_type=report_type,
                version=next_version,
                policy_id=policy_id,
                policy_version=policy_version,
                template_hash=str(template_hash) if template_hash else None,
                title=str(profile.get("label", report_type)),
                status=status,
                source_document_ids=source_document_ids,
                created_by=lecturer_id,
                approved_by=lecturer_id if status == FormatCriteriaSetStatus.ACTIVE else None,
                approved_at=_parse_activated_at(owner.get("activated_at"))
                if status == FormatCriteriaSetStatus.ACTIVE
                else None,
            )
            if status == FormatCriteriaSetStatus.ACTIVE:
                previous = (
                    await session.scalars(
                        select(FormatCriteriaSet).where(
                            FormatCriteriaSet.course_id == course_id,
                            FormatCriteriaSet.semester == semester,
                            FormatCriteriaSet.report_type == report_type,
                            FormatCriteriaSet.status == FormatCriteriaSetStatus.ACTIVE,
                        )
                    )
                ).all()
                for item in previous:
                    item.status = FormatCriteriaSetStatus.SUPERSEDED
            session.add(criteria_set)
            rules = profile.get("rules", [])
            if not isinstance(rules, list):
                raise AppError("FORMAT_POLICY_INVALID", "rules phải là danh sách.", status_code=422)
            for position, raw_rule in enumerate(rules, start=1):
                rule = _as_mapping(raw_rule, "rules[]", file_path)
                source = rule.get("source") or {}
                source_mapping = _as_mapping(source, "rule.source", file_path)
                automation = str(rule.get("automation", "manual"))
                session.add(
                    FormatCriterion(
                        id=new_id("format_criterion"),
                        criteria_set_id=criteria_set.id,
                        position=position,
                        name=str(rule.get("title", "")),
                        description=str(rule.get("description", "")),
                        rule_type=str(rule.get("rule_type", "")),
                        handling=str(rule.get("handling", "BLOCKING")),
                        when_unable_to_check=str(rule.get("when_unable_to_check", "UNABLE_TO_CHECK")),
                        expected_value=_as_mapping(rule.get("expected"), "rule.expected", file_path),
                        source_citation=str(source_mapping.get("citation", "")) or None,
                        source_document_id=str(source_mapping.get("document_id", "")) or None,
                        automatable=automation == "automatic",
                        review_only=automation != "automatic" or rule.get("handling") == "MANUAL_REVIEW",
                    )
                )
            add_audit_event(
                session,
                event_type="FORMAT_POLICY_IMPORTED",
                actor_id=lecturer_id,
                entity_type="format_criteria_set",
                entity_id=criteria_set.id,
                output_snapshot={
                    "policy_id": policy_id,
                    "policy_version": policy_version,
                    "report_type": report_type,
                    "source_file": str(file_path.relative_to(_find_policy_root().parent)),
                },
            )
            imported += 1
    return imported
