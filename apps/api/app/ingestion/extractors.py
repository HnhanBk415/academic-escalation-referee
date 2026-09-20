from pathlib import Path

from pypdf import PdfReader

from app.core.errors import AppError


def extract_text(path: Path, document_type: str) -> str:
    if document_type in {"MARKDOWN", "TXT"}:
        return path.read_text(encoding="utf-8")
    if document_type == "PDF":
        reader = PdfReader(path)
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n\n".join(pages).strip()
        if not text:
            raise AppError(
                "UNSUPPORTED_SCAN",
                "PDF không có lớp văn bản; OCR nằm ngoài phạm vi Sprint 1.",
                status_code=422,
            )
        return text
    raise AppError("UNSUPPORTED_DOCUMENT_TYPE", "Định dạng tài liệu không được hỗ trợ.")
