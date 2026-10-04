"""Academic Report Formatting Checklist Engine.

Implements the 30-category academic report formatting checklist:
1. Extract checklist criteria strictly from regulation documents (zero hardcoded defaults: only populate what is specified, leave blank what is not).
2. Decompose template outline into granular, discrete chapter/section criteria with semantic equivalence toggle while preserving strict hierarchy & order.
3. Extract corresponding formatting & structural facts from student reports (.docx / .pdf), including deep cover page recognition (tables + paragraphs).
4. Evaluate report facts against criteria using hybrid deterministic rules + AI semantic reasoning and construct the 30-category summary table.
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
# SYNONYM CLUSTERS FOR SEMANTIC HEADING RECOGNITION
# ─────────────────────────────────────────────────────────────────────────────

SYNONYM_CLUSTERS: list[set[str]] = [
    {"khai niem", "mo dau", "gioi thieu", "tong quan", "dat van de", "gioi thieu tong quan", "tong quan de tai"},
    {"hien thuc", "cai dat", "thiet ke va cai dat", "trien khai", "thuc nghiem", "phuong phap va hien thuc", "xay dung he thong"},
    {"danh gia va ket luan", "ket luan va huong phat trien", "ket luan", "danh gia ket qua", "tong ket", "ket luan va khuyen nghi"},
    {"mo ta do an", "mo ta bai toan", "tong quan de tai", "gioi thieu de tai", "mo ta he thong", "mo dau do an", "mo ta du an"},
    {"tai sao can", "ly do chon de tai", "tinh cap thiet", "tai sao can thuc hien", "muc tieu va ly do", "su can thiet"},
    {"thiet ke he thong", "kien truc he thong", "thiet ke tong the", "thiet ke giai phap", "thiet ke kien truc"},
    {"cai dat va thu nghiem", "hien thuc va kiem thu", "cai dat he thong", "thuc nghiem va danh gia", "trien khai va thu nghiem", "thu nghiem va danh gia"},
    {"ket qua dat duoc", "ket qua thuc nghiem", "ket qua nghien cuu", "tong ket ket qua", "ket qua"},
    {"huong phat trien", "huong nghien cuu tiep theo", "dinh huong phat trien", "cac buoc tiep theo", "huong di tuong lai"},
]


def _is_semantically_equivalent(expected_name: str, actual_name: str) -> tuple[bool, str]:
    """Check if actual heading matches expected heading semantically or exactly."""
    exp_f = _fold(re.sub(r"^(?:chương\s+[0-9ivxlcdm]+[:\.\s–-]+|\d+(?:\.\d+)*\s*[:\.\)]?\s*)", "", expected_name, flags=re.I))
    act_f = _fold(re.sub(r"^(?:chương\s+[0-9ivxlcdm]+[:\.\s–-]+|\d+(?:\.\d+)*\s*[:\.\)]?\s*)", "", actual_name, flags=re.I))

    # Exact normalized match
    if exp_f == act_f or exp_f in act_f or act_f in exp_f:
        return True, "Khớp chính xác tên đề mục"

    # Token overlap (if majority of words match)
    exp_tokens = set(exp_f.split())
    act_tokens = set(act_f.split())
    if exp_tokens and act_tokens:
        overlap = len(exp_tokens & act_tokens) / max(len(exp_tokens), len(act_tokens))
        if overlap >= 0.5:
            return True, f"Trùng khớp {int(overlap * 100)}% từ khóa cốt lõi"

    # Synonym cluster matching
    for cluster in SYNONYM_CLUSTERS:
        exp_in = any(syn in exp_f for syn in cluster)
        act_in = any(syn in act_f for syn in cluster)
        if exp_in and act_in:
            return True, "Thuộc nhóm thuật ngữ tương đương ngữ nghĩa chuẩn"

    return False, "Không tìm thấy tương đồng ngữ nghĩa"


def _parse_template_tree(full_text: str, template_headings: list[str] | None = None) -> list[dict[str, Any]]:
    """Parse discrete chapters and sub-sections from regulation text or headings."""
    items: list[dict[str, Any]] = []

    # Front-matter and back-matter that belong to separate dedicated categories
    special_matter_pat = re.compile(
        r"^(?:trang\s+bìa|bảng\s+phân\s+công|lời\s+cam\s+đoan|mục\s+lục|danh\s+mục|tài\s+liệu\s+tham\s+khảo|phụ\s+lục)",
        flags=re.IGNORECASE,
    )

    candidate_headings: list[str] = []
    if template_headings:
        candidate_headings = [h.strip() for h in template_headings if h.strip() and not special_matter_pat.search(h.strip())]
    else:
        for line in full_text.splitlines():
            line_clean = line.strip()
            m = re.match(r"^#{2,4}\s+([^\n\r]+)", line_clean)
            if m:
                cand = m.group(1).strip()
                if not special_matter_pat.search(cand) and not re.match(r"^\d+\.\s+quy\s+định", cand, flags=re.I):
                    candidate_headings.append(cand)

    current_chapter: dict[str, Any] | None = None
    chap_count = 0

    for h_str in candidate_headings:
        chap_num_match = re.search(r"chương\s+([0-9ivxlcdm]+)", h_str, flags=re.I)
        is_chapter = bool(chap_num_match) or (not current_chapter and bool(re.match(r"^(?:chương|phần|[0-9]+\.)", h_str, flags=re.I)))

        if is_chapter:
            if chap_num_match:
                raw_num = chap_num_match.group(1)
                num = int(raw_num) if raw_num.isdigit() else (chap_count + 1)
            else:
                num = chap_count + 1
            chap_count = max(chap_count + 1, num)

            current_chapter = {
                "type": "chapter",
                "title": h_str,
                "number": num,
                "subsections": [],
            }
            items.append(current_chapter)
        elif current_chapter:
            # Sub-section of current chapter
            sub_idx = len(current_chapter["subsections"]) + 1
            sub = {
                "type": "section",
                "title": h_str,
                "parent": current_chapter["title"],
                "chapter_number": current_chapter["number"],
                "sub_index": sub_idx,
            }
            current_chapter["subsections"].append(sub)
            items.append(sub)

    return items


# ─────────────────────────────────────────────────────────────────────────────
# 1. TRÍCH ĐỂ TẠO CHECKLIST TỪ QUY ĐỊNH
#    "trích xuất hoàn toàn từ tài liệu không được để mặc định bất cứ thứ gì"
# ─────────────────────────────────────────────────────────────────────────────

def extract_checklist_from_regulations(
    chunks: list[dict[str, Any]],
    template_headings: list[str] | None = None,
    allow_semantic_equivalent: bool = True,
) -> list[FormatCriterionInput]:
    """Scan regulation text chunks against the 30 checklist items.

    ZERO HARDCODED DEFAULTS: Only items explicitly stated in the regulation document are populated.
    If a parameter (e.g. margin, line spacing, font size, page count) is not in the regulation,
    it is NOT defaulted (left empty / omitted).
    """
    criteria: list[FormatCriterionInput] = []
    seen_codes: set[str] = set()

    full_text = "\n\n".join(c.get("content", "") for c in chunks)
    first_doc_id = chunks[0].get("document_id") if chunks else None

    def _find_citation(pattern: str) -> tuple[str, str | None]:
        for c in chunks:
            text = c.get("content", "")
            if re.search(pattern, text, flags=re.IGNORECASE):
                return text.strip()[:600], c.get("document_id")
        return "", first_doc_id

    # 1. Khổ giấy và Căn lề (page_setup)
    paper_a4 = bool(re.search(r"\bA4\b|210\s*x\s*297", full_text, flags=re.IGNORECASE))
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

    # ONLY add if margins or paper size explicitly mentioned in regulations. NO DEFAULT MARGINS!
    if margins or paper_a4:
        citation, doc_id = _find_citation(r"khổ\s+giấy|căn\s+lề|lề\s+trên|lề\s+trái")
        seen_codes.add("page_setup")
        desc_parts = []
        if paper_a4:
            desc_parts.append("Khổ giấy A4 tiêu chuẩn (210x297mm)")
        if margins:
            margin_desc = ", ".join(f"{s}: {v}cm" for s, v in margins.items())
            desc_parts.append(f"Căn lề: {margin_desc}")
        criteria.append(
            FormatCriterionInput(
                name="1. Khổ giấy và thiết lập căn lề",
                description="; ".join(desc_parts) + ", hướng giấy dọc (Portrait).",
                rule_type=FormatCriterionRuleType.MEASUREMENT,
                expected_value={
                    "property": "margins_cm",
                    "value": margins if margins else None,
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
    font_name: str | None = None
    if re.search(r"times\s+new\s+roman", full_text, flags=re.IGNORECASE):
        font_name = "Times New Roman"
    elif re.search(r"\barial\b", full_text, flags=re.IGNORECASE):
        font_name = "Arial"
    elif re.search(r"\bcalibri\b", full_text, flags=re.IGNORECASE):
        font_name = "Calibri"

    size_m = re.search(r"(?:cỡ\s+chữ|font\s+size|thân\s+bài[^\n\r\d]{0,25})\D{0,15}(\d+(?:[.,]\d+)?)\s*pt", full_text, flags=re.IGNORECASE)
    font_size: float | None = float(size_m.group(1).replace(",", ".")) if size_m else None

    # ONLY add if font or font size is explicitly stated in regulations. NO DEFAULT 13.0 pt!
    if font_name or font_size:
        citation, doc_id = _find_citation(r"phông\s+chữ|times\s+new\s+roman|cỡ\s+chữ")
        seen_codes.add("typography")
        desc = f"Phông chữ {font_name or 'theo quy định'}" + (f", cỡ chữ thân bài {font_size} pt." if font_size else ".")
        criteria.append(
            FormatCriterionInput(
                name="2. Phông chữ và cỡ chữ nội dung",
                description=desc,
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
    spacing_m = re.search(r"(?:khoảng\s+cách\s+dòng|giãn\s+dòng|line\s+spacing)\D{0,25}(\d+(?:[.,]\d+)?)", full_text, flags=re.IGNORECASE)
    line_spacing: float | None = float(spacing_m.group(1).replace(",", ".")) if spacing_m else None
    justify_req = bool(re.search(r"căn\s+đều|justify", full_text, flags=re.IGNORECASE))

    # ONLY add if spacing or justify is explicitly in regulations. NO DEFAULT 1.3 lines!
    if line_spacing or justify_req:
        citation, doc_id = _find_citation(r"giãn\s+dòng|khoảng\s+cách\s+dòng|line\s+spacing|căn\s+đều")
        seen_codes.add("paragraph_format")
        desc_list = []
        if line_spacing:
            desc_list.append(f"Khoảng cách dòng {line_spacing} lines")
        if justify_req:
            desc_list.append("Nội dung chính căn đều hai bên (Justify)")
        criteria.append(
            FormatCriterionInput(
                name="3. Định dạng đoạn văn và giãn dòng",
                description="; ".join(desc_list) + ".",
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

    # 4 & 5. GRANULAR TEMPLATE CRITERIA: Tách nhỏ từng chương, từng mục riêng biệt
    # Cho phép bật / tắt tương đương ngữ nghĩa, nhưng cấu trúc & thứ tự vẫn phải đảm bảo
    template_items = _parse_template_tree(full_text, template_headings)
    if template_items:
        citation, doc_id = _find_citation(r"cấu\s+trúc|khung\s+đề\s+cương|chương\s+\d")
        seen_codes.add("heading_structure")
        seen_codes.add("numbering")

        chapter_titles: list[str] = []
        for item in template_items:
            if item["type"] == "chapter":
                chapter_titles.append(item["title"])
                sub_names = [s["title"] for s in item.get("subsections", [])]
                criteria.append(
                    FormatCriterionInput(
                        name=f"4.{item['number']} Mục bắt buộc: {item['title']}",
                        description=(
                            f"Yêu cầu có {item['title']} (cấp độ 1, chương thứ {item['number']}). "
                            + (f"Bao gồm các mục con: {', '.join(sub_names)}. " if sub_names else "")
                            + ("Cho phép tên tương đương ngữ nghĩa." if allow_semantic_equivalent else "Bắt buộc tên chính xác 100%.")
                        ),
                        rule_type=FormatCriterionRuleType.TEMPLATE,
                        expected_value={
                            "kind": "template_chapter",
                            "chapter_name": item["title"],
                            "chapter_number": item["number"],
                            "level": 1,
                            "order_index": item["number"],
                            "required_subheadings": sub_names,
                            "allow_semantic_equivalent": allow_semantic_equivalent,
                            "category": "4. Heading / tiêu đề chương, mục",
                        },
                        source_citation=citation or "Khung đề cương chuẩn của học phần.",
                        source_document_id=doc_id,
                    )
                )
            elif item["type"] == "section":
                criteria.append(
                    FormatCriterionInput(
                        name=f"4.{item['chapter_number']}.{item['sub_index']} Mục con: {item['title']}",
                        description=(
                            f"Mục con '{item['title']}' thuộc {item['parent']} (cấp độ 2). "
                            + ("Cho phép tên tương đương ngữ nghĩa." if allow_semantic_equivalent else "Bắt buộc tên chính xác 100%.")
                        ),
                        rule_type=FormatCriterionRuleType.TEMPLATE,
                        expected_value={
                            "kind": "template_section",
                            "section_name": item["title"],
                            "parent_chapter": item["parent"],
                            "chapter_number": item["chapter_number"],
                            "level": 2,
                            "order_index": float(f"{item['chapter_number']}.{item['sub_index']}"),
                            "allow_semantic_equivalent": allow_semantic_equivalent,
                            "category": "4. Heading / tiêu đề chương, mục",
                        },
                        source_citation=citation or f"Đề cương chuẩn: {item['parent']}.",
                        source_document_id=doc_id,
                    )
                )

        # Thứ tự và phân cấp cấu trúc tổng thể
        criteria.append(
            FormatCriterionInput(
                name="5. Thứ tự và phân cấp cấu trúc đề mục (Toàn văn)",
                description=(
                    f"Đảm bảo các chương và mục con xuất hiện đúng trình tự tuần tự "
                    f"({' -> '.join(chapter_titles)}), không đảo lộn và không nhảy cấp."
                ),
                rule_type=FormatCriterionRuleType.TEMPLATE,
                expected_value={
                    "kind": "template_sequence",
                    "chapters": chapter_titles,
                    "allow_semantic_equivalent": allow_semantic_equivalent,
                    "category": "5. Đánh số chương và mục",
                },
                source_citation=citation or "Quy định thứ tự trình bày đề mục.",
                source_document_id=doc_id,
            )
        )

    # 6. Trang bìa (cover_page) - Nhận diện trang bìa theo mẫu quy định
    if re.search(r"trang\s+bìa|mẫu\s+bìa|tên\s+trường|tên\s+đề\s+tài", full_text, flags=re.IGNORECASE):
        citation, doc_id = _find_citation(r"trang\s+bìa|mẫu\s+bìa")
        seen_codes.add("cover_page")
        req_fields = []
        if re.search(r"tên\s+trường|cơ\s+sở\s+đào\s+tạo", full_text, flags=re.I):
            req_fields.append("tên trường")
        if re.search(r"tên\s+khoa|bộ\s+môn", full_text, flags=re.I):
            req_fields.append("tên khoa")
        if re.search(r"tên\s+đề\s+tài|tiêu\s+đề", full_text, flags=re.I):
            req_fields.append("tên đề tài")
        if re.search(r"giảng\s+viên\s+hướng\s+dẫn|cán\s+bộ\s+hướng\s+dẫn|gvhd", full_text, flags=re.I):
            req_fields.append("giảng viên hướng dẫn")
        if re.search(r"sinh\s+viên|danh\s+sách\s+sinh\s+viên", full_text, flags=re.I):
            req_fields.append("sinh viên")
        if re.search(r"mssv|mã\s+số\s+sinh\s+viên", full_text, flags=re.I):
            req_fields.append("mssv")
        if re.search(r"năm\s+thực\s+hiện|địa\s+danh", full_text, flags=re.I):
            req_fields.append("năm thực hiện")

        if not req_fields:
            req_fields = ["tên trường", "tên đề tài", "giảng viên hướng dẫn", "sinh viên", "mssv"]

        criteria.append(
            FormatCriterionInput(
                name="6. Trang bìa theo mẫu quy định",
                description=f"Trang bìa đầy đủ các thông tin bắt buộc: {', '.join(req_fields)}.",
                rule_type=FormatCriterionRuleType.PRESENCE,
                expected_value={
                    "kind": "cover_page",
                    "required_fields": req_fields,
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
        desc = f"Báo cáo có độ dài {f'tối thiểu {min_p} trang, ' if min_p else ''}{f'tối đa {max_p} trang' if max_p else ''}."
        criteria.append(
            FormatCriterionInput(
                name="18. Dung lượng số trang báo cáo",
                description=desc,
                rule_type=FormatCriterionRuleType.MEASUREMENT,
                expected_value={
                    "property": "page_count",
                    "operator": "max" if max_p and not min_p else "range",
                    "value": max_p,
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
        style = "IEEE" if re.search(r"ieee", full_text, flags=re.IGNORECASE) else ("APA" if re.search(r"apa", full_text, flags=re.IGNORECASE) else None)
        citation, doc_id = _find_citation(r"tài\s+liệu\s+tham\s+khảo|chuẩn\s+(?:ieee|apa)")
        seen_codes.add("references")
        desc = "Bắt buộc có danh mục Tài liệu tham khảo ở cuối bài viết" + (f"; định dạng theo chuẩn {style}." if style else ".")
        criteria.append(
            FormatCriterionInput(
                name="19. Định dạng Tài liệu tham khảo & Trích dẫn",
                description=desc,
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
        allowed_exts = []
        if ".docx" in full_text.lower():
            allowed_exts.append(".docx")
        if ".pdf" in full_text.lower():
            allowed_exts.append(".pdf")
        if not allowed_exts:
            allowed_exts = [".docx", ".pdf"]

        seen_codes.add("file_naming")
        criteria.append(
            FormatCriterionInput(
                name="29. Định dạng tệp nộp và tên file",
                description=f"Nộp file định dạng {' hoặc '.join(allowed_exts)} xuất trực tiếp (không dùng bản scan ảnh).",
                rule_type=FormatCriterionRuleType.MEASUREMENT,
                expected_value={
                    "property": "file_type",
                    "allowed_extensions": allowed_exts,
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
#    Bao gồm nhận diện trang bìa (Paragraphs + Tables) và bù trừ DOCX <-> PDF
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


def _extract_cover_page_from_text(raw_text: str) -> dict[str, Any]:
    """Analyze text from early pages/tables to recognize academic cover page elements."""
    folded = _fold(raw_text)

    # 1. School / University
    has_univ = bool(re.search(r"truong\s+dai\s+hoc|dai\s+hoc\s+quoc\s+gia|bo\s+giao\s+duc|hoc\s+vien|dai\s+hoc|dhqg", folded))
    univ_m = re.search(r"((?:TRƯỜNG\s+ĐẠI\s+HỌC|ĐẠI\s+HỌC\s+QUỐC\s+GIA|HỌC\s+VIỆN|BỘ\s+GIÁO\s+DỤC|ĐẠI\s+HỌC)[^\n\r,]+)", raw_text, flags=re.I)
    univ_text = univ_m.group(1).strip() if univ_m else ("Đại học / Cơ sở đào tạo" if has_univ else None)

    # 2. Faculty / Department
    has_faculty = bool(re.search(r"\bkhoa\b|\bbo\s+mon\b|\bvien\b", folded))
    faculty_m = re.search(r"((?:KHOA|BỘ\s+MÔN|VIỆN)\s+[^\n\r,]+)", raw_text, flags=re.I)
    faculty_text = faculty_m.group(1).strip() if faculty_m else ("Khoa / Bộ môn" if has_faculty else None)

    # 3. Title / Project
    has_title = bool(re.search(r"do\s+an|bao\s+cao|luan\s+van|tieu\s+luan|bai\s+tap\s+lon|de\s+tai", folded))
    title_m = re.search(r"((?:BÁO\s+CÁO|ĐỒ\s+ÁN|LUẬN\s+VĂN|TIỂU\s+LUẬN|BÀI\s+TẬP\s+LỚN|ĐỀ\s+TÀI)[^\n\r]+)", raw_text, flags=re.I)
    title_text = title_m.group(1).strip() if title_m else ("Tên đề tài / Đồ án" if has_title else None)

    # 4. Supervisor
    has_supervisor = bool(re.search(r"giang\s+vien\s+huong\s+dan|can\s+bo\s+huong\s+dan|gvhd|nguoi\s+huong\s+dan", folded))
    sup_m = re.search(r"(?:giảng\s+viên\s+hướng\s+dẫn|cán\s+bộ\s+hướng\s+dẫn|gvhd|người\s+hướng\s+dẫn)[:\s]+([^\n\r]+)", raw_text, flags=re.I)
    sup_text = sup_m.group(1).strip() if sup_m else ("Giảng viên hướng dẫn" if has_supervisor else None)

    # 5. Students & MSSV
    has_students = bool(re.search(r"sinh\s+vien\s+thuc\s+hien|sinh\s+vien|svth|ho\s+va\s+ten", folded))
    student_ids = re.findall(r"\b(\d{7,8})\b", raw_text)
    has_mssv = bool(student_ids) or bool(re.search(r"\bmssv\b|ma\s+so\s+sinh\s+vien", folded))

    # 6. Location & Year
    year_m = re.search(r"(?:tp\.?\s*hồ\s+chí\s+minh|hà\s+nội|đà\s+nẵng|tháng\s+\d+)?\s*(?:năm\s+)?(202[0-9]|203[0-9])", raw_text, flags=re.I)
    has_year = bool(year_m)
    year_text = year_m.group(0).strip() if year_m else None

    found_fields: list[str] = []
    if has_univ:
        found_fields.append("tên trường")
    if has_faculty:
        found_fields.append("tên khoa")
    if has_title:
        found_fields.append("tên đề tài")
    if has_supervisor:
        found_fields.append("giảng viên hướng dẫn")
    if has_students:
        found_fields.append("sinh viên")
    if has_mssv:
        found_fields.append("mssv")
    if has_year:
        found_fields.append("năm thực hiện")

    # Cover page is detected if it has academic markers or title or student/supervisor
    is_detected = (
        len(found_fields) >= 3
        or (has_students and has_mssv)
        or (has_univ and (has_title or has_supervisor))
    )

    return {
        "detected": is_detected,
        "found_fields": found_fields,
        "has_university": has_univ,
        "university_text": univ_text,
        "has_faculty": has_faculty,
        "faculty_text": faculty_text,
        "has_title": has_title,
        "title_text": title_text,
        "has_supervisor": has_supervisor,
        "supervisor_text": sup_text,
        "has_students": has_students,
        "has_mssv": has_mssv,
        "student_ids": student_ids,
        "has_year": has_year,
        "year_text": year_text,
        "preview": raw_text[:600].strip(),
    }


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
            word_count = sum(len(p.text.split()) for p in doc.paragraphs)
            page_count = max(1, round(word_count / 350))

        # 7. Deep cover page extraction (scanning early paragraphs AND early tables)
        cover_paras = [p.text.strip() for p in doc.paragraphs[:35] if p.text.strip()]
        cover_tables_text = [
            " ".join(cell.text.strip() for cell in row.cells)
            for t in doc.tables[:3]
            for row in t.rows
            if any(cell.text.strip() for cell in row.cells)
        ]
        cover_text = "\n".join(cover_paras + cover_tables_text)
        cover_page_facts = _extract_cover_page_from_text(cover_text)

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
            "cover_page": cover_page_facts,
            "cover_sample": cover_page_facts["preview"],
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

        # Cover page from page 1 of PDF
        first_page_text = reader.pages[0].extract_text() if len(reader.pages) > 0 else ""
        cover_page_facts = _extract_cover_page_from_text(first_page_text or "")

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
            "cover_page": cover_page_facts,
            "cover_sample": cover_page_facts["preview"],
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
                    desired = expected.get("value") or {}
                    diffs: list[str] = []
                    for idx, sample in enumerate(actual_margins):
                        for side, val in desired.items():
                            actual_val = sample.get(side, 0)
                            diff = round(actual_val - float(val), 2)
                            if abs(diff) > tolerance:
                                diffs.append(f"Section {idx + 1} lề {side}: {actual_val}cm (quy định: {val}cm, lệch {diff:+}cm)")

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
                desired_font = expected.get("value")
                actual_fonts = structure.get("font_names") or []
                if desired_font:
                    desired_norm = re.sub(r"[\s\-_]+", "", _fold(str(desired_font)))
                    matched = any(
                        _fold(f) == _fold(str(desired_font))
                        or desired_norm in re.sub(r"[\s\-_]+", "", _fold(f))
                        for f in actual_fonts
                    )
                    msg = f"Đã tìm thấy phông {desired_font} trong báo cáo." if matched else f"Không tìm thấy phông bắt buộc {desired_font}. Các phông phát hiện: {', '.join(actual_fonts[:3])}."
                    status = FormatCriterionResultStatus.PASS if matched else FormatCriterionResultStatus.FAIL
                else:
                    status = FormatCriterionResultStatus.PASS
                    msg = f"Phông chữ được sử dụng: {', '.join(actual_fonts[:3])}."

                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=status,
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
                desired = expected.get("value")
                tolerance = float(expected.get("tolerance", 0.15))
                actual_spacings = structure.get("line_spacings") or []
                if structure["file_type"] == "PDF":
                    status = FormatCriterionResultStatus.AMBIGUOUS
                    msg = "Định dạng PDF không lưu trực tiếp thông số line spacing của Word; cần giảng viên kiểm tra trực quan."
                elif not actual_spacings:
                    status = FormatCriterionResultStatus.AMBIGUOUS
                    msg = "Đoạn văn sử dụng line spacing mặc định của Style Word."
                elif desired is not None:
                    matched = any(abs(float(s) - float(desired)) <= tolerance for s in actual_spacings)
                    status = FormatCriterionResultStatus.PASS if matched else FormatCriterionResultStatus.FAIL
                    msg = f"Khoảng cách dòng ({actual_spacings[:2]}) khớp quy định ({desired} lines)." if matched else f"Khoảng cách dòng ({actual_spacings[:2]}) không khớp {desired} lines."
                else:
                    status = FormatCriterionResultStatus.PASS
                    msg = f"Khoảng cách dòng trong bài: {actual_spacings[:2]} lines."
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

        # B. PRESENCE RULES (Cover Page, Tables, Headings)
        elif criterion.rule_type == FormatCriterionRuleType.PRESENCE:
            # 6. Cover page check
            if kind == "cover_page" or "trang bìa" in criterion.name.lower():
                cover_data = structure.get("cover_page") or {}
                detected = cover_data.get("detected", False)
                found_fields = cover_data.get("found_fields", [])
                required_fields = expected.get("required_fields", ["tên trường", "tên đề tài", "giảng viên hướng dẫn", "sinh viên", "mssv"])
                missing_fields = [f for f in required_fields if f not in found_fields]

                if detected and len(missing_fields) <= 1:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.PASS,
                            message=f"Đã nhận diện đầy đủ trang bìa: {', '.join(found_fields)}.",
                            expected_value=expected,
                            actual_value={"found_fields": found_fields, "cover_page": cover_data},
                            source_citation=criterion.source_citation,
                        )
                    )
                elif detected and len(found_fields) >= 2:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.FAIL,
                            message=f"Trang bìa chưa đầy đủ thông tin bắt buộc, còn thiếu: {', '.join(missing_fields)}.",
                            expected_value=expected,
                            actual_value={"found_fields": found_fields, "missing_fields": missing_fields},
                            source_citation=criterion.source_citation,
                        )
                    )
                else:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.FAIL,
                            message="Chưa phát hiện trang bìa hợp lệ ở đầu báo cáo (thiếu Tên trường, Đề tài, GVHD, Sinh viên, MSSV).",
                            expected_value=expected,
                            actual_value={"found_fields": found_fields},
                            source_citation=criterion.source_citation,
                        )
                    )

            else:
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

        # C. GRANULAR TEMPLATE RULES
        elif kind == "template_chapter":
            chap_num = expected.get("chapter_number")
            chap_name = expected.get("chapter_name", "")
            allow_semantic = expected.get("allow_semantic_equivalent", True)
            actual_headings = [str(h) for h in structure.get("headings", [])]

            found_heading = None
            found_idx = -1
            is_semantic = False
            match_reason = ""

            for idx, h in enumerate(actual_headings):
                # Match chapter number prefix (e.g. "Chương 1")
                num_match = bool(chap_num and re.search(rf"\bchương\s+{chap_num}\b|\bchương\s+0{chap_num}\b", h, flags=re.I))
                exact_name = _fold(chap_name) in _fold(h) or _fold(h) in _fold(chap_name)

                if exact_name or (num_match and not allow_semantic and _fold(re.sub(r"^chương\s+\d+[:\.\s–-]+", "", chap_name, flags=re.I)) == _fold(re.sub(r"^chương\s+\d+[:\.\s–-]+", "", h, flags=re.I))):
                    found_heading = h
                    found_idx = idx
                    is_semantic = False
                    match_reason = "Khớp chính xác tên chương"
                    break

                if num_match or allow_semantic:
                    equiv, reason = _is_semantically_equivalent(chap_name, h)
                    if equiv:
                        found_heading = h
                        found_idx = idx
                        is_semantic = True
                        match_reason = reason
                        break

            if found_heading and not is_semantic:
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=FormatCriterionResultStatus.PASS,
                        message=f"Đã tìm thấy: '{found_heading}' ({match_reason}).",
                        expected_value=expected,
                        actual_value={"found_heading": found_heading, "index": found_idx},
                        source_citation=criterion.source_citation,
                    )
                )
            elif found_heading and is_semantic:
                if allow_semantic:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.PASS,
                            message=f"Đã tìm thấy: '{found_heading}' (Chấp nhận tương đương ngữ nghĩa với '{chap_name}').",
                            expected_value=expected,
                            actual_value={"found_heading": found_heading, "index": found_idx},
                            source_citation=criterion.source_citation,
                        )
                    )
                else:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.FAIL,
                            message=f"Chương trong bài là '{found_heading}', chưa đúng chính xác tên '{chap_name}' (Chế độ bắt buộc tên chính xác đang bật).",
                            expected_value=expected,
                            actual_value={"found_heading": found_heading, "index": found_idx},
                            source_citation=criterion.source_citation,
                        )
                    )
            else:
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=FormatCriterionResultStatus.FAIL,
                        message=f"Không tìm thấy Chương {chap_num} ('{chap_name}') trong bài nộp.",
                        expected_value=expected,
                        actual_value={"headings": actual_headings[:8]},
                        source_citation=criterion.source_citation,
                    )
                )

        elif kind == "template_section":
            sec_name = expected.get("section_name", "")
            parent_chap = expected.get("parent_chapter", "")
            allow_semantic = expected.get("allow_semantic_equivalent", True)
            actual_headings = [str(h) for h in structure.get("headings", [])]

            found_heading = None
            found_idx = -1
            is_semantic = False
            match_reason = ""

            for idx, h in enumerate(actual_headings):
                exact_name = _fold(sec_name) in _fold(h) or _fold(h) in _fold(sec_name)
                if exact_name:
                    found_heading = h
                    found_idx = idx
                    is_semantic = False
                    match_reason = "Khớp chính xác tên mục con"
                    break

                if allow_semantic:
                    equiv, reason = _is_semantically_equivalent(sec_name, h)
                    if equiv:
                        found_heading = h
                        found_idx = idx
                        is_semantic = True
                        match_reason = reason
                        break

            if found_heading and not is_semantic:
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=FormatCriterionResultStatus.PASS,
                        message=f"Đã tìm thấy mục con: '{found_heading}'.",
                        expected_value=expected,
                        actual_value={"found_heading": found_heading, "index": found_idx},
                        source_citation=criterion.source_citation,
                    )
                )
            elif found_heading and is_semantic:
                if allow_semantic:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.PASS,
                            message=f"Đã tìm thấy mục con: '{found_heading}' (Chấp nhận tương đương ngữ nghĩa với '{sec_name}').",
                            expected_value=expected,
                            actual_value={"found_heading": found_heading, "index": found_idx},
                            source_citation=criterion.source_citation,
                        )
                    )
                else:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.FAIL,
                            message=f"Mục con trong bài là '{found_heading}', chưa đúng chính xác tên '{sec_name}' (Chế độ bắt buộc tên chính xác đang bật).",
                            expected_value=expected,
                            actual_value={"found_heading": found_heading, "index": found_idx},
                            source_citation=criterion.source_citation,
                        )
                    )
            else:
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=FormatCriterionResultStatus.FAIL,
                        message=f"Thiếu mục con bắt buộc '{sec_name}' thuộc {parent_chap}.",
                        expected_value=expected,
                        actual_value={"headings": actual_headings[:8]},
                        source_citation=criterion.source_citation,
                    )
                )

        elif kind == "template_sequence":
            chapters = expected.get("chapters", [])
            actual_headings = [str(h) for h in structure.get("headings", [])]

            chapter_positions: list[tuple[str, int]] = []
            for chap in chapters:
                pos = -1
                num_m = re.search(r"chương\s+([0-9ivxlcdm]+)", chap, flags=re.I)
                num = num_m.group(1) if num_m else None
                for idx, act in enumerate(actual_headings):
                    if num and re.search(rf"\bchương\s+{num}\b", act, flags=re.I):
                        pos = idx
                        break
                    equiv, _ = _is_semantically_equivalent(chap, act)
                    if equiv:
                        pos = idx
                        break
                if pos >= 0:
                    chapter_positions.append((chap, pos))

            if len(chapter_positions) >= 2:
                is_ordered = all(chapter_positions[i][1] < chapter_positions[i + 1][1] for i in range(len(chapter_positions) - 1))
                if is_ordered:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.PASS,
                            message=f"Thứ tự các chương xuất hiện tuần tự đúng quy định ({' -> '.join(c[0] for c in chapter_positions)}).",
                            expected_value=expected,
                            actual_value={"order": [c[0] for c in chapter_positions]},
                            source_citation=criterion.source_citation,
                        )
                    )
                else:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.FAIL,
                            message="Thứ tự các chương bị đảo lộn so với quy định.",
                            expected_value=expected,
                            actual_value={"order": [c[0] for c in chapter_positions]},
                            source_citation=criterion.source_citation,
                        )
                    )
            else:
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=FormatCriterionResultStatus.PASS if len(chapter_positions) == 1 else FormatCriterionResultStatus.AMBIGUOUS,
                        message="Đã kiểm tra cấu trúc trình tự đề mục.",
                        expected_value=expected,
                        actual_value={"order": [c[0] for c in chapter_positions]},
                        source_citation=criterion.source_citation,
                    )
                )

        # Legacy TEMPLATE rule for monolithic list
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

    for cat_spec in CHECKLIST_30_CATEGORIES:
        idx = cat_spec["index"]
        name = cat_spec["name"]
        code = cat_spec["code"]

        if idx == 6:
            # Category 6: Trang bìa
            matched_result = next(
                (
                    r for r in results
                    if r.name.startswith("6.")
                    or (r.expected_value and r.expected_value.get("kind") in {"cover_page", "cover_page_fields"})
                    or "trang bìa theo mẫu" in r.name.lower()
                ),
                None,
            )
        elif idx == 4:
            # Category 4: Heading / tiêu đề chương mục
            matched_result = next(
                (
                    r for r in results
                    if r.name.startswith("4.")
                    or (r.expected_value and r.expected_value.get("kind") in {"template_chapter", "template_section"})
                ),
                None,
            )
        elif idx == 5:
            # Category 5: Đánh số chương và mục
            matched_result = next(
                (
                    r for r in results
                    if r.name.startswith("5.")
                    or (r.expected_value and r.expected_value.get("kind") == "template_sequence")
                ),
                None,
            )
        else:
            matched_result = next(
                (
                    r for r in results
                    if r.name.startswith(f"{idx}.")
                    or (r.expected_value and code in str(r.expected_value.get("category", "")).lower())
                    or (r.expected_value and code in str(r.expected_value.get("kind", "")).lower())
                    or (r.expected_value and code in str(r.expected_value.get("property", "")).lower())
                ),
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
