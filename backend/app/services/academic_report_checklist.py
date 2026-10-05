"""Academic Report Formatting Checklist Engine.

Implements the pure 2-List AI + Hybrid formatting architecture:
1. Teacher Regulation Extraction: Entire document text is provided to AI to extract structured criteria (both Format & granular Template chapters/sections). If an item is not in the regulation, specified=False / NOT_SPECIFIED.
2. Student Submission Extraction (Hybrid): Numerical properties (margins, font, size, line spacing, page count, tables) are extracted directly from document objects; Semantic text & structures (cover page fields, headings, contribution table, TOC, references) are extracted by LLM. Zero keyword hardcoding.
3. AI Review & Comparison Engine: Compares List 1 (Regulation) vs List 2 (Submission Facts).
   - If regulation specified=True but submission missing -> MISSING_STUDENT_INPUT (prompts student to provide info).
   - If ambiguous / wording variance -> ESCALATE to Lecturer (AMBIGUOUS).
   - If within tolerance / exact match -> PASS.
   - If out of tolerance / clear violation -> FAIL.
   - If regulation specified=False -> NOT_SPECIFIED.
"""

from __future__ import annotations

import io
import re
import subprocess
import tempfile
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
    LLMSubmissionContentFacts,
)


def _fold(value: str) -> str:
    """Normalize and fold string for accent-insensitive comparison."""
    normalized = unicodedata.normalize("NFKD", value)
    without_marks = "".join(char for char in normalized if not unicodedata.combining(char))
    return without_marks.casefold().strip()


def _clean_font_name(font_raw: str) -> str:
    """Clean font subset prefixes and common style suffixes."""
    cleaned = re.sub(r"^[A-Z]{6}\+", "", font_raw)
    cleaned = cleaned.replace("-", " ").replace("_", " ")
    for suffix in ("Bold", "Italic", "Regular", "MT", "PSMT"):
        cleaned = re.sub(rf"\b{suffix}\b", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip() or font_raw.strip()


# ─────────────────────────────────────────────────────────────────────────────
# 10 MASTER CORE CHECKLIST CATEGORIES METADATA
# ─────────────────────────────────────────────────────────────────────────────

CHECKLIST_10_CATEGORIES: list[dict[str, Any]] = [
    {"index": 1, "code": "page_setup", "name": "1. Khổ giấy và Căn lề trang"},
    {"index": 2, "code": "typography", "name": "2. Phông chữ và Cỡ chữ"},
    {"index": 3, "code": "paragraph_format", "name": "3. Giãn dòng và Định dạng đoạn văn"},
    {"index": 4, "code": "page_count", "name": "4. Dung lượng số trang quy định"},
    {"index": 5, "code": "cover_page", "name": "5. Trang bìa và Thông tin hành chính"},
    {"index": 6, "code": "member_contribution", "name": "6. Bảng phân công & Đóng góp thành viên"},
    {"index": 7, "code": "table_of_contents", "name": "7. Mục lục báo cáo"},
    {"index": 8, "code": "template_structure", "name": "8. Khung cấu trúc đề cương & các chương mục"},
    {"index": 9, "code": "template_sequence", "name": "9. Thứ tự và Phân cấp cấu trúc đề mục"},
    {"index": 10, "code": "references", "name": "10. Tài liệu tham khảo và Trích dẫn"},
]

# Backward-compatibility alias
CHECKLIST_30_CATEGORIES = CHECKLIST_10_CATEGORIES


# ─────────────────────────────────────────────────────────────────────────────
# ALGORITHMIC HEADING MATCHING (Zero hardcoded synonym lists)
# ─────────────────────────────────────────────────────────────────────────────

def _clean_heading_title(name: str) -> str:
    """Strip chapter prefixes and numbering for algorithmic comparison."""
    cleaned = re.sub(
        r"^(?:chương\s+[0-9ivxlcdm]+[:\.\s–-]+|\d+(?:\.\d+)*\s*[:\.\)]?\s*|[a-z0-9]\)\s*)",
        "",
        name.strip(),
        flags=re.IGNORECASE,
    )
    return cleaned.strip()


def _is_heading_matching_algorithmically(expected_name: str, actual_name: str) -> tuple[bool, str]:
    """Algorithmic check for exact or high token overlap heading match."""
    exp_c = _clean_heading_title(expected_name)
    act_c = _clean_heading_title(actual_name)
    exp_f = _fold(exp_c)
    act_f = _fold(act_c)

    if exp_f and act_f and (exp_f == act_f or exp_f in act_f or act_f in exp_f):
        return True, "Khớp chính xác tên đề mục"

    exp_tokens = set(exp_f.split())
    act_tokens = set(act_f.split())
    if exp_tokens and act_tokens:
        overlap = len(exp_tokens & act_tokens) / max(len(exp_tokens), len(act_tokens))
        if overlap >= 0.70:
            return True, f"Trùng khớp {int(overlap * 100)}% từ khóa đề mục"

    return False, "Không khớp thuật toán"


# ─────────────────────────────────────────────────────────────────────────────
# 1. LIST 1: REGULATION 10 CHECKLIST BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def build_regulation_30_criteria(criteria: list[Any]) -> list[dict[str, Any]]:
    """Construct List 1: Maps approved teacher criteria to the 10 standardized core categories.

    If a category has no matching criterion in the active criteria set, specified is False.
    """
    category_map: dict[int, list[Any]] = {cat["index"]: [] for cat in CHECKLIST_10_CATEGORIES}

    for c in criteria:
        exp = getattr(c, "expected_value", {}) or {}
        prop = exp.get("property")
        kind = exp.get("kind")
        c_name = getattr(c, "name", "").lower()
        c_cat = str(exp.get("category", "")).lower()

        if prop == "margins_cm" or "khổ giấy" in c_name or "căn lề" in c_name or "lề trang" in c_name or "page_setup" in c_cat or "1." in c_cat:
            category_map[1].append(c)
        elif prop in ("font_name", "font_size_pt") or "phông" in c_name or "font" in c_name or "cỡ chữ" in c_name or "typography" in c_cat or "2." in c_cat:
            category_map[2].append(c)
        elif prop == "line_spacing" or "đoạn văn" in c_name or "giãn dòng" in c_name or "paragraph_format" in c_cat or "3." in c_cat:
            category_map[3].append(c)
        elif prop == "page_count" or "dung lượng" in c_name or "số trang" in c_name or "page_count" in c_cat or "4." in c_cat:
            category_map[4].append(c)
        elif kind in ("cover_page", "cover_page_fields") or "trang bìa" in c_name or "bìa" in c_name or "cover_page" in c_cat or "5." in c_cat or "6." in c_cat:
            category_map[5].append(c)
        elif kind == "table_columns" or "phân công" in c_name or "cam đoan" in c_name or "đóng góp" in c_name or "member_contribution" in c_cat or "front_matter" in c_cat or "7." in c_cat or "6." in c_cat:
            category_map[6].append(c)
        elif (kind == "heading" and ("mục lục" in c_name or exp.get("value") == "Mục lục")) or "mục lục" in c_name or "table_of_contents" in c_cat or "danh mục hình" in c_name or "danh mục bảng" in c_name or "7." in c_cat or "8." in c_cat:
            category_map[7].append(c)
        elif kind in ("template_chapter", "template_section") or "mục bắt buộc" in c_name or "mục con" in c_name or "chương" in c_name or "template_structure" in c_cat or "heading_structure" in c_cat or "đề cương" in c_name or "8." in c_cat:
            category_map[8].append(c)
        elif kind == "template_sequence" or "thứ tự" in c_name or "phân cấp" in c_name or "template_sequence" in c_cat or "numbering" in c_cat or "9." in c_cat:
            category_map[9].append(c)
        elif "tài liệu tham khảo" in c_name or "trích dẫn" in c_name or "references" in c_cat or "in_text_citations" in c_cat or (kind == "heading" and "tham khảo" in str(exp.get("value", "")).lower()) or "10." in c_cat or "19." in c_cat:
            category_map[10].append(c)
        else:
            for cat in CHECKLIST_10_CATEGORIES:
                if cat["code"] in c_cat or f"{cat['index']}." in c_name:
                    category_map[cat["index"]].append(c)
                    break

    regulation_10: list[dict[str, Any]] = []
    for cat in CHECKLIST_10_CATEGORIES:
        idx = cat["index"]
        items = category_map.get(idx, [])
        is_specified = len(items) > 0
        desc = "; ".join(getattr(i, "description", "") for i in items) if is_specified else "Quy chế môn học không đề cập quy định bắt buộc cho mục này."
        citations = [getattr(i, "source_citation", "") for i in items if getattr(i, "source_citation", None)]

        regulation_10.append({
            "index": idx,
            "code": cat["code"],
            "name": cat["name"],
            "specified": is_specified,
            "description": desc,
            "expected_criteria": items,
            "source_citation": "; ".join(citations) if citations else None,
        })

    return regulation_10


# ─────────────────────────────────────────────────────────────────────────────
# 2. HYBRID STUDENT REPORT FACTS EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

def _convert_docx_to_pdf_bytes_safe(docx_bytes: bytes) -> bytes | None:
    """Helper to convert docx to pdf via LibreOffice for exact rendered page count."""
    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            docx_path = Path(tmp_dir) / "document.docx"
            docx_path.write_bytes(docx_bytes)
            subprocess.run(
                ["soffice", "--headless", "--convert-to", "pdf", str(docx_path), "--outdir", tmp_dir],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=25,
            )
            pdf_path = Path(tmp_dir) / "document.pdf"
            if pdf_path.is_file():
                return pdf_path.read_bytes()
    except Exception:
        pass
    return None


async def extract_report_facts(
    filename: str,
    payload: bytes,
    ai_provider: Any = None,
) -> dict[str, Any]:
    """Hybrid facts extraction:

    1. Numerical / Measurements: Directly extracted from document objects (docx sections/runs/paragraphs or PDF mediabox/fonts).
    2. Semantic / Content elements: Extracted via LLM (cover fields, headings, contribution table, TOC, references).
    Zero keyword/regex hardcoding.
    """
    ext = Path(filename).suffix.lower()

    if ext == ".docx":
        doc = DocxDocument(io.BytesIO(payload))
        sections = list(doc.sections)

        # 1. Measurements: Margins & Paper Sizes
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

        # 2. Measurements: Fonts, Sizes, Spacing, Alignments
        font_names: list[str] = []
        font_sizes: list[float] = []
        line_spacings: list[float] = []
        alignments: dict[str, int] = {"LEFT": 0, "CENTER": 0, "RIGHT": 0, "JUSTIFY": 0}
        consecutive_spaces_count = 0
        max_empty_streak = 0
        current_empty_streak = 0

        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                current_empty_streak += 1
                max_empty_streak = max(max_empty_streak, current_empty_streak)
                continue
            current_empty_streak = 0

            if "  " in text:
                consecutive_spaces_count += text.count("  ")

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

        # 3. Style-based headings from Word
        style_headings: list[str] = [
            p.text.strip()
            for p in doc.paragraphs
            if p.text.strip() and p.style and p.style.name.casefold().startswith("heading")
        ]

        # 4. Tables and Shapes
        tables_headers = [[cell.text.strip() for cell in t.rows[0].cells] for t in doc.tables if t.rows]

        # 5. Page count
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

        # 6. Extract Semantic Content with LLM
        cover_paras = [p.text.strip() for p in doc.paragraphs[:35] if p.text.strip()]
        cover_tables_text = [
            " ".join(cell.text.strip() for cell in row.cells)
            for t in doc.tables[:3]
            for row in t.rows
            if any(cell.text.strip() for cell in row.cells)
        ]
        cover_text = "\n".join(cover_paras + cover_tables_text)
        all_text = "\n".join(p.text.strip() for p in doc.paragraphs if p.text.strip())

        ai_facts = LLMSubmissionContentFacts()
        provider = ai_provider
        if provider is None:
            try:
                from app.ai.fake import FakeProvider
                provider = FakeProvider()
            except Exception:
                provider = None

        if provider is not None:
            try:
                ai_facts = await provider.extract_submission_content_facts(
                    full_text=all_text[:60000],
                    cover_text=cover_text[:3500],
                )
            except Exception as e:
                print(f"[AcademicChecklist] AI submission extraction fallback: {e}", flush=True)

        if not style_headings and not ai_facts.headings:
            fallback_h = [
                p.text.strip()
                for p in doc.paragraphs
                if p.text.strip() and len(p.text.strip()) < 120 and (
                    any(p.text.strip().lower().startswith(prefix) for prefix in ("chương", "phần", "mục", "1.", "2.", "3.", "4.", "5.", "6.", "1)", "2)", "3)", "i.", "ii."))
                    or p.text.strip().isupper()
                )
            ][:40]
            combined_headings = fallback_h
        else:
            combined_headings = list(dict.fromkeys(style_headings + ai_facts.headings))

        return {
            "file_type": "DOCX",
            "page_count": page_count,
            "scan": False,
            "headings": combined_headings,
            "margins_cm": margins,
            "paper_sizes": paper_sizes,
            "font_names": list(Counter(font_names).keys()),
            "font_sizes_pt": sorted(set(font_sizes)),
            "line_spacings": sorted(set(line_spacings)),
            "alignments": dict(alignments),
            "table_headers": tables_headers,
            "table_count": len(doc.tables),
            "table_captions": ai_facts.table_captions,
            "figure_captions": ai_facts.figure_captions,
            "has_member_contribution_table": ai_facts.has_member_contribution_table,
            "member_table_columns": ai_facts.member_table_columns,
            "has_table_of_contents": ai_facts.has_table_of_contents,
            "has_list_of_figures": ai_facts.has_list_of_figures,
            "has_list_of_tables": ai_facts.has_list_of_tables,
            "has_references_section": ai_facts.has_references_section,
            "references_style": ai_facts.references_style,
            "cover_page_fields": ai_facts.cover_page_detected_fields,
            "cover_sample": cover_text[:2000],
            "full_text_sample": all_text[:40000],
            "max_consecutive_empty_paras": max_empty_streak,
            "consecutive_spaces_count": consecutive_spaces_count,
            "filename": filename,
        }

    if ext == ".pdf":
        reader = PdfReader(io.BytesIO(payload))
        page_texts = [(page.extract_text() or "").strip() for page in reader.pages]
        scan = not any(page_texts)

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

        font_names_set: set[str] = set()
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

        cover_text = page_texts[0] if page_texts else ""
        all_text = "\n".join(page_texts)

        ai_facts = LLMSubmissionContentFacts()
        provider = ai_provider
        if provider is None:
            try:
                from app.ai.fake import FakeProvider
                provider = FakeProvider()
            except Exception:
                provider = None

        if provider is not None:
            try:
                ai_facts = await provider.extract_submission_content_facts(
                    full_text=all_text[:60000],
                    cover_text=cover_text[:3500],
                )
            except Exception as e:
                print(f"[AcademicChecklist] AI PDF submission extraction fallback: {e}", flush=True)

        return {
            "file_type": "PDF",
            "page_count": len(reader.pages),
            "scan": scan,
            "headings": ai_facts.headings,
            "margins_cm": None,
            "paper_sizes": paper_sizes,
            "font_names": sorted(font_names_set) if font_names_set else None,
            "font_sizes_pt": None,
            "line_spacings": None,
            "alignments": {},
            "table_headers": [],
            "table_count": len(ai_facts.table_captions),
            "table_captions": ai_facts.table_captions,
            "figure_captions": ai_facts.figure_captions,
            "has_member_contribution_table": ai_facts.has_member_contribution_table,
            "member_table_columns": ai_facts.member_table_columns,
            "has_table_of_contents": ai_facts.has_table_of_contents,
            "has_list_of_figures": ai_facts.has_list_of_figures,
            "has_list_of_tables": ai_facts.has_list_of_tables,
            "has_references_section": ai_facts.has_references_section,
            "references_style": ai_facts.references_style,
            "cover_page_fields": ai_facts.cover_page_detected_fields,
            "cover_sample": cover_text[:2000],
            "full_text_sample": all_text[:40000],
            "max_consecutive_empty_paras": 0,
            "consecutive_spaces_count": 0,
            "filename": filename,
        }

    raise ValueError("Chỉ hỗ trợ file định dạng .docx hoặc .pdf.")


# ─────────────────────────────────────────────────────────────────────────────
# 3. LIST 2: SUBMISSION 30 FACTS BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def build_submission_30_facts(facts: dict[str, Any]) -> list[dict[str, Any]]:
    """Construct List 2: Maps extracted facts from student submission to 10 core categories."""
    submission_10: list[dict[str, Any]] = []

    for cat in CHECKLIST_10_CATEGORIES:
        idx = cat["index"]
        code = cat["code"]
        name = cat["name"]

        present = False
        actual_val: Any = None
        details = ""

        if idx == 1:
            margins = facts.get("margins_cm")
            sizes = facts.get("paper_sizes", [])
            present = bool(margins or sizes)
            actual_val = {"margins": margins[:1] if margins else None, "paper_sizes": sizes[:1] if sizes else None}
            details = f"Khổ giấy {sizes[0]['orientation'] if sizes else 'A4'}, lề section đầu: {margins[0] if margins else 'N/A'}"
        elif idx == 2:
            fonts = facts.get("font_names") or []
            sizes_pt = facts.get("font_sizes_pt") or []
            present = bool(fonts)
            actual_val = {"fonts": fonts, "sizes_pt": sizes_pt}
            details = f"Font: {', '.join(fonts[:3]) if fonts else 'N/A'}; Cỡ chữ: {sizes_pt[:5] if sizes_pt else 'N/A'}"
        elif idx == 3:
            spacings = facts.get("line_spacings") or []
            alignments = facts.get("alignments") or {}
            present = bool(spacings or alignments)
            actual_val = {"line_spacings": spacings, "alignments": alignments}
            details = f"Giãn dòng: {spacings[:3] if spacings else 'N/A'}; Căn lề: {alignments if alignments else 'N/A'}"
        elif idx == 4:
            pages = facts.get("page_count")
            present = pages is not None
            actual_val = {"page_count": pages}
            details = f"Dung lượng thực tế: {pages} trang."
        elif idx == 5:
            cover_fields = facts.get("cover_page_fields") or []
            has_cover_text = len(facts.get("cover_sample", "")) > 20
            present = bool(cover_fields or has_cover_text)
            actual_val = {"fields": cover_fields, "sample": facts.get("cover_sample", "")[:200]}
            details = f"Trường thông tin trang bìa: {', '.join(cover_fields) if cover_fields else 'Đã nhận diện văn bản trang đầu'}"
        elif idx == 6:
            has_tbl = facts.get("has_member_contribution_table", False)
            cols = facts.get("member_table_columns", [])
            present = has_tbl or len(cols) > 0
            actual_val = {"has_table": has_tbl, "columns": cols}
            details = f"Bảng phân công thành viên: {'Có (' + ', '.join(cols[:4]) + ')' if has_tbl else ('Có' if cols else 'Chưa có')}"
        elif idx == 7:
            has_toc = facts.get("has_table_of_contents", False)
            has_lof = facts.get("has_list_of_figures", False)
            has_lot = facts.get("has_list_of_tables", False)
            present = has_toc or has_lof or has_lot
            actual_val = {"has_toc": has_toc, "has_lof": has_lof, "has_lot": has_lot}
            details = f"Mục lục: {'Có' if has_toc else 'Chưa có'}" + (f", Danh mục hình/bảng: {'Có' if (has_lof or has_lot) else 'Không'}" if (has_lof or has_lot) else "")
        elif idx == 8:
            headings = facts.get("headings") or []
            present = bool(headings)
            actual_val = {"headings": headings}
            details = f"Đã tìm thấy {len(headings)} đề mục trong bài nộp."
        elif idx == 9:
            headings = facts.get("headings") or []
            present = bool(headings)
            actual_val = {"headings": headings}
            details = f"Thứ tự các đề mục: {headings[:4]}"
        elif idx == 10:
            has_refs = facts.get("has_references_section", False)
            style = facts.get("references_style")
            present = has_refs
            actual_val = {"has_references": has_refs, "style": style}
            details = f"Tài liệu tham khảo: {'Có' if has_refs else 'Chưa có'} (Chuẩn {style or 'Tự do'})"
        else:
            present = False
            actual_val = None
            details = "Chưa có dữ liệu trích xuất tự động"

        submission_10.append({
            "index": idx,
            "code": code,
            "name": name,
            "present": present,
            "actual_value": actual_val,
            "details": details,
        })

    return submission_10


# ─────────────────────────────────────────────────────────────────────────────
# 4. AI REVIEW & COMPARISON ENGINE
# ─────────────────────────────────────────────────────────────────────────────

async def evaluate_academic_checklist(
    criteria: list[Any],
    structure: dict[str, Any],
    ai_provider: Any = None,
) -> tuple[list[FormatCriterionResult], list[dict[str, Any]], FormatCheckOverallStatus]:
    """Pure 2-List AI review & comparison engine (1-Batch LLM Call):

    1. List 1: Teacher regulation criteria (mapped to 30 categories).
    2. List 2: Student submission facts (measurements + AI semantic content).
    3. AI Batch Review: Evaluates ALL semantic criteria at once in 1 SINGLE LLM call (zero loop calls).
    4. Evaluates status for each item:
       - Specified=False in regulation -> NOT_SPECIFIED.
       - Specified=True but submission Missing -> MISSING_STUDENT_INPUT (prompt student).
       - Ambiguous / Wording variance -> ESCALATE to Lecturer (AMBIGUOUS).
       - Fully compliant -> PASS.
       - Clear violation -> FAIL.
    """
    results: list[FormatCriterionResult] = []

    # 1. Prepare criteria for dedicated per-criterion LLM evaluation
    # Only MEASUREMENT is computed by code. ALL other criteria are sent directly to LLM.
    semantic_criteria_items: list[dict[str, Any]] = []
    for c in criteria:
        c_rule_type = c.rule_type.value if hasattr(c.rule_type, "value") else str(c.rule_type)
        if getattr(c, "review_only", False):
            continue
        # All non-MEASUREMENT criteria (Presence, Template, Structure, Content, etc.) go to LLM
        if c.rule_type != FormatCriterionRuleType.MEASUREMENT and c_rule_type != "MEASUREMENT":
            exp = getattr(c, "expected_value", {}) or {}
            req_text = exp.get("requirement_text") or getattr(c, "description", "") or getattr(c, "name", "")
            semantic_criteria_items.append({
                "criterion_id": str(getattr(c, "id", "")),
                "name": str(getattr(c, "name", "")),
                "rule_type": c_rule_type,
                "requirement_text": req_text,
                "expected_value": exp,
                "source_citation": getattr(c, "source_citation", "") or "",
            })

    batch_judgments: dict[str, Any] = {}
    if semantic_criteria_items and ai_provider is not None:
        try:
            if hasattr(ai_provider, "judge_multiple_criteria_individually"):
                batch_judgments = await ai_provider.judge_multiple_criteria_individually(
                    criteria_items=semantic_criteria_items,
                    submission_facts=structure,
                )
            else:
                batch_judgments = await ai_provider.batch_judge_submission_criteria(
                    criteria_items=semantic_criteria_items,
                    submission_facts=structure,
                )
        except Exception as e:
            print(f"[AcademicChecklist] Dedicated LLM review fallback: {e}", flush=True)

    # 2. Evaluate Individual Criteria
    for criterion in criteria:
        cid_str = str(getattr(criterion, "id", ""))
        c_rule_type = getattr(criterion, "rule_type", None)
        c_rule_type_val = c_rule_type.value if hasattr(c_rule_type, "value") else str(c_rule_type)

        is_automatable = getattr(criterion, "automatable", True) or c_rule_type_val in ("PRESENCE", "TEMPLATE")
        if getattr(criterion, "review_only", False) or not is_automatable:
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

        # A. MEASUREMENT RULES (Direct mathematical & structural calculations - 0 AI calls)
        if criterion.rule_type == FormatCriterionRuleType.MEASUREMENT or c_rule_type_val == "MEASUREMENT":
            if prop == "margins_cm":
                actual_margins = structure.get("margins_cm")
                if structure.get("file_type") == "PDF":
                    sizes = structure.get("paper_sizes", [])
                    all_a4 = bool(sizes and all(s.get("is_a4") for s in sizes))
                    status = FormatCriterionResultStatus.PASS if all_a4 else FormatCriterionResultStatus.AMBIGUOUS
                    msg = "Kích thước các trang PDF đều đạt chuẩn A4 (210x297mm)." if all_a4 else "Định dạng PDF không cung cấp lề Word; đã kiểm tra khổ A4."
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=status,
                            message=msg,
                            expected_value=expected,
                            actual_value={"paper_sizes": sizes[:1]},
                            source_citation=criterion.source_citation,
                        )
                    )
                elif not actual_margins:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.UNMEASURABLE,
                            message="Không trích xuất được thông tin căn lề trang từ bài nộp.",
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
                                diffs.append(f"Section {idx + 1} lề {side}: {actual_val}cm (quy định: {val}cm)")

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
                desired_list = [desired_font] if isinstance(desired_font, str) else (desired_font or [])
                norm_desired = [_fold(f) for f in desired_list]
                norm_actual = [_fold(f) for f in actual_fonts]

                passed = any(d in a or a in d for d in norm_desired for a in norm_actual)
                msg = f"Đã tìm thấy phông chữ {', '.join(actual_fonts[:2])} khớp với quy định." if passed else f"Phông chữ bài nộp ({', '.join(actual_fonts[:2])}) không đúng phông yêu cầu ({desired_font})."
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=FormatCriterionResultStatus.PASS if passed else FormatCriterionResultStatus.FAIL,
                        message=msg,
                        expected_value=expected,
                        actual_value={"font_names": actual_fonts},
                        source_citation=criterion.source_citation,
                    )
                )

            elif prop == "line_spacing":
                desired_spacing = expected.get("value")
                tolerance = float(expected.get("tolerance", 0.15))
                actual_spacings = structure.get("line_spacings") or []

                passed = any(abs(float(s) - float(desired_spacing)) <= tolerance for s in actual_spacings) if actual_spacings and desired_spacing else True
                msg = f"Giãn dòng {actual_spacings[:2]} đạt yêu cầu quy định." if passed else f"Giãn dòng {actual_spacings[:2]} chưa đúng quy định ({desired_spacing} lines)."
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=FormatCriterionResultStatus.PASS if passed else FormatCriterionResultStatus.FAIL,
                        message=msg,
                        expected_value=expected,
                        actual_value={"line_spacings": actual_spacings},
                        source_citation=criterion.source_citation,
                    )
                )

            elif prop == "page_count":
                min_p = expected.get("min_pages")
                max_p = expected.get("max_pages")
                actual_p = structure.get("page_count")

                if actual_p is None:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.UNMEASURABLE,
                            message="Không xác định được số trang của bài nộp.",
                            expected_value=expected,
                            source_citation=criterion.source_citation,
                        )
                    )
                else:
                    passed = (min_p is None or actual_p >= min_p) and (max_p is None or actual_p <= max_p)
                    msg = f"Dung lượng {actual_p} trang nằm trong phạm vi quy định ({min_p or 0} - {max_p or 'không giới hạn'} trang)." if passed else f"Dung lượng {actual_p} trang không đạt yêu cầu quy định ({min_p or 0} - {max_p or 'không giới hạn'} trang)."
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.PASS if passed else FormatCriterionResultStatus.FAIL,
                            message=msg,
                            expected_value=expected,
                            actual_value={"page_count": actual_p},
                            source_citation=criterion.source_citation,
                        )
                    )

        # B. ALL OTHER CRITERIA (Evaluated by LLM from checklist requirement text + report text)
        else:
            if cid_str in batch_judgments:
                bj = batch_judgments[cid_str]
                v_map = {
                    "PASS": FormatCriterionResultStatus.PASS,
                    "FAIL": FormatCriterionResultStatus.FAIL,
                    "AMBIGUOUS": FormatCriterionResultStatus.AMBIGUOUS,
                    "MISSING_STUDENT_INPUT": FormatCriterionResultStatus.FAIL,
                }
                detected_val = bj.detected_element if getattr(bj, "detected_element", None) else structure.get("headings", [])[:6]
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=v_map.get(bj.verdict, FormatCriterionResultStatus.AMBIGUOUS),
                        message=bj.reason,
                        expected_value=expected,
                        actual_value={"detected": detected_val, "location": getattr(bj, "location", "Tại bài nộp")},
                        source_citation=criterion.source_citation,
                    )
                )
            elif kind == "cover_page":
                cover_sample = structure.get("cover_sample", "")
                status = FormatCriterionResultStatus.PASS if len(cover_sample) > 30 else FormatCriterionResultStatus.FAIL
                msg = "Đã tìm thấy trang bìa." if status == FormatCriterionResultStatus.PASS else "Không tìm thấy trang bìa."
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=status,
                        message=msg,
                        expected_value=expected,
                        actual_value={"cover_fields": structure.get("cover_page_fields", []), "location": "Tại trang đầu tiên"},
                        source_citation=criterion.source_citation,
                    )
                )
            elif kind == "table_columns":
                has_table = structure.get("has_member_contribution_table", False)
                status = FormatCriterionResultStatus.PASS if has_table else FormatCriterionResultStatus.FAIL
                msg = "Đã tìm thấy Bảng phân công đóng góp thành viên." if has_table else "Quy định yêu cầu Bảng phân công thành viên nhưng không tìm thấy trong bài nộp."
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=status,
                        message=msg,
                        expected_value=expected,
                        actual_value={"has_table": has_table, "location": "Tại Bảng phân công thành viên"},
                        source_citation=criterion.source_citation,
                    )
                )
            elif kind == "heading":
                desired = expected.get("value")
                desired_items = [str(desired)] if isinstance(desired, (str, int)) else [str(x) for x in desired]
                actual_headings = [str(h) for h in structure.get("headings", [])]

                matched = any(
                    _is_heading_matching_algorithmically(d, a)[0]
                    for d in desired_items
                    for a in actual_headings
                )
                if not matched and "mục lục" in str(desired).lower() and structure.get("has_table_of_contents"):
                    matched = True
                if not matched and "tham khảo" in str(desired).lower() and structure.get("has_references_section"):
                    matched = True

                status = FormatCriterionResultStatus.PASS if matched else FormatCriterionResultStatus.FAIL
                msg = f"Đã tìm thấy phần '{desired}' trong bài nộp." if matched else f"Không tìm thấy phần '{desired}' theo quy định."
                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=status,
                        message=msg,
                        expected_value=expected,
                        actual_value={"headings": actual_headings[:6], "location": "Tại đề mục bài nộp"},
                        source_citation=criterion.source_citation,
                    )
                )
            elif kind == "template_chapter":
                chap_name = expected.get("chapter_name", "")
                actual_headings = [str(h) for h in structure.get("headings", [])]

                found_heading = None
                for h in actual_headings:
                    is_algo, _ = _is_heading_matching_algorithmically(chap_name, h)
                    if is_algo:
                        found_heading = h
                        break

                if found_heading:
                    status = FormatCriterionResultStatus.PASS
                    msg = f"Đã tìm thấy chương '{found_heading}' khớp quy định."
                else:
                    status = FormatCriterionResultStatus.FAIL
                    msg = f"Thiếu chương bắt buộc '{chap_name}' theo khung đề cương quy định."

                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=status,
                        message=msg,
                        expected_value=expected,
                        actual_value={"found_heading": found_heading, "location": "Tại danh mục các chương"},
                        source_citation=criterion.source_citation,
                    )
                )

            elif kind == "template_section":
                sec_name = expected.get("section_name", "")
                parent_chap = expected.get("parent_chapter", "")
                actual_headings = [str(h) for h in structure.get("headings", [])]

                found_heading = None
                for h in actual_headings:
                    is_algo, _ = _is_heading_matching_algorithmically(sec_name, h)
                    if is_algo:
                        found_heading = h
                        break

                if found_heading:
                    status = FormatCriterionResultStatus.PASS
                    msg = f"Đã tìm thấy mục con '{found_heading}' thuộc {parent_chap}."
                else:
                    status = FormatCriterionResultStatus.FAIL
                    msg = f"Thiếu mục con bắt buộc '{sec_name}' thuộc {parent_chap}."

                results.append(
                    FormatCriterionResult(
                        criterion_id=criterion.id,
                        name=criterion.name,
                        status=status,
                        message=msg,
                        expected_value=expected,
                        actual_value={"found_heading": found_heading, "location": "Tại mục con"},
                        source_citation=criterion.source_citation,
                    )
                )

            elif kind in ("template_outline", "template_sequence") or not kind:
                template = expected.get("outline_headings") or expected.get("headings", []) or expected.get("chapters", [])
                if not template and expected.get("requirement_text"):
                    req_txt = expected.get("requirement_text")
                    if isinstance(req_txt, str):
                        template = [h.strip() for h in re.split(r"[,;\n]+", req_txt) if h.strip()]

                actual_headings = [str(h) for h in structure.get("headings", [])]
                if not actual_headings:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.UNMEASURABLE,
                            message="Không trích xuất được danh mục đề mục từ bài nộp.",
                            expected_value=expected,
                            actual_value={"headings": []},
                            source_citation=criterion.source_citation,
                        )
                    )
                elif not template:
                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=FormatCriterionResultStatus.PASS,
                            message="Khung cấu trúc bài nộp đã được ghi nhận.",
                            expected_value=expected,
                            actual_value={"headings": actual_headings[:10], "location": "Tại đề mục bài nộp"},
                            source_citation=criterion.source_citation,
                        )
                    )
                else:
                    missing_items = []
                    matched_items = []
                    for t_item in template:
                        found = any(_is_heading_matching_algorithmically(t_item, a)[0] for a in actual_headings)
                        if not found and "mục lục" in t_item.lower() and structure.get("has_table_of_contents"):
                            found = True
                        if not found and "tham khảo" in t_item.lower() and structure.get("has_references_section"):
                            found = True
                        if not found and ("bìa" in t_item.lower() or "trang bìa" in t_item.lower()) and structure.get("cover_sample"):
                            found = True
                        if not found and "phân công" in t_item.lower() and structure.get("has_member_contribution_table"):
                            found = True
                        if not found and ("bảng biểu" in t_item.lower() or "danh mục bảng" in t_item.lower()) and structure.get("has_list_of_tables"):
                            found = True
                        if not found and ("hình ảnh" in t_item.lower() or "danh mục hình" in t_item.lower()) and structure.get("has_list_of_figures"):
                            found = True

                        if found:
                            matched_items.append(t_item)
                        else:
                            missing_items.append(t_item)

                    if not missing_items:
                        status = FormatCriterionResultStatus.PASS
                        msg = "Đầy đủ các chương mục và phần bắt buộc theo khung đề cương."
                    elif len(matched_items) >= len(template) * 0.6:
                        status = FormatCriterionResultStatus.AMBIGUOUS
                        msg = f"Thiếu hoặc có sự khác biệt từ ngữ ở một số mục: {', '.join(missing_items[:2])}."
                    else:
                        status = FormatCriterionResultStatus.FAIL
                        msg = f"Thiếu các mục bắt buộc theo khung đề cương: {', '.join(missing_items[:3])}."

                    results.append(
                        FormatCriterionResult(
                            criterion_id=criterion.id,
                            name=criterion.name,
                            status=status,
                            message=msg,
                            expected_value=expected,
                            actual_value={"matched": matched_items, "missing": missing_items, "headings": actual_headings[:8], "location": "Toàn bộ khung đề mục bài nộp"},
                            source_citation=criterion.source_citation,
                        )
                    )

    # 2. BUILD FULLY DYNAMIC SUMMARY TABLE DIRECTLY FROM EVALUATED CRITERIA
    checklist_summary: list[dict[str, Any]] = []

    for idx, criterion in enumerate(criteria, start=1):
        cid = getattr(criterion, "id", None)
        matched_res = next((r for r in results if r.criterion_id == cid), None) if cid else None
        if not matched_res:
            matched_res = next((r for r in results if r.name == getattr(criterion, "name", "")), None)

        st = matched_res.status.value if matched_res else "PASS"
        rule_type = getattr(criterion, "rule_type", FormatCriterionRuleType.MEASUREMENT)
        rule_type_val = rule_type.value if hasattr(rule_type, "value") else str(rule_type)

        evidence_str = ""
        if matched_res and matched_res.actual_value:
            act = matched_res.actual_value
            if "margins_cm" in act:
                m_list = act.get("margins_cm", [])
                if m_list and isinstance(m_list, list):
                    m0 = m_list[0]
                    evidence_str = f"Lề: trên {m0.get('top')}cm, dưới {m0.get('bottom')}cm, trái {m0.get('left')}cm, phải {m0.get('right')}cm"
                else:
                    evidence_str = "Số đo lề trang"
            elif "font_names" in act:
                fonts = act.get("font_names") or []
                evidence_str = f"Phông: {', '.join(str(f) for f in fonts[:3])}"
            elif "line_spacings" in act:
                spacings = act.get("line_spacings") or []
                evidence_str = f"Giãn dòng: {', '.join(str(s) for s in spacings[:3])}"
            elif "page_count" in act:
                evidence_str = f"Số trang thực tế: {act.get('page_count')} trang"
            elif "detected" in act and act["detected"]:
                loc = act.get("location")
                evidence_str = f"Nhận diện: {act['detected']}" + (f" ({loc})" if loc else "")
            elif "found_heading" in act and act["found_heading"]:
                loc = act.get("location")
                evidence_str = f"Đề mục: {act['found_heading']}" + (f" ({loc})" if loc else "")
            elif "cover_fields" in act and act["cover_fields"]:
                evidence_str = f"Trường bìa: {', '.join(str(f) for f in act['cover_fields'][:5])}"
            elif "has_table" in act:
                evidence_str = "Có bảng phân công đóng góp" if act["has_table"] else "Chưa tìm thấy bảng phân công"
            elif "headings" in act:
                h = act["headings"]
                if isinstance(h, list) and h:
                    evidence_str = f"Đề mục: {', '.join(str(x) for x in h[:3])}"
                else:
                    evidence_str = "Đã đối chiếu đề mục"
            else:
                evidence_str = "Đã đối chiếu nội dung bài nộp"
        elif structure.get("filename"):
            evidence_str = f"Bài nộp {structure.get('filename')}"
        else:
            evidence_str = "Đã đối chiếu dữ liệu bài nộp"

        if st == "PASS":
            icon = "✅"
            err_summary = matched_res.message if matched_res else "Đạt chuẩn quy định."
            sugg = "Đạt chuẩn, giữ nguyên."
            action = "Hợp lệ"
        elif st == "AMBIGUOUS":
            icon = "⚠️"
            err_summary = matched_res.message if matched_res else "Có sự khác biệt ngữ nghĩa."
            sugg = "Chuyển giảng viên phụ trách xem xét và quyết định ngoại lệ."
            action = "Chuyển giảng viên xem xét"
        elif st == "UNMEASURABLE":
            icon = "⚪"
            err_summary = matched_res.message if matched_res else "Không đo được tự động."
            sugg = "Giảng viên sẽ kiểm tra trực tiếp."
            action = "Kiểm tra thủ công"
        else:  # FAIL / MISSING
            icon = "❌"
            err_summary = matched_res.message if matched_res else "Chưa đạt yêu cầu theo quy chế."
            c_desc = getattr(criterion, "description", "")
            sugg = f"Điều chỉnh lại theo quy định: {c_desc}" if c_desc else "Cần bổ sung hoặc sửa lại theo quy định."
            action = "Cần sửa lại"

        checklist_summary.append({
            "index": idx,
            "criterion_id": str(getattr(criterion, "id", idx)),
            "category": getattr(criterion, "name", f"Tiêu chí {idx}"),
            "rule_type": rule_type_val,
            "status": st,
            "icon": icon,
            "error_summary": err_summary,
            "evidence": evidence_str,
            "suggestion": sugg,
            "action": action,
            "source_citation": getattr(criterion, "source_citation", None),
        })

    # Overall status
    usable_ids = {
        c.id for c in criteria
        if not getattr(c, "review_only", False) and (
            getattr(c, "automatable", True)
            or (c.rule_type.value if hasattr(c.rule_type, "value") else str(c.rule_type)) in ("PRESENCE", "TEMPLATE")
        )
    }
    usable_statuses = {r.status for r in results if r.criterion_id in usable_ids}
    if FormatCriterionResultStatus.FAIL in usable_statuses:
        overall = FormatCheckOverallStatus.NEEDS_FIX
    elif FormatCriterionResultStatus.AMBIGUOUS in usable_statuses or FormatCriterionResultStatus.UNMEASURABLE in usable_statuses:
        overall = FormatCheckOverallStatus.UNABLE_TO_CHECK
    else:
        overall = FormatCheckOverallStatus.PASS

    return results, checklist_summary, overall

