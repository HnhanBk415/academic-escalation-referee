import re
import unicodedata

POLICY_TOPICS = {
    "AI_AVAILABILITY",
    "AI_USAGE",
    "CAMPUS_LIFE",
    "COURSE_REGISTRATION",
    "GENERAL",
    "GRADE_APPEAL",
    "GRADING_RUBRIC",
    "GROUP_CONTEXT",
    "GROUP_MEMBERSHIP",
    "POLICY_VERSION",
    "SECURITY",
    "SUBMISSION_DEADLINE",
}

_ALIASES = {
    "AI_USE": "AI_USAGE",
    "CAMPUS_SERVICES": "CAMPUS_LIFE",
    "DEADLINE": "SUBMISSION_DEADLINE",
    "GRADE": "GRADE_APPEAL",
    "RUBRIC": "GRADING_RUBRIC",
    "GROUP_SIZE": "GROUP_MEMBERSHIP",
    "GROUP_MEMBERS": "GROUP_MEMBERSHIP",
    "GROUP_MEMBERSHIP_RULE": "GROUP_MEMBERSHIP",
    "REGISTRATION": "COURSE_REGISTRATION",
    "SCHOOL_ADMINISTRATION": "COURSE_REGISTRATION",
}


def canonical_policy_topic(value: str | None) -> str:
    normalized = re.sub(r"[^A-Z0-9]+", "_", (value or "").upper()).strip("_")
    normalized = _ALIASES.get(normalized, normalized)
    return normalized if normalized in POLICY_TOPICS else "GENERAL"


def _fold_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.casefold())
    unaccented = "".join(
        char for char in decomposed if unicodedata.category(char) != "Mn"
    )
    unaccented = unaccented.replace("đ", "d")
    return re.sub(r"\s+", " ", unaccented).strip()


def infer_policy_topic(text: str) -> str:
    """Map natural phrasing to a small, shared policy-topic vocabulary."""
    topics = policy_topics_in_text(text)
    for topic in (
        "SECURITY",
        "GRADE_APPEAL",
        "SUBMISSION_DEADLINE",
        "AI_USAGE",
        "CAMPUS_LIFE",
        "COURSE_REGISTRATION",
        "GROUP_MEMBERSHIP",
        "GRADING_RUBRIC",
    ):
        if topic in topics:
            return topic
    return "GENERAL"


def policy_topics_in_text(text: str) -> set[str]:
    """Return every canonical topic visibly described by text or evidence."""
    folded = _fold_text(text)
    topics: set[str] = set()
    if any(token in folded for token in ("ignore previous", "system prompt", "developer message")):
        topics.add("SECURITY")
    if any(
        token in folded
        for token in ("thanh vien", "nhom", "team", "group", "sau nguoi", "sau thanh vien")
    ) or re.search(r"\b\d+\s+nguoi\b", folded):
        topics.add("GROUP_MEMBERSHIP")
    if any(
        token in folded
        for token in ("han nop", "deadline", "nop bai", "nop tre", "gia han", "tre han")
    ):
        topics.add("SUBMISSION_DEADLINE")
    if any(
        token in folded
        for token in ("tri tue nhan tao", "artificial intelligence", "dung ai", "su dung ai")
    ) or re.search(r"\bai\b", folded):
        topics.add("AI_USAGE")
    if any(
        token in folded
        for token in (
            "phuc khao",
            "doi diem",
            "xem xet lai diem",
            "diem da cong bo",
            "grade appeal",
        )
    ):
        topics.add("GRADE_APPEAL")
    if any(token in folded for token in ("rubric", "tieu chi", "co cau diem", "cham diem", "diem")):
        topics.add("GRADING_RUBRIC")
    if any(
        token in folded
        for token in ("ky tuc xa", "gui xe", "hoc phi", "can tin", "dich vu khuon vien")
    ):
        topics.add("CAMPUS_LIFE")
    if any(
        token in folded
        for token in (
            "rut hoc phan",
            "huy hoc phan",
            "huy mon",
            "bao luu",
            "mien hoc phan",
            "dang ky hoc phan",
        )
    ):
        topics.add("COURSE_REGISTRATION")
    return topics or {"GENERAL"}


def resolve_policy_topic(text: str, proposed_topic: str | None) -> str:
    inferred = infer_policy_topic(text)
    if inferred != "GENERAL":
        return inferred
    return canonical_policy_topic(proposed_topic)
