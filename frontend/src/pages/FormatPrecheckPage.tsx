import { FormEvent, useEffect, useMemo, useState } from "react";

import { api, postJson } from "../api/client";
import type {
  ChecklistSummaryItem,
  DemoCatalog,
  DocumentSummary,
  FormatCheckResponse,
  FormatCriteriaSet,
  FormatCriterionResult,
  FormatMetric,
  FormatReviewCase,
  FormatRuleHandling,
  FormatRuleType,
} from "../types";
import {
  RuleTypeBadge,
  getCriterionSummary,
  StructuredContentEditor,
  FormattedExpectedValue,
  FormattedActualValue,
} from "../components/StructuredContentEditor";

type Role = "student" | "lecturer";

interface Props {
  role: Role;
  catalog: DemoCatalog | null;
  selectedCourseId: string;
  onSelectCourse: (courseId: string) => void;
}

export function ResultBadge({ status }: { status: string }) {
  const color =
    status === "PASS" || status === "ACCEPTED"
      ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/30"
      : status === "FAIL" || status === "NEEDS_FIX" || status === "REQUIRES_FIX" || status === "MISSING_STUDENT_INPUT"
        ? "bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-400/30"
        : status === "NOT_SPECIFIED" || status === "UNMEASURABLE"
          ? "bg-slate-100 text-slate-600 border-slate-300"
          : "bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-400/30";

  const config: Record<string, { label: string; icon: string }> = {
    PASS: { label: "ĐÚNG (Đạt chuẩn)", icon: "✅" },
    ACCEPTED: { label: "ĐÃ CHẤP THUẬN", icon: "✅" },
    FAIL: { label: "SAI (Cần sửa lại)", icon: "❌" },
    NEEDS_FIX: { label: "CẦN SỬA LẠI", icon: "❌" },
    NEEDS_REVIEW: { label: "CHỜ GIẢNG VIÊN XÁC NHẬN", icon: "⏳" },
    REQUIRES_FIX: { label: "YÊU CẦU SỬA", icon: "❌" },
    MISSING_STUDENT_INPUT: { label: "THIẾU (Cần bổ sung)", icon: "❌" },
    AMBIGUOUS: { label: "MƠ HỒ (Chờ GV duyệt)", icon: "⚠️" },
    MANUAL_REVIEW: { label: "CẦN GIẢNG VIÊN XEM", icon: "⏳" },
    UNDER_REVIEW: { label: "CHỜ GIẢNG VIÊN DUYỆT", icon: "⏳" },
    UNABLE_TO_CHECK: { label: "CẦN THẨM ĐỊNH", icon: "⚠️" },
    UNMEASURABLE: { label: "KHÔNG ĐO ĐƯỢC", icon: "⚪" },
    NOT_SPECIFIED: { label: "KHÔNG QUY ĐỊNH", icon: "⚪" },
  };

  const item = config[status] || { label: status, icon: "•" };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold shadow-2xs ${color}`}>
      <span>{item.icon}</span>
      <span>{item.label}</span>
    </span>
  );
}

function CriteriaSelect({ catalog, courseId, onChange }: { catalog: DemoCatalog | null; courseId: string; onChange: (value: string) => void }) {
  return (
    <select value={courseId} onChange={(event) => onChange(event.target.value)} className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800">
      {catalog?.courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
    </select>
  );
}

export const CHECKLIST_CORE_CATEGORIES = [
  { index: 1, code: "MEASUREMENT", name: "Đo lường vật lý (Margins, Font, Spacing, Pages)" },
  { index: 2, code: "PRESENCE", name: "Thành phần bắt buộc (Bìa, Phân công, Mục lục, Trích dẫn)" },
  { index: 3, code: "TEMPLATE", name: "Khung cấu trúc đề cương (Chương & Mục con)" },
];


// ── MODAL XEM LẠI BÀI VỪA NỘP & ĐỐI CHIẾU ĐÚNG / SAI / MƠ HỒ ──────────────────
export function SubmittedReportFactsModal({
  facts,
  filename,
  results,
  checklistSummary,
  ambiguousResults,
  onClose,
}: {
  facts: Record<string, unknown>;
  filename: string;
  results?: FormatCriterionResult[];
  checklistSummary?: ChecklistSummaryItem[];
  ambiguousResults?: Array<Record<string, unknown>>;
  onClose: () => void;
}) {
  const effectiveResults: FormatCriterionResult[] =
    results || ((facts.results as FormatCriterionResult[]) || []);
  const effectiveSummary: ChecklistSummaryItem[] =
    checklistSummary || ((facts.checklist_summary as ChecklistSummaryItem[]) || []);
  const effectiveAmbiguous: Array<Record<string, unknown>> =
    ambiguousResults || ((facts.ambiguous_results as Array<Record<string, unknown>>) || []);

  const [filter, setFilter] = useState<"ALL" | "PASS" | "FAIL" | "AMBIGUOUS">("ALL");

  const margins = (facts.margins_cm as Array<Record<string, number>>) || [];
  const fonts = (facts.font_names as string[]) || [];
  const fontSizes = (facts.font_sizes_pt as number[]) || [];
  const lineSpacings = (facts.line_spacings as number[]) || [];

  const filteredResults = useMemo(() => {
    if (filter === "ALL") return effectiveResults;
    if (filter === "PASS") return effectiveResults.filter((r) => r.status === "PASS");
    if (filter === "FAIL") return effectiveResults.filter((r) => r.status === "FAIL");
    return effectiveResults.filter((r) => r.status === "AMBIGUOUS" || r.status === "MANUAL_REVIEW");
  }, [effectiveResults, filter]);

  const filteredSummary = useMemo(() => {
    if (filter === "ALL") return effectiveSummary;
    if (filter === "PASS") return effectiveSummary.filter((r) => r.status === "PASS");
    if (filter === "FAIL") return effectiveSummary.filter((r) => r.status === "FAIL" || r.status === "MISSING_STUDENT_INPUT");
    return effectiveSummary.filter((r) => r.status === "AMBIGUOUS" || r.status === "MANUAL_REVIEW");
  }, [effectiveSummary, filter]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/90">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-red-100 text-red-800 flex items-center justify-center text-lg font-bold">
              📄
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span>Dữ liệu bài nộp:</span>
                <span className="text-red-700 font-mono">{filename || (facts.filename as string) || "Báo cáo"}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Đối chiếu chi tiết từng tiêu chí: 🟢 <b>Đúng</b> · 🔴 <b>Sai</b> · 🟡 <b>Mơ hồ (Chờ GV duyệt)</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center font-bold text-sm cursor-pointer transition-all"
          >
            ✕
          </button>
        </div>

        {/* Quick Physical Measurements Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-500 font-semibold">Thông số tệp:</span>
          {facts.page_count !== undefined && (
            <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-mono">
              📄 {String(facts.page_count)} trang
            </span>
          )}
          {margins.length > 0 && (
            <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-mono">
              📏 Lề: T{margins[0].top} · D{margins[0].bottom} · Tr{margins[0].left} · P{margins[0].right} cm
            </span>
          )}
          {fonts.length > 0 && (
            <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              🔤 {fonts.slice(0, 2).join(", ")} {fontSizes.length > 0 ? `(${fontSizes.slice(0, 2).join(", ")}pt)` : ""}
            </span>
          )}
          {lineSpacings.length > 0 && (
            <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              ↕ Giãn dòng {lineSpacings[0]}
            </span>
          )}
        </div>

        {/* Filter Bar */}
        <div className="px-6 pt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="text-slate-500 mr-1">Bộ lọc:</span>
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1 rounded-lg border cursor-pointer transition-all ${filter === "ALL" ? "bg-slate-800 text-white border-slate-800" : "bg-white border-slate-200 text-slate-700"}`}
          >
            Tất cả ({effectiveSummary.length || effectiveResults.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("PASS")}
            className={`px-3 py-1 rounded-lg border cursor-pointer transition-all ${filter === "PASS" ? "bg-emerald-600 text-white border-emerald-600" : "bg-emerald-50 text-emerald-800 border-emerald-200"}`}
          >
            ✅ Đúng
          </button>
          <button
            type="button"
            onClick={() => setFilter("FAIL")}
            className={`px-3 py-1 rounded-lg border cursor-pointer transition-all ${filter === "FAIL" ? "bg-rose-600 text-white border-rose-600" : "bg-rose-50 text-rose-800 border-rose-200"}`}
          >
            ❌ Sai / Thiếu
          </button>
          <button
            type="button"
            onClick={() => setFilter("AMBIGUOUS")}
            className={`px-3 py-1 rounded-lg border cursor-pointer transition-all ${filter === "AMBIGUOUS" ? "bg-amber-500 text-white border-amber-500" : "bg-amber-50 text-amber-900 border-amber-200"}`}
          >
            ⚠️ Mơ hồ
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Ambiguous highlight if any */}
          {effectiveAmbiguous.length > 0 && (filter === "ALL" || filter === "AMBIGUOUS") && (
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-300 space-y-3">
              <h4 className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                <span>⚠️</span>
                <span>Các điểm khác biệt ngữ nghĩa đang chờ Giảng viên thẩm định ({effectiveAmbiguous.length}):</span>
              </h4>
              <div className="space-y-2">
                {effectiveAmbiguous.map((amb, idx) => (
                  <div key={idx} className="p-3 bg-white border border-amber-200 rounded-xl space-y-1.5">
                    <p className="font-bold text-slate-900">{idx + 1}. {String(amb.name || "Tiêu chuẩn")}</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="font-semibold text-slate-700 block text-[11px]">🎯 Yêu cầu quy định:</span>
                        <FormattedExpectedValue expectedValue={amb.expected_value as Record<string, unknown>} />
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="font-semibold text-slate-700 block text-[11px]">📄 Bóc tách bài nộp:</span>
                        <FormattedActualValue actualValue={amb.actual_value as Record<string, unknown>} />
                      </div>
                    </div>
                    <p className="text-[11px] text-amber-900 bg-amber-100/50 p-2 rounded-lg">
                      <b>💡 Nhận xét:</b> {String(amb.message || "Cách trình bày tương đương nhưng khác từ ngữ so với quy chuẩn mẫu.")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Table Comparison */}
          {effectiveSummary.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3 w-56">Tiêu chuẩn kiểm tra</th>
                    <th className="p-3 w-36 text-center">Kết quả</th>
                    <th className="p-3">Chi tiết bóc tách &amp; đối chiếu</th>
                    <th className="p-3 w-56">Hướng dẫn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSummary.map((row) => {
                    const isPass = row.status === "PASS";
                    const isFail = row.status === "FAIL" || row.status === "MISSING_STUDENT_INPUT";
                    const isAmbiguous = row.status === "AMBIGUOUS" || row.status === "MANUAL_REVIEW";

                    return (
                      <tr
                        key={row.index}
                        className={`transition-colors ${isPass
                          ? "bg-emerald-50/20 hover:bg-emerald-50/40"
                          : isFail
                            ? "bg-rose-50/30 hover:bg-rose-50/50"
                            : isAmbiguous
                              ? "bg-amber-50/30 hover:bg-amber-50/50"
                              : "bg-slate-50/40 hover:bg-slate-50 opacity-70"
                          }`}
                      >
                        <td className="p-3 text-center font-bold text-slate-600">{row.index}</td>
                        <td className="p-3">
                          <p className="font-bold text-slate-900">{row.category}</p>
                        </td>
                        <td className="p-3 text-center">
                          <ResultBadge status={row.status} />
                        </td>
                        <td className="p-3 text-slate-800">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900">{row.error_summary}</p>
                            {row.evidence && row.status !== "NOT_SPECIFIED" && (
                              <p className="text-[11px] text-slate-600 font-mono bg-white p-1.5 rounded-lg border border-slate-200 inline-block">
                                <b>Bóc tách được:</b> {row.evidence}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          {isPass ? (
                            <span className="text-emerald-800 font-semibold flex items-center gap-1">
                              <span>✓</span> Đạt chuẩn
                            </span>
                          ) : isFail ? (
                            <div className="bg-rose-50 p-2 rounded-lg border border-rose-200 text-rose-900 text-[11px]">
                              <b>⚠️ Cần sửa lại:</b> {row.suggestion}
                            </div>
                          ) : isAmbiguous ? (
                            <div className="bg-amber-50 p-2 rounded-lg border border-amber-200 text-amber-900 text-[11px]">
                              <b>⏳ Chờ giảng viên:</b> {row.suggestion}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Không bắt buộc</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            filteredResults.length > 0 && (
              <div className="space-y-3">
                {filteredResults.map((r, i) => (
                  <CriterionResult key={i} item={r} />
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold cursor-pointer transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ── COMPONENT HIỂN THỊ CHI TIẾT TỪNG TIÊU CHÍ CON ────────────────────────────
export function CriterionResult({ item }: { item: FormatCriterionResult }) {
  const isPass = item.status === "PASS";
  const isFail = item.status === "FAIL";
  const isAmbiguous = item.status === "AMBIGUOUS" || item.status === "MANUAL_REVIEW";
  const handlingLabel = item.handling === "ADVISORY"
    ? "Khuyến nghị"
    : item.handling === "MANUAL_REVIEW"
      ? "Giảng viên xác nhận"
      : "Bắt buộc";

  return (
    <article
      className={`border rounded-2xl p-5 space-y-3.5 transition-all shadow-xs ${isPass
        ? "bg-white border-emerald-200/80 hover:border-emerald-300"
        : isFail
          ? "bg-rose-50/20 border-rose-200 hover:border-rose-300"
          : isAmbiguous
            ? "bg-amber-50/20 border-amber-200 hover:border-amber-300"
            : "bg-white border-slate-200"
        }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 border-slate-100">
        <div className="flex items-center gap-2">
          <span
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${isPass
              ? "bg-emerald-100 text-emerald-800"
              : isFail
                ? "bg-rose-100 text-rose-800"
                : isAmbiguous
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-700"
              }`}
          >
            {isPass ? "✓" : isFail ? "✕" : isAmbiguous ? "!" : "•"}
          </span>
          <h3 className="font-bold text-sm text-slate-900">{item.name}</h3>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.handling === "BLOCKING"
            ? "bg-rose-50 text-rose-800 border-rose-200"
            : item.handling === "ADVISORY"
              ? "bg-sky-50 text-sky-800 border-sky-200"
              : "bg-amber-50 text-amber-900 border-amber-200"
            }`}>{handlingLabel}</span>
        </div>
        <ResultBadge status={item.status} />
      </div>

      {/* 2-Column Comparison Breakdown */}
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        {/* Yêu cầu quy chuẩn */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
          <p className="font-bold text-slate-800 flex items-center gap-1.5">
            <span>🎯</span>
            <span>1. Yêu cầu theo quy chế / đề cương:</span>
          </p>
          <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
            <FormattedExpectedValue
              expectedValue={item.expected_value}
              description={item.name}
            />
          </div>
        </div>

        {/* Thực tế bài nộp */}
        <div
          className={`p-3 border rounded-xl space-y-1.5 ${isPass
            ? "bg-emerald-50/50 border-emerald-200 text-emerald-950"
            : isFail
              ? "bg-rose-50/50 border-rose-200 text-rose-950"
              : isAmbiguous
                ? "bg-amber-50/50 border-amber-200 text-amber-950"
                : "bg-slate-50 border-slate-200 text-slate-950"
            }`}
        >
          <p className="font-bold flex items-center gap-1.5">
            <span>📄</span>
            <span>2. Thực tế bóc tách / đối chiếu bài nộp:</span>
          </p>
          <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
            <FormattedActualValue
              actualValue={item.actual_value}
              ruleType={item.expected_value?.property ? "MEASUREMENT" : undefined}
            />
          </div>
        </div>
      </div>

      {/* Kết luận & Gợi ý xử lý */}
      <div
        className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${isPass
          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
          : isFail
            ? "bg-rose-50 border-rose-200 text-rose-900"
            : isAmbiguous
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : "bg-slate-50 border-slate-200 text-slate-800"
          }`}
      >
        <span className="text-base flex-shrink-0 mt-0.5">
          {isPass ? "🟢" : isFail ? "🔴" : isAmbiguous ? "🟡" : "⚪"}
        </span>
        <div className="flex-1 space-y-0.5">
          <p className="font-bold">
            {isPass
              ? "ĐÚNG (Đạt chuẩn): "
              : isFail
                ? "SAI (Chưa đạt): "
                : isAmbiguous
                  ? "MƠ HỒ (Cần xác nhận): "
                  : "KẾT QUẢ: "}
            <span className="font-normal">{item.message}</span>
          </p>
          {isFail && (
            <p className="text-[11px] text-rose-700 font-medium">
              💡 Gợi ý: Hãy mở tệp báo cáo và điều chỉnh lại đúng với thông số quy chuẩn ở ô bên trái trước khi nộp chính thức.
            </p>
          )}
          {isAmbiguous && (
            <p className="text-[11px] text-amber-800 font-medium">
              💡 Lưu ý: Hệ thống đã lưu lại snapshot này và gửi cho giảng viên phụ trách xem xét chấp thuận ngoại lệ.
            </p>
          )}
        </div>
      </div>

      {item.source_citation && (
        <details className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
          <summary className="cursor-pointer font-semibold text-slate-700">
            Xem điều khoản quy chế nguồn trích dẫn
          </summary>
          <p className="mt-1.5 italic text-amber-950 bg-amber-50/70 p-2 rounded border border-amber-200">
            ❝ {item.source_citation}
          </p>
        </details>
      )}
    </article>
  );
}

// ── COMPONENT KẾT QUẢ KIỂM TRA CHO SINH VIÊN ─────────────────────────────────
export function CheckResult({
  result,
  onOpenFactsModal,
  onResubmit,
}: {
  result: FormatCheckResponse;
  onOpenFactsModal?: () => void;
  onResubmit?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"summary" | "criteria">("summary");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PASS" | "FAIL" | "AMBIGUOUS" | "NOT_SPECIFIED">("ALL");

  const summaryItems = result.checklist_summary || [];

  // Tính số lượng theo từng nhóm trạng thái
  const counts = useMemo(() => {
    let pass = 0;
    let fail = 0;
    let ambiguous = 0;
    let notSpecified = 0;

    summaryItems.forEach((row) => {
      if (row.status === "PASS") pass++;
      else if (row.status === "FAIL" || row.status === "MISSING_STUDENT_INPUT") fail++;
      else if (row.status === "AMBIGUOUS" || row.status === "MANUAL_REVIEW") ambiguous++;
      else notSpecified++;
    });

    return { total: summaryItems.length, pass, fail, ambiguous, notSpecified };
  }, [summaryItems]);

  // Lọc danh sách theo filter đã chọn
  const filteredSummary = useMemo(() => {
    if (filterStatus === "ALL") return summaryItems;
    if (filterStatus === "PASS") return summaryItems.filter((r) => r.status === "PASS");
    if (filterStatus === "FAIL") return summaryItems.filter((r) => r.status === "FAIL" || r.status === "MISSING_STUDENT_INPUT");
    if (filterStatus === "AMBIGUOUS") return summaryItems.filter((r) => r.status === "AMBIGUOUS" || r.status === "MANUAL_REVIEW");
    return summaryItems.filter((r) => r.status === "NOT_SPECIFIED");
  }, [summaryItems, filterStatus]);

  const filteredCriteria = useMemo(() => {
    if (filterStatus === "ALL") return result.results;
    if (filterStatus === "PASS") return result.results.filter((r) => r.status === "PASS");
    if (filterStatus === "FAIL") return result.results.filter((r) => r.status === "FAIL");
    if (filterStatus === "AMBIGUOUS") return result.results.filter((r) => r.status === "AMBIGUOUS" || r.status === "MANUAL_REVIEW");
    return result.results.filter((r) => r.status === "UNMEASURABLE");
  }, [result.results, filterStatus]);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* 1. Header Overview */}
      <div className="flex flex-wrap justify-between items-start gap-4 pb-2 border-b border-slate-100">
        <div className="flex gap-3 items-start">
          <ResultBadge status={result.overall_status} />
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Kết quả kiểm tra hình thức báo cáo</h2>
            <p className="text-sm text-slate-600 mt-1">{result.message}</p>
            {result.criteria_version && (
              <p className="text-xs text-slate-500 mt-1">
                Policy {result.policy_id || "nội bộ"} · phiên bản {result.policy_version || `v${result.criteria_version}`}
                {result.report_type ? ` · loại báo cáo ${result.report_type}` : ""}
                {result.criteria_approved_at ? ` · duyệt ngày ${new Date(result.criteria_approved_at).toLocaleDateString("vi-VN")}` : ""}
              </p>
            )}
          </div>
        </div>

        {result.report_facts && onOpenFactsModal && (
          <button
            type="button"
            onClick={onOpenFactsModal}
            className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <span>📄 Xem lại bài vừa nộp &amp; Đối chiếu</span>
          </button>
        )}
      </div>

      {result.review_case_id && (
        <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
          <span className="text-amber-600 text-sm">⚠️</span>
          <div>
            <b>Có tiêu chí cần giảng viên thẩm định:</b> Một số điểm trình bày có sự khác biệt ngữ nghĩa hoặc tên gọi đã được tự động lưu snapshot và chuyển đến hàng chờ duyệt của giảng viên phụ trách môn học.
          </div>
        </div>
      )}

      {result.overall_status === "NEEDS_FIX" && onResubmit && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/80 p-4">
          <div>
            <p className="text-sm font-bold text-rose-950">Bạn cần sửa các mục bắt buộc trước khi nộp chính thức.</p>
            <p className="mt-0.5 text-xs text-rose-800">Xem các dòng “Sai / Thiếu” bên dưới, chỉnh file rồi kiểm tra lại. Lượt kiểm tra mới vẫn giữ nguyên lịch sử policy đã dùng ở lượt này.</p>
          </div>
          <button
            type="button"
            onClick={onResubmit}
            className="shrink-0 rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-800"
          >
            Chọn file đã sửa để kiểm tra lại
          </button>
        </div>
      )}

      {/* 2. STAT FILTER CARDS (CHỈ RÕ ĐÚNG, SAI, MƠ HỒ ĐỂ DỄ QUAN SÁT) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <button
          type="button"
          onClick={() => setFilterStatus("ALL")}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${filterStatus === "ALL"
            ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/30 shadow-xs"
            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
        >
          <p className="text-[11px] font-semibold opacity-80">Tất cả mục</p>
          <p className="text-xl font-extrabold mt-0.5">{counts.total}</p>
          <span className="text-[10px] opacity-75">{counts.total} Tiêu chuẩn</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus("PASS")}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${filterStatus === "PASS"
            ? "bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/30 shadow-xs"
            : "bg-emerald-50/60 border-emerald-200 text-emerald-900 hover:bg-emerald-100/60"
            }`}
        >
          <p className="text-[11px] font-bold flex items-center gap-1">
            <span>✅</span>
            <span>ĐÚNG</span>
          </p>
          <p className="text-xl font-extrabold mt-0.5">{counts.pass}</p>
          <span className="text-[10px] font-semibold">Đạt chuẩn 100%</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus("FAIL")}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${filterStatus === "FAIL"
            ? "bg-rose-600 text-white border-rose-600 ring-2 ring-rose-500/30 shadow-xs"
            : "bg-rose-50/60 border-rose-200 text-rose-900 hover:bg-rose-100/60"
            }`}
        >
          <p className="text-[11px] font-bold flex items-center gap-1">
            <span>❌</span>
            <span>SAI / THIẾU</span>
          </p>
          <p className="text-xl font-extrabold mt-0.5">{counts.fail}</p>
          <span className="text-[10px] font-semibold">Bắt buộc sửa</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus("AMBIGUOUS")}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${filterStatus === "AMBIGUOUS"
            ? "bg-amber-500 text-white border-amber-500 ring-2 ring-amber-400/30 shadow-xs"
            : "bg-amber-50/60 border-amber-200 text-amber-900 hover:bg-amber-100/60"
            }`}
        >
          <p className="text-[11px] font-bold flex items-center gap-1">
            <span>⚠️</span>
            <span>MƠ HỒ</span>
          </p>
          <p className="text-xl font-extrabold mt-0.5">{counts.ambiguous}</p>
          <span className="text-[10px] font-semibold">Chờ GV duyệt</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus("NOT_SPECIFIED")}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${filterStatus === "NOT_SPECIFIED"
            ? "bg-slate-600 text-white border-slate-600 ring-2 ring-slate-500/30 shadow-xs"
            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
        >
          <p className="text-[11px] font-semibold flex items-center gap-1">
            <span>⚪</span>
            <span>KHÔNG QUY ĐỊNH</span>
          </p>
          <p className="text-xl font-extrabold mt-0.5">{counts.notSpecified}</p>
          <span className="text-[10px] opacity-75">Bỏ qua</span>
        </button>
      </div>

      {/* 3. Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold pt-1">
        <button
          type="button"
          onClick={() => setActiveTab("summary")}
          className={`pb-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === "summary"
            ? "border-red-700 text-red-700 font-bold"
            : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
        >
          <span>📋 Bảng tổng hợp tiêu chuẩn</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
            {filteredSummary.length} mục
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("criteria")}
          className={`pb-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === "criteria"
            ? "border-red-700 text-red-700 font-bold"
            : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
        >
          <span>🔍 Chi tiết tiêu chí áp dụng ({filteredCriteria.length})</span>
        </button>
      </div>

      {/* 4. Tab 1: Checklist Summary Table with Explicit Status Breakdown */}
      {activeTab === "summary" && (
        <div className="space-y-3">
          {filteredSummary.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs">
              Không có tiêu chuẩn nào thuộc bộ lọc này.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3 w-56">Tiêu chuẩn kiểm tra ({filteredSummary.length})</th>
                    <th className="p-3 w-44 text-center">Phân loại kết quả</th>
                    <th className="p-3">Chi tiết đối chiếu thực tế bài nộp</th>
                    <th className="p-3 w-60">Hướng dẫn khắc phục</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSummary.map((row) => {
                    const isPass = row.status === "PASS";
                    const isFail = row.status === "FAIL" || row.status === "MISSING_STUDENT_INPUT";
                    const isAmbiguous = row.status === "AMBIGUOUS" || row.status === "MANUAL_REVIEW";

                    return (
                      <tr
                        key={row.index}
                        className={`transition-colors ${isPass
                          ? "bg-emerald-50/20 hover:bg-emerald-50/40"
                          : isFail
                            ? "bg-rose-50/30 hover:bg-rose-50/50"
                            : isAmbiguous
                              ? "bg-amber-50/30 hover:bg-amber-50/50"
                              : "bg-slate-50/40 hover:bg-slate-50 opacity-70"
                          }`}
                      >
                        <td className="p-3 text-center font-bold text-slate-600">{row.index}</td>
                        <td className="p-3">
                          <p className="font-bold text-slate-900">{row.category}</p>
                        </td>
                        <td className="p-3 text-center">
                          <ResultBadge status={row.status} />
                        </td>
                        <td className="p-3 text-slate-800">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900">{row.error_summary}</p>
                            {row.evidence && row.status !== "NOT_SPECIFIED" && (
                              <p className="text-[11px] text-slate-600 font-mono bg-white/90 p-1.5 rounded-lg border border-slate-200/90 inline-block">
                                <b>Bóc tách được:</b> {row.evidence.length > 140 ? `${row.evidence.slice(0, 140)}…` : row.evidence}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          {isPass ? (
                            <span className="text-emerald-800 font-semibold flex items-center gap-1">
                              <span>✓</span> Đạt chuẩn, giữ nguyên
                            </span>
                          ) : isFail ? (
                            <div className="bg-rose-50 p-2 rounded-lg border border-rose-200 text-rose-900">
                              <p className="font-bold text-[11px] flex items-center gap-1">
                                <span>⚠️</span> Cần sửa lại:
                              </p>
                              <p className="text-[11px] mt-0.5">{row.suggestion}</p>
                            </div>
                          ) : isAmbiguous ? (
                            <div className="bg-amber-50 p-2 rounded-lg border border-amber-200 text-amber-900">
                              <p className="font-bold text-[11px] flex items-center gap-1">
                                <span>⏳</span> Chờ giảng viên:
                              </p>
                              <p className="text-[11px] mt-0.5">{row.suggestion}</p>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Không yêu cầu bắt buộc</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. Tab 2: Detailed Criteria Breakdown */}
      {activeTab === "criteria" && (
        <div className="space-y-3.5">
          {filteredCriteria.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs">
              Không có tiêu chí con nào thuộc bộ lọc này.
            </div>
          ) : (
            filteredCriteria.map((item) => (
              <CriterionResult key={item.criterion_id} item={item} />
            ))
          )}
        </div>
      )}
    </section>
  );
}

// ── GIAO DIỆN SINH VIÊN ──────────────────────────────────────────────────────
function StudentFormatCheck({ catalog, selectedCourseId, onSelectCourse }: Omit<Props, "role">) {
  const [file, setFile] = useState<File | null>(null);
  const [activeProfiles, setActiveProfiles] = useState<FormatCriteriaSet[]>([]);
  const [reportType, setReportType] = useState("default");
  const [result, setResult] = useState<FormatCheckResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState<FormatReviewCase[]>([]);
  const [activeFactsModal, setActiveFactsModal] = useState<{
    facts: Record<string, unknown>;
    filename: string;
    results?: FormatCriterionResult[];
    checklistSummary?: ChecklistSummaryItem[];
    ambiguousResults?: Array<Record<string, unknown>>;
  } | null>(null);

  const selectedProfile = useMemo(
    () => activeProfiles.find((profile) => profile.report_type === reportType) || activeProfiles[0] || null,
    [activeProfiles, reportType]
  );

  async function loadReviews() {
    try {
      setReviews(await api<FormatReviewCase[]>(`/api/v1/format-checks/reviews/student?course_id=${encodeURIComponent(selectedCourseId)}&actor_id=demo-student`));
    } catch { setReviews([]); }
  }

  async function loadActiveProfiles() {
    try {
      const sets = await api<FormatCriteriaSet[]>(`/api/v1/format-checks/criteria?course_id=${encodeURIComponent(selectedCourseId)}`);
      const profiles = sets.filter((item) => item.status === "ACTIVE");
      setActiveProfiles(profiles);
      setReportType((current) => profiles.some((item) => item.report_type === current) ? current : (profiles[0]?.report_type || "default"));
    } catch {
      setActiveProfiles([]);
      setReportType("default");
    }
  }

  useEffect(() => {
    // Khôi phục kết quả kiểm tra gần nhất khi chuyển tab
    try {
      const cached = sessionStorage.getItem(`aer_last_check_${selectedCourseId}`);
      if (cached) {
        setResult(JSON.parse(cached));
      } else {
        setResult(null);
      }
    } catch {
      setResult(null);
    }
    void loadReviews();
    void loadActiveProfiles();
  }, [selectedCourseId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) { setError("Hãy chọn file .docx hoặc .pdf trước khi kiểm tra."); return; }
    setBusy(true); setError(""); setResult(null);
    try {
      const body = new FormData();
      body.append("course_id", selectedCourseId);
      body.append("actor_id", "demo-student");
      body.append("report_type", reportType);
      body.append("file", file);
      const res = await api<FormatCheckResponse>("/api/v1/format-checks/checks", { method: "POST", body });
      setResult(res);
      try {
        sessionStorage.setItem(`aer_last_check_${selectedCourseId}`, JSON.stringify(res));
      } catch {
        // ignore storage error
      }
      await loadReviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể kiểm tra file.");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <p className="text-xs font-bold tracking-wider text-red-700 uppercase">Trước khi nộp chính thức</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Kiểm tra hình thức báo cáo</h1>
          <p className="text-sm text-slate-500 mt-2">
            Hệ thống đối chiếu hình thức theo bộ tiêu chuẩn môn học; chỉ rõ từng mục 🟢 <b>Đúng</b>, 🔴 <b>Sai</b>, 🟡 <b>Mơ hồ</b> để bạn hoàn thiện báo cáo chuẩn xác nhất.
          </p>
        </header>

        <form id="format-upload" onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex flex-wrap gap-4 items-end">
            <label className="block text-sm font-semibold text-slate-700">
              Học phần
              <CriteriaSelect catalog={catalog} courseId={selectedCourseId} onChange={onSelectCourse} />
            </label>
            {activeProfiles.length > 1 ? (
              <label className="block text-sm font-semibold text-slate-700">
                Loại báo cáo
                <select
                  value={reportType}
                  onChange={(event) => setReportType(event.target.value)}
                  className="block mt-1.5 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800"
                >
                  {activeProfiles.map((profile) => (
                    <option key={profile.id} value={profile.report_type}>{profile.title} · {profile.report_type}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex-1 min-w-64 block text-sm font-semibold text-slate-700">
              Báo cáo (.docx, .pdf)
              <input
                type="file"
                accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="block mt-1.5 w-full text-sm text-slate-600"
              />
            </label>
          </div>
          {selectedProfile ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-950">
              <p className="font-bold">Policy sẽ được áp dụng cho lượt kiểm tra này</p>
              <p className="mt-1">
                {selectedProfile.title} · loại <b>{selectedProfile.report_type}</b> · {selectedProfile.policy_id} / {selectedProfile.policy_version} · {selectedProfile.criteria.length} tiêu chí
              </p>
              <p className="mt-1 text-emerald-800">Kết quả sẽ lưu snapshot policy này, nên các lần kiểm tra trước không đổi khi giảng viên cập nhật quy định.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              Chưa có policy đang kích hoạt cho học phần này. Hãy liên hệ giảng viên trước khi kiểm tra.
            </div>
          )}
          <div className="rounded-lg bg-sky-50 border border-sky-100 p-3 text-xs text-sky-800">
            File chỉ được dùng trong lượt kiểm tra này. Kết quả sẽ lưu snapshot policy/version áp dụng để các lần kiểm tra cũ không bị thay đổi khi giảng viên cập nhật policy.
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              disabled={busy || !file}
              className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-sm font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-red-900/20"
            >
              {busy ? "Đang kiểm tra…" : "Kiểm tra theo quy chế"}
            </button>
            {result?.report_facts && (
              <button
                type="button"
                onClick={() =>
                  setActiveFactsModal({
                    facts: result.report_facts!,
                    filename: file?.name || (result.report_facts?.filename as string) || "Báo cáo vừa nộp",
                    results: result.results,
                    checklistSummary: result.checklist_summary,
                  })
                }
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-300 shadow-2xs"
              >
                <span>📄 Xem lại bài vừa nộp &amp; Đối chiếu</span>
              </button>
            )}
          </div>
        </form>

        {error && <p className="p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">{error}</p>}
        {result && (
          <CheckResult
            result={result}
            onOpenFactsModal={() =>
              setActiveFactsModal({
                facts: result.report_facts!,
                filename: file?.name || (result.report_facts?.filename as string) || "Báo cáo vừa nộp",
                results: result.results,
                checklistSummary: result.checklist_summary,
              })
            }
            onResubmit={() => {
              setResult(null);
              setFile(null);
              document.getElementById("format-upload")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
        )}

        {/* LỊCH SỬ NỘP LẠI & PHẢN HỒI CỦA GIẢNG VIÊN */}
        {reviews.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900 text-base">Phản hồi của giảng viên &amp; Lịch sử gửi thẩm định</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Danh sách các bài nộp cần giảng viên xem xét. Bạn có thể bấm nút để xem lại chi tiết Đúng / Sai / Mơ hồ bất cứ lúc nào.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                {reviews.length} bài
              </span>
            </div>

            <div className="space-y-3.5">
              {reviews.map((review) => {
                const isAccepted = review.status === "ACCEPTED";
                const isFix = review.status === "REQUIRES_FIX";
                const isUnderReview = review.status === "UNDER_REVIEW";
                const ambCount = review.ambiguous_results?.length || 0;

                return (
                  <article
                    key={review.id}
                    className={`border rounded-xl p-4 space-y-3.5 transition-all shadow-2xs ${isAccepted
                      ? "bg-emerald-50/20 border-emerald-200"
                      : isFix
                        ? "bg-rose-50/20 border-rose-200"
                        : "bg-amber-50/20 border-amber-200"
                      }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <span>📄</span>
                          <span>{review.filename}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Thời gian nộp: {new Date(review.created_at).toLocaleString("vi-VN")} · Hồ sơ: <span className="font-mono">#{review.id.slice(-8)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {ambCount > 0 && (
                          <span className="text-[11px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-lg border border-amber-200">
                            ⚠️ {ambCount} điểm mơ hồ
                          </span>
                        )}
                        <ResultBadge status={review.status} />
                      </div>
                    </div>

                    {/* Phản hồi nhận xét của Giảng viên */}
                    {review.decision_reason && (
                      <div
                        className={`p-3 rounded-xl border text-xs ${isAccepted
                          ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                          : "bg-rose-50 border-rose-200 text-rose-950"
                          }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold mb-0.5">
                          <span>{isAccepted ? "✅" : "❌"}</span>
                          <span>{isAccepted ? "Giảng viên đã chấp thuận hợp lệ:" : "Giảng viên yêu cầu sửa đổi:"}</span>
                        </div>
                        <p className="text-[11px] ml-5 font-medium">{review.decision_reason}</p>
                      </div>
                    )}

                    {isUnderReview && (
                      <p className="text-xs text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center gap-2">
                        <span>⏳</span>
                        <span><b>Đang chờ thẩm định:</b> Giảng viên phụ trách đang xem xét cách trình bày tương đương của bài này.</span>
                      </p>
                    )}

                    {/* Danh sách các điểm Mơ hồ gửi duyệt (preview nhanh) */}
                    {review.ambiguous_results && review.ambiguous_results.length > 0 && (
                      <div className="p-3 bg-white border border-amber-200 rounded-xl space-y-2 text-xs">
                        <p className="font-bold text-amber-950 flex items-center gap-1.5 text-[11px]">
                          <span>⚠️</span>
                          <span>Các điểm mơ hồ trong lượt nộp này ({review.ambiguous_results.length}):</span>
                        </p>
                        <div className="space-y-1.5">
                          {review.ambiguous_results.map((amb, i) => (
                            <div key={i} className="p-2 bg-amber-50/50 rounded-lg border border-amber-100 flex items-start gap-2 text-[11px]">
                              <span className="font-bold text-amber-800 mt-0.5">•</span>
                              <div className="flex-1">
                                <span className="font-bold text-slate-800">{String(amb.name || "Tiêu chuẩn")}: </span>
                                <span className="text-slate-600">{String(amb.message || "Khác biệt ngữ nghĩa")}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                      {review.extracted_snapshot ? (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveFactsModal({
                              facts: review.extracted_snapshot,
                              filename: review.filename,
                              ambiguousResults: review.ambiguous_results,
                              results: (review.extracted_snapshot.results as FormatCriterionResult[]) || undefined,
                              checklistSummary: (review.extracted_snapshot.checklist_summary as ChecklistSummaryItem[]) || undefined,
                            })
                          }
                          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                        >
                          <span>📄 Xem lại bài vừa nộp &amp; Đối chiếu Đúng / Sai / Mơ hồ</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Không có snapshot dữ liệu</span>
                      )}

                      <span className="text-[11px] text-slate-400 font-mono">
                        Mã hồ sơ: #{review.id.slice(-8)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Modal xem lại bài vừa nộp (từ lượt kiểm tra hiện tại hoặc từ lịch sử review) */}
        {activeFactsModal && (
          <SubmittedReportFactsModal
            facts={activeFactsModal.facts}
            filename={activeFactsModal.filename}
            results={activeFactsModal.results}
            checklistSummary={activeFactsModal.checklistSummary}
            ambiguousResults={activeFactsModal.ambiguousResults}
            onClose={() => setActiveFactsModal(null)}
          />
        )}
      </div>
    </div>
  );
}

// ── GIAO DIỆN GIẢNG VIÊN ─────────────────────────────────────────────────────
function LecturerFormatCheck({ catalog, selectedCourseId, onSelectCourse }: Omit<Props, "role">) {
  const [sets, setSets] = useState<FormatCriteriaSet[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [reviews, setReviews] = useState<FormatReviewCase[]>([]);
  const [metrics, setMetrics] = useState<FormatMetric[]>([]);
  const [title, setTitle] = useState("Bộ tiêu chí hình thức báo cáo");
  const [reportType, setReportType] = useState("default");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [allowSemanticEquivalent, setAllowSemanticEquivalent] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [ruleFilter, setRuleFilter] = useState<"ALL" | "MEASUREMENT" | "TEMPLATE" | "PRESENCE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeReportFactsModal, setActiveReportFactsModal] = useState<{
    facts: Record<string, unknown>;
    filename: string;
    results?: FormatCriterionResult[];
    checklistSummary?: ChecklistSummaryItem[];
    ambiguousResults?: Array<Record<string, unknown>>;
  } | null>(null);

  // Danh sách tiêu chí đang chỉnh sửa trực tiếp (hoàn toàn động)
  const [editableCriteria, setEditableCriteria] = useState<
    Array<{
      id?: string;
      name: string;
      description: string;
      rule_type: FormatRuleType;
      handling: FormatRuleHandling;
      when_unable_to_check: "UNABLE_TO_CHECK" | "NEEDS_REVIEW";
      expected_value: Record<string, unknown>;
      source_citation?: string;
    }>
  >([]);

  const active = useMemo(
    () => sets.find((item) => item.status === "ACTIVE" && item.report_type === reportType),
    [sets, reportType]
  );

  const reportTypes = useMemo(
    () => Array.from(new Set(sets.map((item) => item.report_type))).sort(),
    [sets]
  );

  const versionHistory = useMemo(
    () => sets
      .filter((item) => item.report_type === reportType)
      .sort((left, right) => right.version - left.version),
    [sets, reportType]
  );

  function loadCriteriaSetIntoEditor(criteriaSet: FormatCriteriaSet) {
    setReportType(criteriaSet.report_type);
    setTitle(criteriaSet.title || "Bộ tiêu chí hình thức báo cáo");
    setSelectedDocs(criteriaSet.source_document_ids);
    setEditableCriteria(
      criteriaSet.criteria.map((criterion) => ({
        id: criterion.id,
        name: criterion.name,
        description: criterion.description || "",
        rule_type: criterion.rule_type,
        handling: criterion.handling,
        when_unable_to_check: criterion.when_unable_to_check,
        expected_value: criterion.expected_value,
        source_citation: criterion.source_citation || undefined,
      }))
    );
    setExpandedIndex(null);
  }

  async function load() {
    try {
      const [criteriaData, docs, reviewData, metricData] = await Promise.all([
        api<FormatCriteriaSet[]>(`/api/v1/format-checks/criteria?course_id=${encodeURIComponent(selectedCourseId)}`),
        api<DocumentSummary[]>(`/api/v1/documents?course_id=${encodeURIComponent(selectedCourseId)}`),
        api<FormatReviewCase[]>(`/api/v1/format-checks/reviews?course_id=${encodeURIComponent(selectedCourseId)}&lecturer_id=lecturer-01`),
        api<FormatMetric[]>(`/api/v1/format-checks/metrics?course_id=${encodeURIComponent(selectedCourseId)}&lecturer_id=lecturer-01`),
      ]);
      setSets(criteriaData);
      setDocuments(docs);
      setReviews(reviewData);
      setMetrics(metricData);

      const currentActive = criteriaData.find((item) => item.status === "ACTIVE" && item.report_type === reportType)
        || criteriaData.find((item) => item.status === "ACTIVE");
      if (currentActive) loadCriteriaSetIntoEditor(currentActive);

      // Tự động chọn tài liệu nếu chưa chọn
      if (!currentActive && docs.length > 0 && selectedDocs.length === 0) {
        setSelectedDocs(docs.map((d) => d.id));
      }

    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể tải dữ liệu kiểm tra hình thức.");
    }
  }

  useEffect(() => {
    setEditableCriteria([]);
    setSelectedDocs([]);
    setExpandedIndex(null);
    void load();
  }, [selectedCourseId]);

  // 1. Trích xuất tiêu chí từ tài liệu (100% Dynamic)
  async function handleExtractFromDocs() {
    if (!selectedDocs.length) {
      setMessage("Vui lòng tick chọn ít nhất một tài liệu nguồn để trích xuất.");
      return;
    }
    setExtracting(true);
    setMessage("");
    try {
      const draft = await postJson<FormatCriteriaSet>("/api/v1/format-checks/criteria/drafts/from-documents", {
        course_id: selectedCourseId,
        lecturer_id: "lecturer-01",
        report_type: reportType,
        title: title || "Bộ tiêu chí trích xuất từ tài liệu",
        document_ids: selectedDocs,
        include_template_structure: true,
        allow_semantic_equivalent: allowSemanticEquivalent,
      });

      if (draft.criteria && draft.criteria.length > 0) {
        setEditableCriteria(
          draft.criteria.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description || "",
            rule_type: c.rule_type,
            handling: c.handling,
            when_unable_to_check: c.when_unable_to_check,
            expected_value: c.expected_value,
            source_citation: c.source_citation || undefined,
          }))
        );
        setMessage(`⚡ Đã trích xuất thành công ${draft.criteria.length} tiêu chí động từ tài liệu.`);
      } else {
        setMessage("Không tìm thấy quy định hình thức tự động nào trong tài liệu đã chọn.");
      }
      // Draft vừa trích xuất là bản đang được giảng viên chỉnh sửa; không nạp lại
      // active version vì sẽ làm mất các thay đổi chưa phê duyệt trên giao diện.
      const criteriaData = await api<FormatCriteriaSet[]>(`/api/v1/format-checks/criteria?course_id=${encodeURIComponent(selectedCourseId)}`);
      setSets(criteriaData);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Lỗi khi trích xuất tiêu chí.");
    } finally {
      setExtracting(false);
    }
  }

  // 2. Thêm tiêu chí mới theo loại
  function handleAddCriterion(type: FormatRuleType = "MEASUREMENT") {
    let newCrit: (typeof editableCriteria)[0];
    if (type === "MEASUREMENT") {
      newCrit = {
        name: "Quy chuẩn định dạng",
        description: "Căn lề, phông chữ hoặc số trang theo quy chế",
        rule_type: "MEASUREMENT",
        handling: "BLOCKING",
        when_unable_to_check: "UNABLE_TO_CHECK",
        expected_value: { property: "margins_cm", value: { top: 2.5, bottom: 2.5, left: 3.0, right: 2.0 } },
      };
    } else if (type === "TEMPLATE") {
      newCrit = {
        name: "Chương mới",
        description: "Chương trong khung đề cương",
        rule_type: "TEMPLATE",
        handling: "BLOCKING",
        when_unable_to_check: "UNABLE_TO_CHECK",
        expected_value: {
          kind: "template_chapter",
          chapter_number: editableCriteria.filter((c) => c.rule_type === "TEMPLATE").length + 1,
          allow_semantic_equivalent: true,
        },
      };
    } else {
      newCrit = {
        name: "Thành phần bắt buộc",
        description: "Trang bìa, tài liệu tham khảo hoặc bảng phân công",
        rule_type: "PRESENCE",
        handling: "BLOCKING",
        when_unable_to_check: "UNABLE_TO_CHECK",
        expected_value: {
          kind: "cover_page_fields",
          required_fields: ["Tên trường", "Tên đề tài", "Giảng viên hướng dẫn", "Sinh viên thực hiện"],
        },
      };
    }
    setEditableCriteria((prev) => [...prev, newCrit]);
    setExpandedIndex(editableCriteria.length);
  }

  // 3. Sửa một tiêu chí
  function handleUpdateCriterion(index: number, patch: Partial<(typeof editableCriteria)[0]>) {
    setEditableCriteria((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  // 4. Xóa tiêu chí
  function handleRemoveCriterion(index: number) {
    setEditableCriteria((prev) => prev.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
    else if (expandedIndex !== null && expandedIndex > index) setExpandedIndex(expandedIndex - 1);
  }

  // 5. Lưu và Duyệt Áp Dụng ngay cho học phần
  async function handleSaveAndApprove() {
    if (!editableCriteria.length) {
      setMessage("Danh sách tiêu chí đang trống. Hãy thêm hoặc trích xuất tiêu chí trước khi lưu.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      // Tạo draft
      const draft = await postJson<FormatCriteriaSet>("/api/v1/format-checks/criteria/drafts", {
        course_id: selectedCourseId,
        lecturer_id: "lecturer-01",
        report_type: reportType,
        title: title.trim() || "Bộ tiêu chí hình thức báo cáo",
        criteria: editableCriteria.map((c) => ({
          name: c.name.trim(),
          description: c.description.trim(),
          rule_type: c.rule_type,
          handling: c.handling,
          when_unable_to_check: c.when_unable_to_check,
          expected_value: c.expected_value,
          source_citation: c.source_citation?.trim() || undefined,
        })),
        source_document_ids: selectedDocs,
      });

      // Duyệt active luôn
      await postJson(`/api/v1/format-checks/criteria/${draft.id}/approve?lecturer_id=lecturer-01`, {});
      setMessage(`✅ Đã lưu và phê duyệt áp dụng thành công bộ tiêu chí phiên bản v${draft.version}! Sinh viên có thể kiểm tra bài nộp ngay.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể lưu bộ tiêu chí.");
    } finally {
      setSaving(false);
    }
  }

  // Xử lý thẩm định ca mơ hồ của sinh viên
  async function decideReview(item: FormatReviewCase, decision: "ACCEPTED" | "REQUIRES_FIX") {
    const reason = window.prompt(decision === "ACCEPTED" ? "Lý do chấp thuận (ví dụ: cách trình bày hợp lý):" : "Yêu cầu sinh viên sửa lại:");
    if (!reason) return;
    try {
      await postJson(`/api/v1/format-checks/reviews/${item.id}/decision`, {
        reviewer_id: "lecturer-01",
        decision,
        reason,
      });
      setMessage("Đã gửi phản hồi thành công đến sinh viên.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể ghi quyết định.");
    }
  }

  // Đếm theo rule_type
  const counts = useMemo(() => {
    let meas = 0;
    let tmpl = 0;
    let pres = 0;
    editableCriteria.forEach((c) => {
      if (c.rule_type === "MEASUREMENT") meas++;
      else if (c.rule_type === "TEMPLATE") tmpl++;
      else if (c.rule_type === "PRESENCE") pres++;
    });
    return { total: editableCriteria.length, meas, tmpl, pres };
  }, [editableCriteria]);

  // Lọc tiêu chí hiển thị
  const filteredCriteria = useMemo(() => {
    return editableCriteria
      .map((criterion, originalIndex) => ({ criterion, originalIndex }))
      .filter(({ criterion }) => {
        if (ruleFilter !== "ALL" && criterion.rule_type !== ruleFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = criterion.name.toLowerCase().includes(q);
          const matchDesc = criterion.description.toLowerCase().includes(q);
          const matchCitation = (criterion.source_citation || "").toLowerCase().includes(q);
          return matchName || matchDesc || matchCitation;
        }
        return true;
      });
  }, [editableCriteria, ruleFilter, searchQuery]);

  const totals = metrics.reduce(
    (sum, item) => ({
      total: sum.total + item.total_checks,
      pass: sum.pass + item.passed_checks,
      fix: sum.fix + item.needs_fix_checks,
      review: sum.review + item.needs_review_checks,
      unable: sum.unable + item.unable_to_check_checks,
    }),
    { total: 0, pass: 0, fix: 0, review: 0, unable: 0 }
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-wrap justify-between items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <p className="text-xs font-bold tracking-wider text-red-700 uppercase">Giảng viên phụ trách</p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Quản lý Tiêu chí Hình thức</h1>
            <p className="text-sm text-slate-500 mt-1">Trích xuất từ đề cương, cấu hình tiêu chí linh hoạt và thẩm định các trường hợp đặc biệt.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-600">Học phần:</span>
            <CriteriaSelect catalog={catalog} courseId={selectedCourseId} onChange={onSelectCourse} />
            <label className="text-sm font-semibold text-slate-600">
              Loại báo cáo:
              <input
                value={reportType}
                list="known-report-types"
                onChange={(event) => {
                  const nextReportType = event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_");
                  setReportType(nextReportType);
                  const matchingActive = sets.find((item) => item.report_type === nextReportType && item.status === "ACTIVE");
                  if (matchingActive) loadCriteriaSetIntoEditor(matchingActive);
                }}
                className="ml-2 w-44 px-2.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800"
                aria-label="Loại báo cáo"
              />
              <datalist id="known-report-types">
                {reportTypes.map((type) => <option key={type} value={type} />)}
              </datalist>
            </label>
          </div>
        </header>

        {message && (
          <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sm text-sky-800 flex items-center justify-between">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} className="text-xs text-sky-600 hover:text-sky-900 font-bold ml-2">Đóng</button>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Profile policy &amp; lịch sử phiên bản</h2>
              <p className="mt-1 text-xs text-slate-600">
                Mỗi loại báo cáo có một lịch sử riêng. Khi lưu và phê duyệt, hệ thống tạo phiên bản mới; kết quả sinh viên đã kiểm tra vẫn giữ snapshot cũ.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setReportType("new_report");
                setTitle("Bộ tiêu chí hình thức báo cáo");
                setEditableCriteria([]);
                setSelectedDocs(documents.map((document) => document.id));
                setExpandedIndex(null);
                setMessage("Đang tạo profile mới. Hãy đặt Loại báo cáo, thêm tiêu chí rồi Lưu & Phê duyệt.");
              }}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-50"
            >
              + Tạo profile mới
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <label className="text-xs font-semibold text-slate-700">
              Profile đang chỉnh sửa
              <select
                value={reportType}
                onChange={(event) => {
                  const next = event.target.value;
                  const activeSet = sets.find((item) => item.report_type === next && item.status === "ACTIVE");
                  if (activeSet) loadCriteriaSetIntoEditor(activeSet);
                  else setReportType(next);
                }}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                {!reportTypes.includes(reportType) && <option value={reportType}>{reportType} (profile mới)</option>}
                {reportTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>

            <div>
              <p className="text-xs font-semibold text-slate-700">Các version của {reportType}</p>
              {versionHistory.length === 0 ? (
                <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Chưa có version nào. Profile này sẽ bắt đầu từ v1.</p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {versionHistory.map((criteriaSet) => (
                    <div key={criteriaSet.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs">
                      <span className="font-bold text-slate-800">v{criteriaSet.version}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${criteriaSet.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : criteriaSet.status === "SUPERSEDED" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-800"}`}>
                        {criteriaSet.status === "ACTIVE" ? "Đang áp dụng" : criteriaSet.status === "SUPERSEDED" ? "Đã thay thế" : "Nháp"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          loadCriteriaSetIntoEditor(criteriaSet);
                          setMessage(`Đã nạp v${criteriaSet.version} vào trình sửa. Khi lưu, hệ thống tạo một version mới và không sửa bản cũ.`);
                        }}
                        className="font-bold text-red-700 hover:text-red-900"
                      >
                        Nạp để chỉnh sửa
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 1. KHU VỰC TRÍCH XUẤT TIÊU CHÍ TỪ TÀI LIỆU ────────────────────── */}
        <section className="bg-gradient-to-r from-red-900/10 via-slate-900/5 to-white border border-red-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>⚡ Trích xuất tiêu chí từ tài liệu học phần</span>
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Toàn bộ dữ liệu quy chế/đề cương được đưa cho AI để bóc tách các tiêu chí định dạng thực tế của môn học.
              </p>
            </div>
            <button
              type="button"
              disabled={extracting || documents.length === 0}
              onClick={handleExtractFromDocs}
              className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-sm font-bold shadow-md shadow-red-900/20 disabled:opacity-50 flex items-center gap-2 transition-all cursor-pointer"
            >
              {extracting ? (
                <>
                  <span className="animate-spin inline-block">⏳</span>
                  <span>Đang phân tích tài liệu…</span>
                </>
              ) : (
                <>
                  <span>⚡ Trích xuất tiêu chí</span>
                </>
              )}
            </button>
          </div>

          {documents.length > 0 ? (
            <div className="pt-2 border-t border-slate-200/80">
              <p className="text-xs font-semibold text-slate-700 mb-2">Tài liệu nguồn đang áp dụng:</p>
              <div className="flex flex-wrap gap-2">
                {documents.map((doc) => {
                  const isChecked = selectedDocs.includes(doc.id);
                  return (
                    <label
                      key={doc.id}
                      className={`text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-all flex items-center gap-2 ${isChecked
                        ? "bg-red-50 border-red-300 text-red-900 font-semibold"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          setSelectedDocs((prev) =>
                            prev.includes(doc.id) ? prev.filter((id) => id !== doc.id) : [...prev, doc.id]
                          )
                        }
                        className="rounded text-red-700 focus:ring-red-500"
                      />
                      <span>📄 {doc.title}</span>
                    </label>
                  );
                })}
              </div>

              {/* Tùy chọn linh hoạt tên đề mục */}
              <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-white/80 p-3 rounded-xl border border-slate-200">
                <div className="flex items-start gap-2.5 max-w-2xl">
                  <input
                    type="checkbox"
                    id="allow-semantic-equivalent"
                    checked={allowSemanticEquivalent}
                    onChange={(e) => setAllowSemanticEquivalent(e.target.checked)}
                    className="mt-0.5 rounded text-red-700 focus:ring-red-500 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="allow-semantic-equivalent" className="text-xs text-slate-700 cursor-pointer select-none">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <span>{allowSemanticEquivalent ? "✅" : "🔒"}</span>
                      {allowSemanticEquivalent
                        ? "Cho phép đề mục mang ý nghĩa tương đương (Khuyến nghị)"
                        : "Bắt buộc đề mục phải chính xác 100% từng chữ"}
                    </span>
                    <span className="text-slate-500 text-[11px] block mt-0.5 leading-relaxed">
                      {allowSemanticEquivalent
                        ? "Cho phép sinh viên đặt tên mục có thể khác một chút nhưng cùng ngữ nghĩa (ví dụ: 'Mở đầu' ↔ 'Giới thiệu', 'Hiện thực' ↔ 'Cài đặt và thử nghiệm'). Cấu trúc phân cấp và thứ tự tuần tự giữa các chương vẫn được đối chiếu nghiêm ngặt."
                        : "Yêu cầu tên các chương và mục con trong báo cáo phải trùng khớp hoàn toàn từng chữ với dàn ý tài liệu mẫu."}
                    </span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${allowSemanticEquivalent
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-slate-100 text-slate-700 border-slate-300"
                      }`}
                  >
                    {allowSemanticEquivalent ? "Linh hoạt ngữ nghĩa: BẬT" : "Khớp 100% từng chữ: BẬT"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              Chưa có tài liệu nào trong thư mục của học phần này để trích xuất.
            </p>
          )}
        </section>

        {/* ── 2. KHU VỰC QUẢN LÝ TIÊU CHÍ ĐỘNG ──────────────────────────────── */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Danh sách Tiêu chuẩn Hình thức</h2>
                {active ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    Đang áp dụng v{active.version}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                    Chưa kích hoạt
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Bộ tiêu chí động gồm {editableCriteria.length} quy chuẩn được áp dụng trực tiếp khi sinh viên nộp báo cáo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleAddCriterion("MEASUREMENT")}
                className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>📏 Thêm tiêu chí số đo</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddCriterion("PRESENCE")}
                className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>📝 Thêm tiêu chí nội dung / text</span>
              </button>
              <button
                type="button"
                disabled={saving || editableCriteria.length === 0}
                onClick={handleSaveAndApprove}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-900/20 disabled:opacity-50 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {saving ? "Đang lưu…" : "💾 Lưu & Phê duyệt áp dụng"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600">Tên bộ tiêu chí:</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
              placeholder="Ví dụ: Quy chuẩn báo cáo đồ án HK242"
            />
          </div>

          {/* Controls: Tabs View Mode & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-b border-slate-200 pb-3">
            {/* View Mode Switcher */}
            <div className="flex gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`pb-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === "table"
                  ? "border-red-700 text-red-700 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
              >
                <span>📋 Bảng tổng quan ({editableCriteria.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`pb-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === "cards"
                  ? "border-red-700 text-red-700 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
              >
                <span>✏️ Soạn thảo chi tiết ({editableCriteria.length})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="flex-1 max-w-xs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Tìm tiêu chuẩn, trích dẫn..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Rule Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="text-slate-500 mr-1">Phân loại:</span>
            <button
              type="button"
              onClick={() => setRuleFilter("ALL")}
              className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${ruleFilter === "ALL"
                ? "bg-slate-800 text-white border-slate-800 shadow-2xs"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
            >
              Tất cả ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setRuleFilter("MEASUREMENT")}
              className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${ruleFilter === "MEASUREMENT"
                ? "bg-sky-700 text-white border-sky-700 shadow-2xs"
                : "bg-sky-50 text-sky-900 border-sky-200 hover:bg-sky-100"
                }`}
            >
              📏 Đo lường ({counts.meas})
            </button>
            <button
              type="button"
              onClick={() => setRuleFilter("TEMPLATE")}
              className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${ruleFilter === "TEMPLATE"
                ? "bg-purple-700 text-white border-purple-700 shadow-2xs"
                : "bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100"
                }`}
            >
              📑 Khung đề mục ({counts.tmpl})
            </button>
            <button
              type="button"
              onClick={() => setRuleFilter("PRESENCE")}
              className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${ruleFilter === "PRESENCE"
                ? "bg-amber-700 text-white border-amber-700 shadow-2xs"
                : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
                }`}
            >
              📚 Thành phần ({counts.pres})
            </button>
          </div>

          {/* VIEW 1: TABLE VIEW */}
          {viewMode === "table" && (
            <div className="space-y-3">
              {filteredCriteria.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs">
                  {editableCriteria.length === 0
                    ? "Chưa có tiêu chí nào. Hãy bấm nút trích xuất từ tài liệu hoặc thêm tiêu chí mới."
                    : "Không tìm thấy tiêu chí nào phù hợp với bộ lọc."}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                      <tr>
                        <th className="p-3 w-12 text-center">STT</th>
                        <th className="p-3 w-56">Tên tiêu chuẩn</th>
                        <th className="p-3 w-36 text-center">Phân loại</th>
                        <th className="p-3">Quy chuẩn / Căn cứ trích dẫn</th>
                        <th className="p-3 w-28 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCriteria.map(({ criterion, originalIndex }, displayIdx) => {
                        const summary = getCriterionSummary(criterion);
                        const isExpanded = expandedIndex === originalIndex;

                        return (
                          <tr
                            key={originalIndex}
                            className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? "bg-red-50/20" : "bg-white"
                              }`}
                          >
                            <td className="p-3 text-center font-bold text-slate-500">{displayIdx + 1}</td>
                            <td className="p-3">
                              <p className="font-bold text-slate-900">{criterion.name}</p>
                              {criterion.description && (
                                <p className="text-[11px] text-slate-500 mt-0.5">{criterion.description}</p>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <RuleTypeBadge
                                ruleType={criterion.rule_type}
                                name={criterion.name}
                                expectedValue={criterion.expected_value}
                              />
                            </td>
                            <td className="p-3 text-slate-700">
                              <div>
                                {summary && (
                                  <p className="font-semibold text-slate-900">
                                    🎯 {summary}
                                  </p>
                                )}
                                {criterion.source_citation && (
                                  <p className="text-[11px] text-amber-900/90 italic mt-1 line-clamp-2 bg-amber-50/60 p-1.5 rounded border border-amber-200/70">
                                    ❝ {criterion.source_citation}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedIndex(isExpanded ? null : originalIndex);
                                    setViewMode("cards");
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  title="Chỉnh sửa tiêu chí"
                                >
                                  ✏️ Sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCriterion(originalIndex)}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded text-xs font-bold transition-all cursor-pointer"
                                  title="Xóa tiêu chí này"
                                >
                                  ✕
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: DETAILED CARDS VIEW */}
          {viewMode === "cards" && (
            <div>
              {filteredCriteria.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl space-y-3">
                  <p className="text-sm text-slate-500 font-medium">Chưa có tiêu chí nào trong danh sách.</p>
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleExtractFromDocs}
                      disabled={documents.length === 0}
                      className="px-4 py-2 bg-red-700 text-white rounded-lg text-xs font-bold hover:bg-red-800 cursor-pointer"
                    >
                      ⚡ Trích xuất ngay từ tài liệu
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddCriterion("MEASUREMENT")}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                    >
                      ➕ Thêm tiêu chí thủ công
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredCriteria.map(({ criterion, originalIndex }, displayIdx) => {
                    const summary = getCriterionSummary(criterion);
                    const isExpanded = expandedIndex === originalIndex;
                    return (
                      <div
                        key={originalIndex}
                        className={`border rounded-2xl transition-all p-4 shadow-xs space-y-3 ${isExpanded
                          ? "bg-white border-slate-300 ring-2 ring-slate-200/60"
                          : "bg-white border-slate-200/90 hover:border-slate-300"
                          }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 flex-1 min-w-64">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center border border-slate-200 flex-shrink-0">
                              {displayIdx + 1}
                            </span>
                            <input
                              value={criterion.name}
                              onChange={(e) => handleUpdateCriterion(originalIndex, { name: e.target.value })}
                              className="font-bold text-sm text-slate-900 bg-transparent hover:bg-slate-50 focus:bg-white px-2.5 py-1 rounded-lg border border-transparent hover:border-slate-200 focus:border-slate-300 focus:ring-1 focus:ring-slate-400 flex-1 transition-all"
                              placeholder="Tên tiêu chí (ví dụ: Căn lề trang, Khung đề mục, Chuẩn trích dẫn...)"
                            />
                            <RuleTypeBadge
                              ruleType={criterion.rule_type}
                              name={criterion.name}
                              expectedValue={criterion.expected_value}
                            />
                            {summary && (
                              <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200/70 hidden sm:inline-block">
                                {summary}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setExpandedIndex(isExpanded ? null : originalIndex)}
                              className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${isExpanded
                                ? "bg-slate-800 text-white"
                                : "text-slate-700 bg-slate-100 hover:bg-slate-200"
                                }`}
                            >
                              {isExpanded ? "Thu gọn ▴" : "Chỉnh sửa ▾"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveCriterion(originalIndex)}
                              className="text-xs px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-800 rounded-lg font-bold transition-all cursor-pointer"
                              title="Xóa tiêu chí này"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {!isExpanded && (
                          <div className="pl-8 space-y-2">
                            {criterion.source_citation && (
                              <div className="bg-amber-50/70 border-l-3 border-amber-400 px-3 py-1.5 rounded-r-lg text-xs text-amber-950 flex items-start gap-2">
                                <span className="text-amber-500 font-serif text-sm leading-none mt-0.5 select-none">❝</span>
                                <div className="flex-1 leading-normal line-clamp-2">
                                  <span className="font-semibold text-amber-800">Trích đoạn nguồn: </span>
                                  <span className="italic">{criterion.source_citation}</span>
                                </div>
                              </div>
                            )}
                            {criterion.description && (
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {criterion.description}
                              </p>
                            )}
                          </div>
                        )}

                        {isExpanded && (
                          <div className="pl-8 pt-3 border-t border-slate-200/80 space-y-4">
                            <div className="bg-amber-50/60 border border-amber-200/90 rounded-xl p-3.5 space-y-1.5">
                              <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                                <span className="text-amber-600 font-serif text-sm">❝</span>
                                <span>1. Trích dẫn quy chế nguồn:</span>
                              </label>
                              <textarea
                                value={criterion.source_citation || ""}
                                onChange={(e) => handleUpdateCriterion(originalIndex, { source_citation: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs text-amber-950 italic focus:ring-2 focus:ring-amber-400 focus:outline-none transition-all leading-relaxed"
                                placeholder="Dán hoặc chỉnh sửa đoạn văn bản quy định trích từ tài liệu học phần..."
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span>📝</span>
                                <span>2. Mô tả tiêu chí đối chiếu:</span>
                              </label>
                              <input
                                value={criterion.description}
                                onChange={(e) => handleUpdateCriterion(originalIndex, { description: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-400 focus:outline-none transition-all"
                                placeholder="Mô tả điều cần đối chiếu..."
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span>⚙️</span>
                                <span>3. Phương thức kiểm tra tiêu chí:</span>
                              </label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCriterion(originalIndex, { rule_type: "MEASUREMENT" })}
                                  className={`p-2.5 rounded-xl text-left border text-xs transition-all cursor-pointer ${criterion.rule_type === "MEASUREMENT"
                                    ? "bg-sky-50 border-sky-400 text-sky-950 font-bold ring-2 ring-sky-400/50 shadow-xs"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                    }`}
                                >
                                  <div className="flex items-center gap-1.5 text-xs font-bold">
                                    <span>📏</span>
                                    <span>Tiêu chí Số đo (Code đo tự động)</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                                    Căn lề trang (cm), Khổ giấy A4, Phông chữ, Cỡ chữ (pt), Giãn dòng, Số trang
                                  </p>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCriterion(originalIndex, { rule_type: "PRESENCE" })}
                                  className={`p-2.5 rounded-xl text-left border text-xs transition-all cursor-pointer ${criterion.rule_type !== "MEASUREMENT"
                                    ? "bg-purple-50 border-purple-400 text-purple-950 font-bold ring-2 ring-purple-400/50 shadow-xs"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                    }`}
                                >
                                  <div className="flex items-center gap-1.5 text-xs font-bold">
                                    <span>📝</span>
                                    <span>Tiêu chí Nội dung / Text (AI kiểm tra)</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                                    Trang bìa, Bảng phân công, Khung đề mục chương/mục, Mục lục, Tài liệu tham khảo, v.v.
                                  </p>
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1.5 pt-1">
                              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span>🚦</span>
                                <span>4. Cách xử lý khi tiêu chí không đạt:</span>
                              </label>
                              <div className="grid gap-2 sm:grid-cols-3">
                                {([
                                  ["BLOCKING", "Bắt buộc sửa", "Bài cần sửa trước khi nộp"],
                                  ["ADVISORY", "Gợi ý", "Hiển thị khuyến nghị, không chặn"],
                                  ["MANUAL_REVIEW", "Cần giảng viên", "Tạo ca chờ thẩm định"],
                                ] as const).map(([value, label, description]) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => handleUpdateCriterion(originalIndex, { handling: value })}
                                    className={`rounded-xl border p-2.5 text-left text-xs transition-all ${criterion.handling === value ? "border-red-400 bg-red-50 text-red-950 ring-2 ring-red-200" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                                  >
                                    <span className="block font-bold">{label}</span>
                                    <span className="mt-0.5 block text-[10px] text-slate-500">{description}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <label className="block rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                              <span className="font-bold text-slate-900">Khi hệ thống không thể đọc / đo được:</span>
                              <select
                                value={criterion.when_unable_to_check}
                                onChange={(event) => handleUpdateCriterion(originalIndex, { when_unable_to_check: event.target.value as "UNABLE_TO_CHECK" | "NEEDS_REVIEW" })}
                                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
                              >
                                <option value="UNABLE_TO_CHECK">Báo “không thể kiểm tra” cho sinh viên</option>
                                <option value="NEEDS_REVIEW">Chuyển sang giảng viên thẩm định</option>
                              </select>
                            </label>

                            <div className="space-y-1.5 pt-1">
                              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span>🎯</span>
                                <span>5. Ô sửa nội dung quy chuẩn:</span>
                              </label>
                              <StructuredContentEditor
                                ruleType={criterion.rule_type}
                                expectedValue={criterion.expected_value}
                                name={criterion.name}
                                onChange={(val) => handleUpdateCriterion(originalIndex, { expected_value: val })}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {editableCriteria.length > 0 && (
            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-slate-500">Tổng cộng {editableCriteria.length} tiêu chí</span>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveAndApprove}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-900/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {saving ? "Đang lưu…" : "💾 Lưu & Phê duyệt áp dụng"}
              </button>
            </div>
          )}
        </section>

        {/* ── 3. KHU VỰC CÁC PHẢN HỒI (CA CẦN PHÁN ĐOÁN) ──────────────────── */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-3 border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Phản hồi ca cần thẩm định</span>
                {reviews.filter((item) => item.status === "UNDER_REVIEW").length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                    {reviews.filter((item) => item.status === "UNDER_REVIEW").length} ca chờ duyệt
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Các bài nộp của sinh viên có cấu trúc tương đương hoặc cần giảng viên xác nhận trực tiếp (chỉ rõ ĐÚNG, SAI, MƠ HỒ).
              </p>
            </div>
          </div>

          {reviews.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Chưa có ca nào cần giảng viên xem xét.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((item) => {
                const ambiguousList = item.ambiguous_results || [];
                const snapshotResults = ((item.extracted_snapshot?.results as FormatCriterionResult[]) || []);
                const passResults = snapshotResults.filter((r) => r.status === "PASS");
                const failResults = snapshotResults.filter((r) => r.status === "FAIL");

                return (
                  <article
                    key={item.id}
                    className={`p-5 border rounded-2xl space-y-4 transition-all shadow-xs ${item.status === "UNDER_REVIEW"
                      ? "border-amber-300 bg-amber-50/40 ring-1 ring-amber-400/30"
                      : item.status === "ACCEPTED"
                        ? "border-emerald-200 bg-emerald-50/30"
                        : "border-slate-200 bg-slate-50/50"
                      }`}
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 border-slate-200/80">
                      <div>
                        <p className="font-bold text-base text-slate-900 flex items-center gap-2">
                          <span>📄</span>
                          <span>{item.filename}</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Sinh viên: <b className="text-slate-800">{item.actor_id}</b> · Gửi lúc: {new Date(item.created_at).toLocaleString("vi-VN")} · Hồ sơ: <span className="font-mono">#{item.id.slice(-8)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {snapshotResults.length > 0 && (
                          <div className="hidden sm:flex items-center gap-1 text-[11px] font-semibold">
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">✅ {passResults.length} Đúng</span>
                            {failResults.length > 0 && <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800">❌ {failResults.length} Sai</span>}
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">⚠️ {ambiguousList.length} Mơ hồ</span>
                          </div>
                        )}
                        <ResultBadge status={item.status} />
                      </div>
                    </div>

                    {/* 1. KHỐI CÁC ĐIỂM MƠ HỒ CẦN GIẢNG VIÊN DUYỆT */}
                    {ambiguousList.length > 0 && (
                      <div className="space-y-3 bg-white p-4 rounded-xl border border-amber-200 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                            <span>⚠️</span>
                            <span>CÁC ĐIỂM MƠ HỒ CẦN GIẢNG VIÊN XÁC NHẬN ({ambiguousList.length} tiêu chí):</span>
                          </h4>
                          <span className="text-[11px] text-amber-800 font-semibold bg-amber-100/80 px-2 py-0.5 rounded-md">
                            Duyệt theo từng tiêu chí
                          </span>
                        </div>

                        <div className="space-y-3">
                          {ambiguousList.map((amb, ambIdx) => {
                            const actVal = amb.actual_value as Record<string, unknown> | undefined;
                            const locStr = (actVal?.location as string) || (actVal?.detected as string) || "Trong bài nộp";
                            const citation = (amb.source_citation as string) || (amb.description as string);

                            return (
                              <div
                                key={ambIdx}
                                className="p-3.5 bg-amber-50/60 border border-amber-200/90 rounded-xl space-y-2.5 text-xs"
                              >
                                <div className="flex items-center justify-between gap-2 border-b border-amber-200/70 pb-1.5">
                                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                      {ambIdx + 1}
                                    </span>
                                    <span>{String(amb.name || "Tiêu chí chưa xác định")}</span>
                                  </p>
                                  <span className="text-[10px] font-semibold text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-200">
                                    Vị trí: {locStr}
                                  </span>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-2.5 text-[11px]">
                                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                                    <span className="font-bold text-slate-700 flex items-center gap-1">
                                      <span>🎯</span>
                                      <span>Trích dẫn nguyên văn quy chế:</span>
                                    </span>
                                    <p className="text-slate-700 italic bg-slate-50 p-1.5 rounded text-[11px] leading-relaxed border border-slate-100">
                                      {citation ? `"${citation}"` : JSON.stringify(amb.expected_value)}
                                    </p>
                                  </div>
                                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                                    <span className="font-bold text-slate-700 flex items-center gap-1">
                                      <span>📄</span>
                                      <span>Thực tế trong bài nộp sinh viên:</span>
                                    </span>
                                    <div className="text-slate-800 bg-slate-50 p-1.5 rounded text-[11px] leading-relaxed border border-slate-100 font-mono">
                                      {actVal?.detected ? `Đề mục: ${String(actVal.detected)}` : JSON.stringify(actVal || "(Chưa khớp rõ ràng)")}
                                    </div>
                                  </div>
                                </div>

                                <div className="p-2.5 bg-amber-100/70 rounded-lg text-amber-950 text-[11px] space-y-0.5 border border-amber-200">
                                  <div className="font-bold flex items-center gap-1 text-amber-900">
                                    <span>💡</span>
                                    <span>Phân tích điểm mơ hồ &amp; Vị trí trong báo cáo:</span>
                                  </div>
                                  <p className="leading-relaxed">
                                    {String(amb.message || "Tên mục hoặc cấu trúc có sự tương đương nhưng khác biệt từ ngữ; cần giảng viên quyết định ngoại lệ.")}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 2. KHỐI CÁC ĐIỂM SAI / CẦN SỬA (NẾU CÓ) */}
                    {failResults.length > 0 && (
                      <details className="bg-rose-50/50 p-3 rounded-xl border border-rose-200 text-xs">
                        <summary className="cursor-pointer font-bold text-rose-900 flex items-center gap-1.5">
                          <span>❌</span>
                          <span>Các điểm SAI / CHƯA ĐẠT trong bài nộp ({failResults.length} mục)</span>
                        </summary>
                        <div className="space-y-2 mt-2 pt-2 border-t border-rose-200">
                          {failResults.map((failItem, fIdx) => (
                            <div key={fIdx} className="p-2.5 bg-white rounded-lg border border-rose-200 space-y-1">
                              <p className="font-bold text-rose-950">{failItem.name}</p>
                              <p className="text-slate-700">{failItem.message}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {/* 3. KHỐI CÁC ĐIỂM ĐÚNG / ĐẠT CHUẨN (COLLAPSIBLE) */}
                    {passResults.length > 0 && (
                      <details className="bg-emerald-50/30 p-3 rounded-xl border border-emerald-200 text-xs">
                        <summary className="cursor-pointer font-bold text-emerald-900 flex items-center gap-1.5">
                          <span>✅</span>
                          <span>Các điểm ĐÃ ĐÚNG / ĐẠT CHUẨN 100% ({passResults.length} mục)</span>
                        </summary>
                        <div className="grid sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-emerald-200 text-[11px]">
                          {passResults.map((passItem, pIdx) => (
                            <div key={pIdx} className="p-2 bg-white rounded-lg border border-emerald-100 flex items-center gap-1.5">
                              <span className="text-emerald-700 font-bold">✓</span>
                              <span className="text-slate-800 font-semibold">{passItem.name}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {/* Toolbar Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-2">
                        {item.extracted_snapshot && (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveReportFactsModal({
                                facts: item.extracted_snapshot,
                                filename: item.filename,
                                ambiguousResults: item.ambiguous_results,
                                results: (item.extracted_snapshot.results as FormatCriterionResult[]) || undefined,
                                checklistSummary: (item.extracted_snapshot.checklist_summary as ChecklistSummaryItem[]) || undefined,
                              })
                            }
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                          >
                            <span>📄 Xem lại bài nộp &amp; Đối chiếu toàn diện</span>
                          </button>
                        )}
                        <details className="text-xs text-slate-600 bg-white p-2 rounded-xl border border-slate-200">
                          <summary className="cursor-pointer font-semibold text-slate-700">
                            🔍 JSON Snapshot
                          </summary>
                          <pre className="whitespace-pre-wrap mt-2 p-2 bg-slate-50 rounded text-[11px] overflow-auto max-h-48 font-mono">
                            {JSON.stringify({ snapshot: item.extracted_snapshot, ambiguous: item.ambiguous_results }, null, 2)}
                          </pre>
                        </details>
                      </div>

                      {item.status === "UNDER_REVIEW" ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => decideReview(item, "ACCEPTED")}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-900/20 flex items-center gap-1.5"
                          >
                            <span>✓</span>
                            <span>Chấp thuận hợp lệ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => decideReview(item, "REQUIRES_FIX")}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-md shadow-rose-900/20 flex items-center gap-1.5"
                          >
                            <span>✕</span>
                            <span>Yêu cầu sinh viên sửa</span>
                          </button>
                        </div>
                      ) : (
                        item.decision_reason && (
                          <div className="text-xs text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                            <span className="font-bold text-slate-900">Phản hồi của GV:</span>
                            <span>{item.decision_reason}</span>
                          </div>
                        )
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 4. THỐNG KÊ LƯỢT KIỂM TRA ────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ["Lượt kiểm tra", totals.total, "text-slate-800"],
            ["Đạt chuẩn", totals.pass, "text-emerald-700"],
            ["Cần sửa lại", totals.fix, "text-rose-700"],
            ["Chờ giảng viên", totals.review, "text-amber-700"],
            ["Không thể kiểm tra", totals.unable, "text-sky-700"],
          ].map(([label, value, colorClass]) => (
            <div key={String(label)} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
            </div>
          ))}
        </section>

        {/* Modal xem lại bài nộp của sinh viên (Giảng viên) */}
        {activeReportFactsModal && (
          <SubmittedReportFactsModal
            facts={activeReportFactsModal.facts}
            filename={activeReportFactsModal.filename}
            results={activeReportFactsModal.results}
            checklistSummary={activeReportFactsModal.checklistSummary}
            ambiguousResults={activeReportFactsModal.ambiguousResults}
            onClose={() => setActiveReportFactsModal(null)}
          />
        )}
      </div>
    </div>
  );
}

export function FormatPrecheckPage({ role, catalog, selectedCourseId, onSelectCourse }: Props) {
  return role === "student" ? <StudentFormatCheck catalog={catalog} selectedCourseId={selectedCourseId} onSelectCourse={onSelectCourse} /> : <LecturerFormatCheck catalog={catalog} selectedCourseId={selectedCourseId} onSelectCourse={onSelectCourse} />;
}
