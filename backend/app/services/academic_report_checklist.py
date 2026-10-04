"""Academic Report Formatting Checklist Engine.

Implements the 30-category academic report formatting checklist:
1. Extract checklist criteria from regulation documents (populate what is specified, leave blank what is not).
2. Extract corresponding formatting & structural facts from student reports (.docx / .pdf).
3. Evaluate report facts against criteria using hybrid deterministic rules + AI semantic reasoning.
"""

from __future__ import annotations

import io
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

from docx import Document as DocxDocument
from docx.enum.text import WD_ALIGN_PARAGRAPH
from pypdf import PdfReader

from app.core.enums import (
    FormatCheckOverallStatus,
    FormatCriterionResultStatus,
    FormatCriterionRuleType,
)
from app.schemas.format_checks import (
    FormatCriterionInput,
    FormatCriterionResult,
)


def _fold(value: str) -> str:
    """Normalize and fold string for accent-insensitive comparison."""
    normalized = unicodedata.normalize("NFKD", value)
    without_marks = "".join(char for char in normalized if not unicodedata.combining(char))
    return without_marks.casefold().strip()


def _clean_font_name(font_raw: str) -> str:
    cleaned = re.sub(r"^[A-Z]{6}\+", "", font_raw)
    cleaned = cleaned.replace("-", " ").replace("_", " ")
    for suffix in ("Bold", "Italic", "Regular", "MT", "PSMT"):
        cleaned = re.sub(rf"\b{suffix}\b", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip() or font_raw.strip()


# ─────────────────────────────────────────────────────────────────────────────
# 30 MASTER CHECKLIST CATEGORIES METADATA
# ─────────────────────────────────────────────────────────────────────────────

CHECKLIST_30_CATEGORIES: list[dict[str, Any]] = [
    {"index": 1, "code": "page_setup", "name": "Khổ giấy và thiết lập trang"},
    {"index": 2, "code": "typography", "name": "Font chữ và cỡ chữ"},
    {"index": 3, "code": "paragraph_format", "name": "Định dạng đoạn văn"},
    {"index": 4, "code": "heading_structure", "name": "Heading / tiêu đề chương, mục"},
    {"index": 5, "code": "numbering", "name": "Đánh số chương và mục"},
    {"index": 6, "code": "cover_page", "name": "Trang bìa"},
    {"index": 7, "code": "front_matter", "name": "Trang phụ và lời cam đoan"},
    {"index": 8, "code": "table_of_contents", "name": "Mục lục"},
    {"index": 9, "code": "list_of_figures", "name": "Danh mục hình"},
    {"index": 10, "code": "list_of_tables", "name": "Danh mục bảng"},
    {"index": 11, "code": "list_of_abbreviations", "name": "Danh mục từ viết tắt"},
    {"index": 12, "code": "figures", "name": "Hình ảnh và đồ thị"},
    {"index": 13, "code": "tables", "name": "Bảng biểu"},
    {"index": 14, "code": "equations", "name": "Công thức toán học"},
    {"index": 15, "code": "header_footer", "name": "Header và Footer"},
    {"index": 16, "code": "page_numbering", "name": "Đánh số trang"},
    {"index": 17, "code": "section_breaks", "name": "Section / Page Break"},
    {"index": 18, "code": "layout_spacing", "name": "Khoảng cách và bố cục trang"},
    {"index": 19, "code": "references", "name": "Tài liệu tham khảo"},
    {"index": 20, "code": "in_text_citations", "name": "Trích dẫn trong nội dung"},
    {"index": 21, "code": "terminology", "name": "Thuật ngữ và viết tắt"},
    {"index": 22, "code": "spelling_grammar", "name": "Chính tả và lỗi đánh máy"},
    {"index": 23, "code": "consistency", "name": "Tính nhất quán toàn báo cáo"},
    {"index": 24, "code": "overall_structure", "name": "Kiểm tra cấu trúc tổng thể"},
    {"index": 25, "code": "appendices", "name": "Phụ lục"},
    {"index": 26, "code": "cross_references", "name": "Kiểm tra liên kết chéo"},
    {"index": 27, "code": "word_quality", "name": "Kỹ thuật Word / Styles"},
    {"index": 28, "code": "pdf_export", "name": "Kiểm tra khi xuất PDF"},
    {"index": 29, "code": "file_naming", "name": "Kiểm tra tên file"},
    {"index": 30, "code": "final_summary", "name": "Bảng tổng hợp kiểm tra"},
]


# ─────────────────────────────────────────────────────────────────────────────
# 1. TRÍCH ĐỂ TẠO CHECKLIST TỪ QUY ĐỊNH
#    "cái nào có thì nạp, không có bỏ trống"
# ─────────────────────────────────────────────────────────────────────────────

def extract_checklist_from_regulations(
    chunks: list[dict[str, Any]],
    template_headings: list[str] | None = None,
) -> list[FormatCriterionInput]:
    """Scan regulation text chunks against the 30 checklist items.

    Only items explicitly specified in the regulation document are populated.
    Items without regulation statements are left empty / omitted.
    """
    criteria: list[FormatCriterionInput] = []
    seen_codes: set[str] = set()

    # Combine text for holistic scanning while keeping chunk references
    full_text = "\n\n".join(c.get("content", "") for c in chunks)
    first_doc_id = chunks[0].get("document_id") if chunks else None

    def _find_citation(pattern: str) -> tuple[str, str | None]:
        for c in chunks:
            text = c.get("content", "")
            if re.search(pattern, text, flags=re.IGNORECASE):
                return text.strip()[:600], c.get("document_id")
        return "", first_doc_id

    # 1. Khổ giấy và Căn lề (page_setup)
    if re.search(r"khổ\s+giấy|căn\s+lề|lề\s+trên|lề\s+dưới|lề\s+trái|lề\s+phải", full_text, flags=re.IGNORECASE):
        margins: dict[str, float] = {}
        for side, pat in (
            ("top", r"lề\s+trên(?:\s*\(top\))?\D{0,25}(\d+(?:[.,]\d+)?)\s*cm"),
            ("bottom", r"lề\s+dưới(?:\s*\(bottom\))?\D{0,25}(\d+(?:[.,]\d+)?)\s*cm"),
            ("left", r"lề\s+trái(?:\s*\(left[^\)]*\))?\D{0,25}(\d+(?:[.,]\d+)?)\s*cm"),
            ("right", r"lề\s+phải(?:\s*\(right\))?\D{0,25}(\d+(?:[.,]\d+)?)\s*cm"),
        ):
            m = re.search(pat, full_text, flags=re.IGNORECASE)
            if m:
                margins[side] = float(m.group(1).replace(",", "."))
        if not margins:
            margins = {"top": 2.5, "bottom": 2.5, "left": 3.0, "right": 2.0}
        else:
            margins.setdefault("top", 2.5)
            margins.setdefault("bottom", 2.5)
            margins.setdefault("left", 3.0)
            margins.setdefault("right", 2.0)

        paper_a4 = bool(re.search(r"\bA4\b|210\s*x\s*297", full_text, flags=re.IGNORECASE))
        citation, doc_id = _find_citation(r"khổ\s+giấy|căn\s+lề|lề\s+trái")
        seen_codes.add("page_setup")
        criteria.append(
            FormatCriterionInput(
                name="1. Khổ giấy và thiết lập căn lề",
                description=(
                    f"Khổ giấy {'A4 tiêu chuẩn (210x297mm)' if paper_a4 else 'theo quy định'}, "
                    f"căn lề: trên {margins['top']}cm, dưới {margins['bottom']}cm, "
                    f"trái {margins['left']}cm, phải {margins['right']}cm, hướng giấy dọc (Portrait)."
                ),
                rule_type=FormatCriterionRuleType.MEASUREMENT,
                expected_value={
                    "property": "margins_cm",
                    "value": margins,
                    "paper_size": "A4" if paper_a4 else None,
                    "orientation": "PORTRAIT",
                    "tolerance": 0.15,
                    "category": "1. Khổ giấy và thiết lập trang",
                },
                source_citation=citation,
                source_document_id=doc_id,
            )
        )

    # 2. Phông chữ và cỡ chữ (typography)
    if re.search(r"phông\s+chữ|times\s+new\s+roman|cỡ\s+chữ|font\s+size", full_text, flags=re.IGNORECASE):
        font_name = "Times New Roman"
        if re.search(r"\barial\b", full_text, flags=re.IGNORECASE) and not re.search(r"times\s+new\s+roman", full_text, flags=re.IGNORECASE):
            font_name = "Arial"
        size_m = re.search(r"(?:cỡ\s+chữ|font\s+size)\D{0,25}(\d+(?:[.,]\d+)?)\s*pt", full_text, flags=re.IGNORECASE)
        font_size = float(size_m.group(1).replace(",", ".")) if size_m else 13.0
        citation, doc_id = _find_citation(r"phông\s+chữ|times\s+new\s+roman|cỡ\s+chữ")
        seen_codes.add("typography")
        criteria.append(
            FormatCriterionInput(
                name="2. Phông chữ và cỡ chữ nội dung",
                description=f"Sử dụng phông chữ Unicode {font_name}, cỡ chữ phần thân {font_size} pt.",
                rule_type=FormatCriterionRuleType.MEASUREMENT,
                expected_value={
                    "property": "font_name",
                    "value": font_name,
                    "font_size_pt": font_size,
                    "tolerance": 0.5,
                    "category": "2. Phông chữ và cỡ chữ",
                },
                source_citation=citation,
                source_document_id=doc_id,
            )
        )

    # 3. Định dạng đoạn văn (paragraph_format)
    if re.search(r"giãn\s+dòng|khoảng\s+cách\s+dòng|line\s+spacing|khoảng\s+cách\s+đoạn|căn\s+đều", full_text, flags=re.IGNORECASE):
        spacing_m = re.search(r"(?:khoảng\s+cách\s+dòng|giãn\s+dòng|line\s+spacing)\D{0,25}(\d+(?:[.,]\d+)?)", full_text, flags=re.IGNORECASE)
        line_spacing = float(spacing_m.group(1).replace(",", ".")) if spacing_m else 1.3
        justify_req = bool(re.search(r"căn\s+đều|justify", full_text, flags=re.IGNORECASE))
        citation, doc_id = _find_citation(r"giãn\s+dòng|khoảng\s+cách\s+dòng|line\s+spacing")
        seen_codes.add("paragraph_format")
        criteria.append(
            FormatCriterionInput(
                name="3. Định dạng đoạn văn và giãn dòng",
                description=(
                    f"Khoảng cách dòng (line spacing) {line_spacing} lines. "
                    f"{'Nội dung chính căn đều hai bên (Justify).' if justify_req else 'Định dạng đoạn văn đồng nhất.'}"
                ),
                rule_type=FormatCriterionRuleType.MEASUREMENT,
                expected_value={
                    "property": "line_spacing",
                    "value": line_spacing,
                    "justify": justify_req,
                    "tolerance": 0.15,
                    "category": "3. Định dạng đoạn văn",
                },
                source_citation=citation,
                source_document_id=doc_id,
            )
        )

    # 4 & 5. Cấu trúc tiêu đề chương mục & Đánh số (heading_structure, numbering)
    if re.search(r"chương\s+\d|đề\s+mục|tiêu\s+đề|heading", full_text, flags=re.IGNORECASE) or template_headings:
        headings = template_headings or []
        if not headings:
            # Extract standard headings from regulation text
            raw_headings = re.findall(r"(?:###|##|\bChương\s+\d+[:\.]?)\s*([^\n\r]+)", full_text)
            headings = [h.strip() for h in raw_headings if len(h.strip()) > 3][:15]
        if headings:
            citation, doc_id = _find_citation(r"cấu\s+trúc|khung\s+đề\s+cương|chương\s+\d")
            seen_codes.add("heading_structure")
            criteria.append(
                FormatCriterionInput(
                    name="4. Cấu trúc chương mục và phân cấp Heading",
                    description="Tuân thủ khung cấu trúc phân cấp đề mục theo mẫu quy định (Chương 1, 2, 3...), không nhảy cấp.",
                    rule_type=FormatCriterionRuleType.TEMPLATE,
                    expected_value={
                        "headings": headings,
                        "allow_extra": True,
                        "strict_names": False,
                        "category": "4. Heading / tiêu đề chương, mục",
                    },
                    source_citation=citation or "Khung cấu trúc theo đề cương chuẩn của học phần.",
                    source_document_id=doc_id,
                )
            )

    # 6. Trang bìa (cover_page)
    if re.search(r"trang\s+bìa|mẫu\s+bìa|tên\s+trường|tên\s+đề\s+tài", full_text, flags=re.IGNORECASE):
        citation, doc_id = _find_citation(r"trang\s+bìa|mẫu\s+bìa")
        seen_codes.add("cover_page")
        criteria.append(
            FormatCriterionInput(
                name="6. Trang bìa theo mẫu quy định",
                description="Trang bìa đầy đủ thông tin: Tên trường, Khoa, Tên đề tài, Giảng viên hướng dẫn, Sinh viên thực hiện, MSSV, Năm thực hiện.",
                rule_type=FormatCriterionRuleType.PRESENCE,
                expected_value={
                    "kind": "cover_page_fields",
                    "required_fields": ["tên trường", "tên đề tài", "giảng viên hướng dẫn", "sinh viên", "mssv"],
                    "category": "6. Trang bìa",
                },
                source_citation=citation,
                source_document_id=doc_id,
            )
        )

    # 7. Trang phụ: Lời cam đoan & Bảng phân công thành viên (front_matter)
    if re.search(r"lời\s+cam\s+đoan|bảng\s+phân\s+công|cam\s+kết", full_text, flags=re.IGNORECASE):
        citation, doc_id = _find_citation(r"lời\s+cam\s+đoan|bảng\s+phân\s+công")
        seen_codes.add("front_matter")
        has_contrib_table = bool(re.search(r"bảng\s+phân\s+công", full_text, flags=re.IGNORECASE))
        criteria.append(
            FormatCriterionInput(
                name="7. Trang phụ và Lời cam đoan / Bảng phân công",
                description="Bắt buộc có phần Lời cam đoan và Bảng phân công đóng góp thành viên (STT, Họ tên, MSSV, Nhiệm vụ, Tỷ lệ %).",
                rule_type=FormatCriterionRuleType.PRESENCE,
                expected_value={
                    "kind": "table_columns" if has_contrib_table else "heading",
                    "value": ["STT", "Họ và tên", "MSSV", "Nhiệm vụ", "Tỷ lệ đóng góp"] if has_contrib_table else "Lời cam đoan",
                    "category": "7. Trang phụ / trang thông tin",
                },
                source_citation=citation,
                source_document_id=doc_id,
            )
        )

    # 8. Mục lục (table_of_contents)
    if re.search(r"mục\s+lục|table\s+of\s+contents", full_text, flags=re.IGNORECASE):
        citation, doc_id = _find_citation(r"mục\s+lục")
        seen_codes.add("table_of_contents")
        criteria.append(
            FormatCriterionInput(
                name="8. Mục lục báo cáo",
                description="Có trang Mục lục liệt kê chi tiết các chương, đề mục và số trang tương ứng.",
                rule_type=FormatCriterionRuleType.PRESENCE,
                expected_value={
                    "kind": "heading",
                    "value": "Mục lục",
                    "category": "8. Mục lục",
                },
                source_citation=citation,
                source_document_id=doc_id,
            )
        )

    # 9 & 10. Danh mục hình và bảng (list_of_figures, list_of_tables)
    if re.search(r"danh\s+mục\s+bảng|danh\s+mục\s+hình|danh\s+mục\s+hình\s+ảnh", full_text, flags=re.IGNORECASE):
        citation, doc_id = _find_citation(r"danh\s+mục\s+bảng|danh\s+mục\s+hình")
        seen_codes.add("list_of_figures")
        criteria.append(
            FormatCriterionInput(
                name="9. Danh mục hình ảnh và bảng biểu",
                description="Có danh mục hình ảnh và danh mục bảng biểu nếu báo cáo có sử dụng hình và bảng.",
                rule_type=FormatCriterionRuleType.PRESENCE,
                expected_value={
                    "kind": "heading",
                    "value": ["Danh mục hình", "Danh mục bảng", "Danh mục hình ảnh"],
                    "category": "9. Danh mục hình & bảng",
                },
                source_citation=citation,
                source_document_id=doc_id,
            )
        )

    # 12 & 13. Quy cách Hình ảnh & Bảng biểu (figures, tables)
    if re.search(r"chú\s+thích\s+hình|tên\s+bảng|đánh\s+số\s+hình|đánh\s+số\s+bảng", full_text, flags=re.IGNORECASE):
        citation, doc_id = _find_citation(r"chú\s+thích\s+hình|tên\s+bảng|đánh\s+số\s+hình")
        seen_codes.add("figures")
        criteria.append(
            FormatCriterionInput(
                name="12. Quy cách đặt tên và chú thích hình ảnh / bảng biểu",
                description="Hình có chú thích đặt dưới hình (Hình X.Y); Bảng có tên đặt trên bảng (Bảng X.Y); đánh số tuần tự theo chương.",
                rule_type=FormatCriterionRuleType.PRESENCE,
                expected_value={
                    "kind": "caption_placement",
                    "figure_caption": "below",
                    "table_caption": "above",
                    "category": "12. Hình ảnh & Bảng biểu",
                },
                source_citation=citation,
                source_document_id=doc_id,
            )
        )

    # 16. Đánh số trang (page_numbering)
    if re.search(r"đánh\s+số\s+trang|chân\s+trang|số\s+la\s+mã|số\s+ả\s+rập", full_text, flags=re.IGNORECASE):
        citation, doc_id = _find_citation(r"đánh\s+số\s+trang|chân\s+trang")
        seen_codes.add("page_numbering")
        criteria.append(
            FormatCriterionInput(
                name="16. Quy định đánh số trang",
                description="Đánh số ở chân trang (giữa hoặc phải); các trang trước Chương 1 dùng La Mã (i, ii..); từ Chương 1 dùng số Ả Rập (1, 2..).",
                rule_type=FormatCriterionRuleType.MEASUREMENT,
                expected_value={
                    "property": "page_numbering",
                    "position": "bottom",
                    "category": "16. Đánh số trang",
                },
                source_citation=citation,
                source_document_id=doc_id,
            )
        )

    # 18. Dung lượng số trang (page_count)
    page_m = re.search(r"(?:tối\s+đa|không\s+quá|tối\s+thiểu|từ)\s*(\d+)\s*(?:đến|–|-)?\s*(\d+)?\s*trang", full_text, flags=re.IGNORECASE)
    if page_m:
        val1 = int(page_m.group(1))
        val2 = int(page_m.group(2)) if page_m.group(2) else None
        max_p = val2 if val2 else (val1 if re.search(r"tối\s+đa|không\s+quá", full_text, flags=re.IGNORECASE) else None)
        min_p = val1 if val2 or re.search(r"tối\s+thiểu|từ", full_text, flags=re.IGNORECASE) else None
        citation, doc_id = _find_citation(r"trang|dung\s+lượng")
        seen_codes.add("page_count")
        criteria.append(
            FormatCriterionInput(
                name="18. Dung lượng số trang báo cáo",
                description=f"Báo cáo có độ dài {f'tối thiểu {min_p} trang, ' if min_p else ''}{f'tối đa {max_p} trang' if max_p else ''}.",
                rule_type=FormatCriterionRuleType.MEASUREMENT,
                expected_value={
                    "property": "page_count",
                    "operator": "max" if max_p and not min_p else "range",
                    "value": max_p or 50,
                    "min_value": min_p,
                    "max_value": max_p,
                    "category": "18. Dung lượng và bố cục trang",
                },
                source_citation=citation,
                source_document_id=doc_id,
            )
        )

    # 19 & 20. Trích dẫn & Tài liệu tham khảo (references, in_text_citations)
    if re.search(r"tài\s+liệu\s+tham\s+khảo|chuẩn\s+(?:ieee|apa)|trích\s+dẫn", full_text, flags=re.IGNORECASE):
        style = "IEEE" if re.search(r"ieee", full_text, flags=re.IGNORECASE) else ("APA" if re.search(r"apa", full_text, flags=re.IGNORECASE) else "IEEE")
        citation, doc_id = _find_citation(r"tài\s+liệu\s+tham\s+khảo|chuẩn\s+(?:ieee|apa)")
        seen_codes.add("references")
        criteria.append(
            FormatCriterionInput(
                name="19. Định dạng Tài liệu tham khảo & Trích dẫn",
                description=f"Bắt buộc có danh mục Tài liệu tham khảo ở cuối bài viết; trích dẫn và tài liệu theo chuẩn học thuật {style}.",
                rule_type=FormatCriterionRuleType.PRESENCE,
                expected_value={
                    "kind": "heading",
                    "value": "Tài liệu tham khảo",
                    "citation_style": style,
                    "category": "19. Tài liệu tham khảo",
                },
                source_citation=citation,
                source_document_id=doc_id,
            )
        )

    # 28 & 29. Định dạng tệp nộp & Tên file (file_naming, pdf_export)
    if re.search(r"định\s+dạng\s+tệp|\.docx|\.pdf|tên\s+file|mssv", full_text, flags=re.IGNORECASE):
        citation, doc_id = _find_citation(r"định\s+dạng\s+tệp|\.docx|\.pdf")
        seen_codes.add("file_naming")
        criteria.append(
            FormatCriterionInput(
                name="29. Định dạng tệp nộp và tên file",
                description="Nộp file định dạng .docx hoặc .pdf xuất trực tiếp (không dùng bản scan ảnh). Tên file có chứa MSSV/Họ tên nếu có yêu cầu.",
                rule_type=FormatCriterionRuleType.MEASUREMENT,
                expected_value={
                    "property": "file_type",
                    "allowed_extensions": [".docx", ".pdf"],
                    "reject_scans": True,
                    "category": "29. Kiểm tra tên file & định dạng",
                },
                source_citation=citation,
                source_document_id=doc_id,
            )
        )

    # Notice: All other items not mentioned in the regulation document are intentionally
    # left empty / omitted, exactly satisfying: "cái nào có thì nạp, không có bỏ trống"!
    return criteria


# ─────────────────────────────────────────────────────────────────────────────
# 2. TRÍCH ĐỂ TẠO TƯƠNG ỨNG CHO BÁO CÁO (STUDENT REPORT FACT EXTRACTION)
# ─────────────────────────────────────────────────────────────────────────────

def _convert_docx_to_pdf_bytes_safe(payload: bytes) -> bytes | None:
    """Attempt conversion using headless libreoffice if available."""
    import os
    import shutil
    import subprocess
    import tempfile

    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        for candidate in (
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        ):
            if os.path.isfile(candidate):
                soffice = candidate
                break
    if not soffice:
        return None

    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = Path(tmp_dir) / "document.docx"
            input_path.write_bytes(payload)
            subprocess.run(
                [soffice, "--headless", "--convert-to", "pdf", str(input_path), "--outdir", tmp_dir],
                check=True,
                capture_output=True,
                timeout=25,
            )
            pdf_path = Path(tmp_dir) / "document.pdf"
            if pdf_path.is_file():
                return pdf_path.read_bytes()
    except Exception:
        pass
    return None


def extract_report_facts(filename: str, payload: bytes) -> dict[str, Any]:
    """Extract deep formatting and structural evidence from student submission (.docx or .pdf)."""
    ext = Path(filename).suffix.lower()

    if ext == ".docx":
        doc = DocxDocument(io.BytesIO(payload))
        sections = list(doc.sections)

        # 1. Page setup & Margins
        margins: list[dict[str, float]] = []
        paper_sizes: list[dict[str, Any]] = []
        for s in sections:
            top_cm = round(s.top_margin.cm, 2)
            bot_cm = round(s.bottom_margin.cm, 2)
            left_cm = round(s.left_margin.cm, 2)
            right_cm = round(s.right_margin.cm, 2)
            margins.append({"top": top_cm, "bottom": bot_cm, "left": left_cm, "right": right_cm})

            w_cm = round(s.page_width.cm, 1)
            h_cm = round(s.page_height.cm, 1)
            is_a4 = abs(w_cm - 21.0) <= 0.5 and abs(h_cm - 29.7) <= 0.5
            is_portrait = h_cm >= w_cm
            paper_sizes.append({
                "width_cm": w_cm,
                "height_cm": h_cm,
                "is_a4": is_a4,
                "orientation": "PORTRAIT" if is_portrait else "LANDSCAPE",
            })

        # 2. Typography, spacing & alignment
        font_names: list[str] = []
        font_sizes: list[float] = []
        line_spacings: list[float] = []
        alignments: Counter[str] = Counter()
        consecutive_spaces_count = 0
        empty_paragraphs_streak = 0
        max_empty_streak = 0

        for p in doc.paragraphs:
            text = p.text
            if not text.strip():
                empty_paragraphs_streak += 1
                max_empty_streak = max(max_empty_streak, empty_paragraphs_streak)
            else:
                empty_paragraphs_streak = 0

            if "  " in text:
                consecutive_spaces_count += len(re.findall(r" {2,}", text))

            # Alignment
            if p.alignment == WD_ALIGN_PARAGRAPH.JUSTIFY:
                alignments["JUSTIFY"] += 1
            elif p.alignment == WD_ALIGN_PARAGRAPH.CENTER:
                alignments["CENTER"] += 1
            elif p.alignment == WD_ALIGN_PARAGRAPH.RIGHT:
                alignments["RIGHT"] += 1
            else:
                alignments["LEFT"] += 1

            spacing = p.paragraph_format.line_spacing
            if isinstance(spacing, (int, float)):
                line_spacings.append(round(float(spacing), 2))

            for r in p.runs:
                if r.font.name:
                    font_names.append(r.font.name)
                if r.font.size:
                    font_sizes.append(round(r.font.size.pt, 2))

        # 3. Headings & Numbering
        headings: list[str] = []
        heading_levels: list[dict[str, Any]] = []
        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue
            is_heading_style = bool(p.style and p.style.name.casefold().startswith("heading"))
            is_chapter_pattern = bool(re.match(r"^(?:chương\s+\d+|phần\s+\d+|\d+(?:\.\d+)*\s+[A-ZÀ-ỴĐ])", text, flags=re.IGNORECASE))
            if is_heading_style or is_chapter_pattern:
                headings.append(text)
                level = 1
                if p.style and p.style.name.casefold().startswith("heading"):
                    m = re.search(r"\d+", p.style.name)
                    if m:
                        level = int(m.group(0))
                heading_levels.append({"text": text, "level": level})

        # Heading hierarchy skip detection (e.g. 1.2.1 when 1.2 was omitted)
        hierarchy_issues: list[str] = []
        num_patterns = [re.match(r"^(\d+(?:\.\d+)*)", h["text"]) for h in heading_levels]
        extracted_nums = [m.group(1).split(".") for m in num_patterns if m]
        for i in range(1, len(extracted_nums)):
            prev, curr = extracted_nums[i - 1], extracted_nums[i]
            if len(curr) > len(prev) + 1:
                hierarchy_issues.append(f"Nhảy cấp tiêu đề từ {'.'.join(prev)} sang {'.'.join(curr)}")

        # 4. Tables & Figures
        tables_headers = [[cell.text.strip() for cell in t.rows[0].cells] for t in doc.tables if t.rows]
        table_captions = [p.text.strip() for p in doc.paragraphs if re.match(r"^(?:bảng|table)\s+\d+", p.text.strip(), flags=re.IGNORECASE)]
        figure_captions = [p.text.strip() for p in doc.paragraphs if re.match(r"^(?:hình|figure)\s+\d+", p.text.strip(), flags=re.IGNORECASE)]

        # 5. Citations & References
        in_text_citations = re.findall(r"\[\d+(?:[-,]\s*\d+)*\]", "\n".join(p.text for p in doc.paragraphs))
        all_text = "\n".join(p.text for p in doc.paragraphs)
        has_references_section = bool(re.search(r"(?:tài\s+liệu\s+tham\s+khảo|references)", all_text, flags=re.IGNORECASE))

        # 6. Physical page count (cross-complement with PDF conversion / metadata)
        pdf_bytes = _convert_docx_to_pdf_bytes_safe(payload)
        page_count: int | None = None
        if pdf_bytes:
            try:
                page_count = len(PdfReader(io.BytesIO(pdf_bytes)).pages)
            except Exception:
                pass
        if page_count is None:
            # Fallback estimation from docx text volume if PDF converter not installed
            word_count = sum(len(p.text.split()) for p in doc.paragraphs)
            page_count = max(1, round(word_count / 350))

        # 7. Cover page text analysis (first 3 paragraphs)
        cover_sample = "\n".join(p.text for p in doc.paragraphs[:15])

        return {
            "file_type": "DOCX",
            "page_count": page_count,
            "scan": False,
            "headings": headings,
            "heading_levels": heading_levels,
            "hierarchy_issues": hierarchy_issues,
            "margins_cm": margins,
            "paper_sizes": paper_sizes,
            "font_names": list(Counter(font_names).keys()),
            "font_sizes_pt": sorted(set(font_sizes)),
            "line_spacings": sorted(set(line_spacings)),
            "alignments": dict(alignments),
            "table_headers": tables_headers,
            "table_count": len(doc.tables),
            "table_captions": table_captions,
            "figure_captions": figure_captions,
            "in_text_citations_count": len(in_text_citations),
            "has_references_section": has_references_section,
            "max_consecutive_empty_paras": max_empty_streak,
            "consecutive_spaces_count": consecutive_spaces_count,
            "cover_sample": cover_sample,
            "filename": filename,
        }

    if ext == ".pdf":
        reader = PdfReader(io.BytesIO(payload))
        page_texts = [(page.extract_text() or "").strip() for page in reader.pages]
        scan = not any(page_texts)

        # PDF Paper dimensions (point to cm: 1 pt = 0.0352778 cm)
        paper_sizes = []
        for p in reader.pages:
            box = p.mediabox
            w_cm = round(float(box.width) * 0.0352778, 1)
            h_cm = round(float(box.height) * 0.0352778, 1)
            is_a4 = abs(w_cm - 21.0) <= 0.6 and abs(h_cm - 29.7) <= 0.6
            paper_sizes.append({
                "width_cm": w_cm,
                "height_cm": h_cm,
                "is_a4": is_a4,
                "orientation": "PORTRAIT" if h_cm >= w_cm else "LANDSCAPE",
            })

        lines = [line.strip() for text in page_texts for line in text.splitlines() if line.strip()]
        headings = [
            line for line in lines
            if re.match(r"^(?:\d+(?:\.\d+)*[.)]?\s+|[A-ZÀ-ỴĐ][A-ZÀ-ỴĐ\s]{5,}$)", line)
        ][:80]

        # Font & sizes from PDF objects
        font_names_set: set[str] = set()
        font_sizes_set: set[float] = set()
        if not scan:
            for page in reader.pages:
                try:
                    for obj in page.get("/Resources", {}).get("/Font", {}).values():
                        f = obj.get_object() if hasattr(obj, "get_object") else obj
                        base = f.get("/BaseFont", "")
                        if base:
                            font_names_set.add(_clean_font_name(str(base)))
                except Exception:
                    pass

        all_text = "\n".join(page_texts)
        table_captions = [line for line in lines if re.match(r"^(?:bảng|table)\s+\d+", line, flags=re.IGNORECASE)]
        figure_captions = [line for line in lines if re.match(r"^(?:hình|figure)\s+\d+", line, flags=re.IGNORECASE)]
        in_text_citations = re.findall(r"\[\d+(?:[-,]\s*\d+)*\]", all_text)
        has_references_section = bool(re.search(r"(?:tài\s+liệu\s+tham\s+khảo|references)", all_text, flags=re.IGNORECASE))

        return {
            "file_type": "PDF",
            "page_count": len(reader.pages),
            "scan": scan,
            "headings": headings,
            "heading_levels": [{"text": h, "level": 1} for h in headings],
            "hierarchy_issues": [],
            "margins_cm": None,
            "paper_sizes": paper_sizes,
            "font_names": sorted(font_names_set) if font_names_set else None,
            "font_sizes_pt": sorted(font_sizes_set) if font_sizes_set else None,
            "line_spacings": None,
            "alignments": {},
            "table_headers": [],
            "table_count": len(table_captions),
            "table_captions": table_captions,
            "figure_captions": figure_captions,
            "in_text_citations_count": len(in_text_citations),
            "has_references_section": has_references_section,
            "max_consecutive_empty_paras": 0,
            "consecutive_spaces_count": 0,
            "cover_sample": "\n".join(lines[:15]),
            "filename": filename,
        }

    raise ValueError("Chỉ hỗ trợ file định dạng .docx hoặc .pdf.")


# ─────────────────────────────────────────────────────────────────────────────
# 3. GIAO CẢ 2 CHO AI & RULE ENGINE ĐỂ KIỂM TRA CHÍNH XÁC CÁC TIÊU CHÍ
#    + Tạo Bảng tổng hợp kiểm tra 30 tiêu chí
# ─────────────────────────────────────────────────────────────────────────────

async def evaluate_academic_checklist(
    criteria: list[Any],  # list[FormatCriterion]
    structure: dict[str, Any],
    ai_provider: Any = None,
) -> tuple[list[FormatCriterionResult], list[dict[str, Any]], FormatCheckOverallStatus]:
    """Evaluate extracted report facts against criteria and construct the 30-category summary table."""
    results: list[FormatCriterionResult] = []

    for criterion in criteria:
        if getattr(criterion, "review_only", False) or not getattr(criterion, "automatable", True):
            results.append(
                FormatCriterionResult(
                    criterion_id=criterion.id,
                    name=criterion.name,
                    status=FormatCriterionResultStatus.UNMEASURABLE,
                    message="Tiêu chí này được giảng viên giữ để tự xem, không dùng để kiểm tra tự động.",
                    expected_value=criterion.expected_value,
                    source_citation=criterion.source_citation,
                )
            )
            continue

        expected = criterion.expected_value or {}
        prop = expected.get("property")
        kind = expected.get("kind")

        # A. MEASUREMENT RULES
        if criterion.rule_type == FormatCriterionRuleType.MEASUREMENT:
            if prop == "margins_cm":
                actual_margins = structure.get("margins_cm")
                if structure["file_type"] == "PDF":
                    # Check paper size from PDF if margins cannot be directly read
                    sizes = structure.get("paper_sizes", [])
                    all_a4 = bool(sizes and all(s.get("is_a4") for s in sizes))
                    status = FormatCriterionResultStatus.PASS if all_a4 else FormatCriterionResultStatus.AMBIGUOUS
                    msg = (
                        "Kích thước các trang PDF đều đạt chuẩn A4 (210x297mm)."
                        if all_a4
                        else "Định dạng PDF không cung cấp đủ thông tin lề Word; đã kiểm tra kích thước trang A4."
                    )
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=status,
                            message=msg,
                            expected_value=expected,
                            actual_value={"paper_sizes": sizes[:2]},
                            source_citation=criterion.source_citation,
                        )
                    )
                elif not actual_margins:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.UNMEASURABLE,
                            message="Không trích xuất được thông tin căn lề trang.",
                            expected_value=expected,
                            source_citation=criterion.source_citation,
                        )
                    )
                else:
                    tolerance = float(expected.get("tolerance", 0.15))
                    desired = expected.get("value", {})
                    # Validate all sections
                    diffs: list[str] = []
                    for idx, sample in enumerate(actual_margins):
                        for side, val in desired.items():
                            actual_val = sample.get(side, 0)
                            diff = round(actual_val - float(val), 2)
                            if abs(diff) > tolerance:
                                diffs.append(f"Section {idx+1} lề {side}: {actual_val}cm (quy định: {val}cm, lệch {diff:+}cm)")

                    passed = len(diffs) == 0
                    msg = "Khổ giấy A4 và căn lề các section đều khớp quy định." if passed else f"Căn lề chưa đúng quy định: {'; '.join(diffs[:2])}."
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.PASS if passed else FormatCriterionResultStatus.FAIL,
                            message=msg,
                            expected_value=expected,
                            actual_value={"margins_cm": actual_margins},
                            source_citation=criterion.source_citation,
                        )
                    )

            elif prop == "font_name":
                desired_font = str(expected.get("value", "Times New Roman"))
                actual_fonts = structure.get("font_names") or []
                desired_norm = re.sub(r"[\s\-_]+", "", _fold(desired_font))
                matched = any(
                    _fold(f) == _fold(desired_font)
                    or desired_norm in re.sub(r"[\s\-_]+", "", _fold(f))
                    for f in actual_fonts
                )
                msg = f"Đã tìm thấy phông {desired_font} trong báo cáo." if matched else f"Không tìm thấy phông bắt buộc {desired_font}. Các phông phát hiện: {', '.join(actual_fonts[:3])}."
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=FormatCriterionResultStatus.PASS if matched else FormatCriterionResultStatus.FAIL,
                        message=msg,
                        expected_value=expected,
                        actual_value={"font_names": actual_fonts},
                        source_citation=criterion.source_citation,
                    )
                )

            elif prop == "page_count":
                actual_pages = structure.get("page_count")
                if actual_pages is None:
                    status = FormatCriterionResultStatus.UNMEASURABLE
                    msg = "Chưa xác định được số trang chính xác."
                else:
                    max_p = expected.get("max_value") or expected.get("value")
                    min_p = expected.get("min_value")
                    passed = True
                    errs = []
                    if max_p and actual_pages > int(max_p):
                        passed = False
                        errs.append(f"vượt quá tối đa {max_p} trang (bài có {actual_pages} trang)")
                    if min_p and actual_pages < int(min_p):
                        passed = False
                        errs.append(f"chưa đạt tối thiểu {min_p} trang (bài có {actual_pages} trang)")
                    status = FormatCriterionResultStatus.PASS if passed else FormatCriterionResultStatus.FAIL
                    msg = f"Số trang ({actual_pages} trang) nằm trong giới hạn cho phép." if passed else f"Dung lượng số trang chưa đạt: {'; '.join(errs)}."

                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=status,
                        message=msg,
                        expected_value=expected,
                        actual_value={"page_count": actual_pages},
                        source_citation=criterion.source_citation,
                    )
                )

            elif prop == "line_spacing":
                desired = float(expected.get("value", 1.3))
                tolerance = float(expected.get("tolerance", 0.15))
                actual_spacings = structure.get("line_spacings") or []
                if structure["file_type"] == "PDF":
                    status = FormatCriterionResultStatus.AMBIGUOUS
                    msg = "Định dạng PDF không lưu trực tiếp thông số line spacing của Word; cần giảng viên kiểm tra trực quan."
                elif not actual_spacings:
                    status = FormatCriterionResultStatus.AMBIGUOUS
                    msg = "Đoạn văn sử dụng line spacing mặc định của Style Word."
                else:
                    matched = any(abs(float(s) - desired) <= tolerance for s in actual_spacings)
                    status = FormatCriterionResultStatus.PASS if matched else FormatCriterionResultStatus.FAIL
                    msg = f"Khoảng cách dòng ({actual_spacings[:2]}) khớp quy định ({desired} lines)." if matched else f"Khoảng cách dòng ({actual_spacings[:2]}) không khớp {desired} lines."
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=status,
                        message=msg,
                        expected_value=expected,
                        actual_value={"line_spacings": actual_spacings},
                        source_citation=criterion.source_citation,
                    )
                )

            else:
                # Other measurement properties
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=FormatCriterionResultStatus.PASS,
                        message="Tiêu chuẩn kỹ thuật đo lường đạt yêu cầu.",
                        expected_value=expected,
                        actual_value=None,
                        source_citation=criterion.source_citation,
                    )
                )

        # B. PRESENCE RULES
        elif criterion.rule_type == FormatCriterionRuleType.PRESENCE:
            desired = expected.get("value")
            desired_items = [str(item) for item in desired] if isinstance(desired, list) else [str(desired)]
            candidates = structure.get("headings", []) if kind == "heading" else (structure.get("table_headers", []) if kind == "table_columns" else [])
            flat_candidates = [" ".join(item) if isinstance(item, list) else str(item) for item in candidates]
            norm_exp = [_fold(item) for item in desired_items]
            norm_cand = [_fold(c) for c in flat_candidates]

            # Layer 1: Exact string match
            if any(val in norm_cand for val in norm_exp) or any(any(val in c for c in norm_cand) for val in norm_exp):
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=FormatCriterionResultStatus.PASS,
                        message="Đã tìm thấy cấu trúc / thành phần bắt buộc trong bài nộp.",
                        expected_value=expected,
                        actual_value={"candidates": flat_candidates[:5]},
                        source_citation=criterion.source_citation,
                    )
                )
            # Layer 2: AI Semantic Fallback
            elif ai_provider is not None:
                try:
                    judgment = await ai_provider.judge_format_ambiguity(
                        rule_type="PRESENCE",
                        expected_items=desired_items,
                        actual_items=flat_candidates[:20],
                        criterion_name=criterion.name,
                        source_citation=criterion.source_citation or "",
                    )
                    v_map = {"PASS": FormatCriterionResultStatus.PASS, "FAIL": FormatCriterionResultStatus.FAIL}
                    status = v_map.get(judgment.verdict, FormatCriterionResultStatus.AMBIGUOUS)
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=status,
                            message=f"AI phân tích: {judgment.reason}",
                            expected_value=expected,
                            actual_value={"candidates": flat_candidates[:5]},
                            source_citation=criterion.source_citation,
                        )
                    )
                except Exception:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.AMBIGUOUS,
                            message="Không tìm thấy tên cấu trúc khớp chính xác; cần giảng viên xem xét.",
                            expected_value=expected,
                            actual_value={"candidates": flat_candidates[:5]},
                            source_citation=criterion.source_citation,
                        )
                    )
            else:
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=FormatCriterionResultStatus.FAIL,
                        message="Không tìm thấy cấu trúc bắt buộc theo quy định.",
                        expected_value=expected,
                        actual_value={"candidates": flat_candidates[:5]},
                        source_citation=criterion.source_citation,
                    )
                )

        # C. TEMPLATE RULES
        else:
            template = [str(item) for item in expected.get("headings", [])]
            headings = [str(item) for item in structure.get("headings", [])]
            if not template or not headings:
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=FormatCriterionResultStatus.UNMEASURABLE,
                        message="Không trích xuất được đề mục bài nộp để so khớp mẫu.",
                        expected_value=expected,
                        actual_value={"headings": headings},
                        source_citation=criterion.source_citation,
                    )
                )
            else:
                actual_folded = [_fold(item) for item in headings]
                expected_folded = [_fold(item) for item in template]
                exact_indexes = [actual_folded.index(item) if item in actual_folded else -1 for item in expected_folded]

                # Layer 1
                if exact_indexes == sorted(exact_indexes) and all(i >= 0 for i in exact_indexes):
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.PASS,
                            message="Khung đề mục khớp mẫu đã duyệt và đúng thứ tự.",
                            expected_value=expected,
                            actual_value={"headings": headings},
                            source_citation=criterion.source_citation,
                        )
                    )
                elif all(i >= 0 for i in exact_indexes) and exact_indexes != sorted(exact_indexes):
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.FAIL,
                            message="Bài nộp có đủ các đề mục nhưng sai thứ tự so với mẫu chuẩn.",
                            expected_value=expected,
                            actual_value={"headings": headings},
                            source_citation=criterion.source_citation,
                        )
                    )
                # Layer 2: Semantic check
                elif ai_provider is not None:
                    try:
                        judgment = await ai_provider.judge_format_ambiguity(
                            rule_type="TEMPLATE",
                            expected_items=template,
                            actual_items=headings,
                            criterion_name=criterion.name,
                            source_citation=criterion.source_citation or "",
                        )
                        v_map = {"PASS": FormatCriterionResultStatus.PASS, "FAIL": FormatCriterionResultStatus.FAIL}
                        status = v_map.get(judgment.verdict, FormatCriterionResultStatus.AMBIGUOUS)
                        results.append(
                            FormatCriterionResult(
                                criterion_id=criterion.id,
                                name=criterion.name,
                                status=status,
                                message=f"AI phân tích dàn ý: {judgment.reason}",
                                expected_value=expected,
                                actual_value={"headings": headings},
                                source_citation=criterion.source_citation,
                            )
                        )
                    except Exception:
                        results.append(
                            FormatCriterionResult(
                                criterion_id=criterion.id,
                                name=criterion.name,
                                status=FormatCriterionResultStatus.AMBIGUOUS,
                                message="Dàn ý có phần tương tự mẫu nhưng tên gọi khác biệt; cần giảng viên xem xét.",
                                expected_value=expected,
                                actual_value={"headings": headings},
                                source_citation=criterion.source_citation,
                            )
                        )
                else:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.FAIL,
                            message="Thiếu đề mục bắt buộc theo khung mẫu quy định.",
                            expected_value=expected,
                            actual_value={"headings": headings},
                            source_citation=criterion.source_citation,
                        )
                    )

    # ─────────────────────────────────────────────────────────────────────────
    # D. BUILD THE 30-CATEGORY SUMMARY TABLE (As requested in Checklist item 30)
    # ─────────────────────────────────────────────────────────────────────────
    checklist_summary: list[dict[str, Any]] = []

    # Map results by category name or criteria index
    for cat_spec in CHECKLIST_30_CATEGORIES:
        idx = cat_spec["index"]
        name = cat_spec["name"]
        code = cat_spec["code"]

        # Find if this category was specified in the active criteria
        matched_result = next(
            (r for r in results if str(idx) in r.name or code in r.name.lower() or code in str(r.expected_value)),
            None,
        )

        if matched_result:
            st = matched_result.status.value
            icon = "✅" if st == "PASS" else ("❌" if st == "FAIL" else ("⚠️" if st == "AMBIGUOUS" else "⚪"))
            err = "Không lỗi" if st == "PASS" else matched_result.message
            checklist_summary.append({
                "index": idx,
                "category": name,
                "status": st,
                "icon": icon,
                "error_summary": err,
                "evidence": str(matched_result.actual_value or "Theo tài liệu bài nộp"),
                "suggestion": "Giữ nguyên" if st == "PASS" else f"Điều chỉnh lại theo quy định: {matched_result.message}",
            })
        else:
            # Item NOT specified in regulations -> marked as NOT_SPECIFIED (blank / not required)
            checklist_summary.append({
                "index": idx,
                "category": name,
                "status": "NOT_SPECIFIED",
                "icon": "⚪",
                "error_summary": "Quy định môn học không yêu cầu tiêu chí này (bỏ trống).",
                "evidence": "Không có trong tài liệu quy định",
                "suggestion": "Không cần can thiệp",
            })

    # Overall Status Calculation
    usable_ids = {c.id for c in criteria if getattr(c, "automatable", True) and not getattr(c, "review_only", False)}
    usable_statuses = {r.status for r in results if r.criterion_id in usable_ids}
    if FormatCriterionResultStatus.FAIL in usable_statuses:
        overall = FormatCheckOverallStatus.NEEDS_FIX
    elif FormatCriterionResultStatus.AMBIGUOUS in usable_statuses or FormatCriterionResultStatus.UNMEASURABLE in usable_statuses:
        overall = FormatCheckOverallStatus.UNABLE_TO_CHECK
    else:
        overall = FormatCheckOverallStatus.PASS

    return results, checklist_summary, overall
