"""Conservative intake redaction before persistence, audit, or AI calls."""

import re
import unicodedata

_IDENTITY_NUMBER = re.compile(r"(?<!\d)\d{12}(?!\d)")
_EMAIL = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_PHONE = re.compile(r"(?<!\d)(?:\+?84|0)(?:[ .-]?\d){9,10}(?!\d)")
_HEALTH_TERMS = (
    "dau nguc", "kho tho", "ngat xiu", "trieu chung", "benh an", "chuan doan",
    "uong thuoc", "ke don", "cap cuu", "sot cao", "dau bung", "co giat",
    "chong mat", "buon non", "di ung", "chay mau", "ngua ran", "thuoc",
    "benh", "sot", "ho lien tuc", "dau dau", "dau hong", "dau rang",
)


def _fold(value: str) -> str:
    value = unicodedata.normalize("NFD", value.casefold())
    return "".join(char for char in value if unicodedata.category(char) != "Mn").replace("đ", "d")


def contains_health_details(value: str) -> bool:
    folded = _fold(value)
    return any(term in folded for term in _HEALTH_TERMS)


def redact_text(value: str) -> str:
    if contains_health_details(value):
        return "[NỘI DUNG SỨC KHỎE ĐÃ ẨN]"
    value = _IDENTITY_NUMBER.sub("[CCCD ĐÃ ẨN]", value)
    value = _EMAIL.sub("[EMAIL ĐÃ ẨN]", value)
    return _PHONE.sub("[SỐ ĐIỆN THOẠI ĐÃ ẨN]", value)


def redact_slots(slots: dict[str, str]) -> dict[str, str]:
    return {key: redact_text(value) for key, value in slots.items()}
