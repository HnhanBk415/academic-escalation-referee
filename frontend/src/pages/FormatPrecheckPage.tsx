import { FormEvent, useEffect, useMemo, useState } from "react";

import { api, postJson } from "../api/client";
import type {
  DemoCatalog,
  DocumentSummary,
  FormatCheckResponse,
  FormatCriteriaSet,
  FormatCriterionResult,
  FormatMetric,
  FormatReviewCase,
  FormatRuleType,
} from "../types";
import {
  RuleTypeBadge,
  getCriterionSummary,
  StructuredContentEditor,
} from "../components/StructuredContentEditor";

type Role = "student" | "lecturer";

interface Props {
  role: Role;
  catalog: DemoCatalog | null;
  selectedCourseId: string;
  onSelectCourse: (courseId: string) => void;
}

function ResultBadge({ status }: { status: string }) {
  const color = status === "PASS" || status === "ACCEPTED"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : status === "FAIL" || status === "NEEDS_FIX" || status === "REQUIRES_FIX"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-amber-50 text-amber-800 border-amber-200";
  const label: Record<string, string> = {
    PASS: "Đạt", FAIL: "Cần sửa", UNMEASURABLE: "Không đo được", AMBIGUOUS: "Cần GV phán đoán",
    NEEDS_FIX: "Cần sửa", UNABLE_TO_CHECK: "Chưa kiểm tra được", ACCEPTED: "Đã chấp thuận",
    REQUIRES_FIX: "Yêu cầu sửa", UNDER_REVIEW: "Chờ giảng viên",
  };
  return <span className={`px-2 py-1 rounded border text-[11px] font-bold ${color}`}>{label[status] || status}</span>;
}

function CriteriaSelect({ catalog, courseId, onChange }: { catalog: DemoCatalog | null; courseId: string; onChange: (value: string) => void }) {
  return (
    <select value={courseId} onChange={(event) => onChange(event.target.value)} className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800">
      {catalog?.courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
    </select>
  );
}

function StudentFormatCheck({ catalog, selectedCourseId, onSelectCourse }: Omit<Props, "role">) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<FormatCheckResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState<FormatReviewCase[]>([]);

  async function loadReviews() {
    try {
      setReviews(await api<FormatReviewCase[]>(`/api/v1/format-checks/reviews/student?course_id=${encodeURIComponent(selectedCourseId)}&actor_id=demo-student`));
    } catch { setReviews([]); }
  }
  useEffect(() => { void loadReviews(); }, [selectedCourseId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) { setError("Hãy chọn file .docx hoặc .pdf trước khi kiểm tra."); return; }
    setBusy(true); setError(""); setResult(null);
    try {
      const body = new FormData();
      body.append("course_id", selectedCourseId);
      body.append("actor_id", "demo-student");
      body.append("file", file);
      setResult(await api<FormatCheckResponse>("/api/v1/format-checks/checks", { method: "POST", body }));
      await loadReviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể kiểm tra file.");
    } finally { setBusy(false); }
  }

  return <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
    <div className="max-w-4xl mx-auto space-y-6">
      <header><p className="text-xs font-bold tracking-wider text-red-700 uppercase">Trước khi nộp chính thức</p><h1 className="text-2xl font-bold text-slate-900 mt-1">Kiểm tra hình thức báo cáo</h1><p className="text-sm text-slate-500 mt-2">Hệ thống chỉ so khớp hình thức theo bộ tiêu chí do giảng viên duyệt; không chấm hoặc đọc hiểu nội dung bài viết.</p></header>
      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
        <div className="flex flex-wrap gap-4 items-end"><label className="block text-sm font-semibold text-slate-700">Học phần<CriteriaSelect catalog={catalog} courseId={selectedCourseId} onChange={onSelectCourse} /></label><label className="flex-1 min-w-64 block text-sm font-semibold text-slate-700">Báo cáo (.docx, .pdf)<input type="file" accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} className="block mt-1.5 w-full text-sm text-slate-600" /></label></div>
        <div className="rounded-lg bg-sky-50 border border-sky-100 p-3 text-xs text-sky-800">File chỉ được dùng trong lượt kiểm tra này. Chỉ khi có tiêu chí mơ hồ, hệ thống mới lưu snapshot cấu trúc cần thiết để giảng viên xem xét.</div>
        <button disabled={busy || !file} className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-sm font-bold disabled:opacity-50">{busy ? "Đang kiểm tra…" : "Kiểm tra theo quy chế"}</button>
      </form>
      {error && <p className="p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">{error}</p>}
      {result && <CheckResult result={result} />}
      {reviews.length > 0 && <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3"><h2 className="font-bold text-slate-900">Phản hồi của giảng viên</h2>{reviews.map((review) => <article key={review.id} className="border border-slate-200 rounded-xl p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-sm text-slate-800">{review.filename}</p><p className="text-xs text-slate-500">{new Date(review.created_at).toLocaleString("vi-VN")}</p></div><ResultBadge status={review.status} /></div>{review.decision_reason && <p className="text-sm text-slate-600 mt-2">{review.decision_reason}</p>}{review.status === "UNDER_REVIEW" && <p className="text-xs text-amber-800 mt-2">Giảng viên đang xem cách trình bày này.</p>}</article>)}</section>}
    </div>
  </div>;
}

function CriterionResult({ item }: { item: FormatCriterionResult }) {
  return <article className="border border-slate-200 rounded-xl p-4 space-y-2">
    <div className="flex justify-between gap-3"><h3 className="font-semibold text-slate-800">{item.name}</h3><ResultBadge status={item.status} /></div>
    <p className="text-sm text-slate-600">{item.message}</p>
    {item.status !== "PASS" && <div className="grid sm:grid-cols-2 gap-2 text-xs"><p className="p-2 bg-slate-50 rounded"><b>Yêu cầu:</b> {JSON.stringify(item.expected_value)}</p>{item.actual_value && <p className="p-2 bg-slate-50 rounded"><b>Đo được:</b> {JSON.stringify(item.actual_value)}</p>}</div>}
    {item.source_citation && <details className="text-xs text-slate-500"><summary className="cursor-pointer">Xem điều khoản nguồn</summary><p className="mt-2 p-2 bg-amber-50 rounded">{item.source_citation}</p></details>}
  </article>;
}

function CheckResult({ result }: { result: FormatCheckResponse }) {
  const [activeTab, setActiveTab] = useState<"summary" | "criteria">("summary");

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex gap-3 items-start">
        <ResultBadge status={result.overall_status} />
        <div>
          <h2 className="font-bold text-slate-900 text-lg">Kết quả kiểm tra hình thức báo cáo</h2>
          <p className="text-sm text-slate-600 mt-1">{result.message}</p>
          {result.criteria_version && (
            <p className="text-xs text-slate-500 mt-2">
              Bộ tiêu chí phiên bản {result.criteria_version}
              {result.criteria_approved_at ? ` · duyệt ${new Date(result.criteria_approved_at).toLocaleDateString("vi-VN")}` : ""}
            </p>
          )}
        </div>
      </div>

      {result.review_case_id && (
        <p className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
          Một số điểm trình bày chưa thể kết luận tự động đã được chuyển cho giảng viên xem xét.
        </p>
      )}

      {/* Tabs */}
      {result.checklist_summary && result.checklist_summary.length > 0 && (
        <div className="flex border-b border-slate-200 gap-6 text-sm font-medium pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("summary")}
            className={`pb-2.5 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "summary"
                ? "border-red-700 text-red-700 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>📋 Bảng tổng hợp 30 tiêu chí</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
              {result.checklist_summary.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("criteria")}
            className={`pb-2.5 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "criteria"
                ? "border-red-700 text-red-700 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>🔍 Chi tiết tiêu chí áp dụng</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
              {result.results.length}
            </span>
          </button>
        </div>
      )}

      {/* 30-Category Summary Table */}
      {activeTab === "summary" && result.checklist_summary && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
              <tr>
                <th className="p-3 w-12 text-center">STT</th>
                <th className="p-3 w-52">Nhóm tiêu chí</th>
                <th className="p-3 w-32 text-center">Trạng thái</th>
                <th className="p-3">Chi tiết đánh giá / Lỗi phát hiện</th>
                <th className="p-3 w-52">Gợi ý khắc phục</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.checklist_summary.map((row) => (
                <tr
                  key={row.index}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    row.status === "FAIL"
                      ? "bg-rose-50/40"
                      : row.status === "AMBIGUOUS"
                      ? "bg-amber-50/40"
                      : row.status === "PASS"
                      ? "bg-emerald-50/30"
                      : "opacity-65"
                  }`}
                >
                  <td className="p-3 text-center font-medium text-slate-500">{row.index}</td>
                  <td className="p-3 font-semibold text-slate-800">{row.category}</td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        row.status === "PASS"
                          ? "bg-emerald-100 text-emerald-800"
                          : row.status === "FAIL"
                          ? "bg-rose-100 text-rose-800"
                          : row.status === "AMBIGUOUS"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <span>{row.icon}</span>
                      <span>
                        {row.status === "PASS"
                          ? "Đạt"
                          : row.status === "FAIL"
                          ? "Lỗi"
                          : row.status === "AMBIGUOUS"
                          ? "Cảnh báo"
                          : "Không quy định"}
                      </span>
                    </span>
                  </td>
                  <td className="p-3 text-slate-700">
                    <p className="font-medium">{row.error_summary}</p>
                    {row.evidence && row.status !== "NOT_SPECIFIED" && (
                      <p className="mt-1 text-[11px] text-slate-500 font-mono bg-white/80 p-1.5 rounded border border-slate-200/80">
                        {row.evidence.length > 150 ? `${row.evidence.slice(0, 150)}…` : row.evidence}
                      </p>
                    )}
                  </td>
                  <td className="p-3 text-slate-600 text-[11px]">{row.suggestion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Applied Criteria Details */}
      {(activeTab === "criteria" || !result.checklist_summary) && result.results.length > 0 && (
        <div className="space-y-3">
          {result.results.map((item) => (
            <CriterionResult key={item.criterion_id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function LecturerFormatCheck({ catalog, selectedCourseId, onSelectCourse }: Omit<Props, "role">) {
  const [sets, setSets] = useState<FormatCriteriaSet[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [reviews, setReviews] = useState<FormatReviewCase[]>([]);
  const [metrics, setMetrics] = useState<FormatMetric[]>([]);
  const [title, setTitle] = useState("Bộ tiêu chí hình thức báo cáo");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [allowSemanticEquivalent, setAllowSemanticEquivalent] = useState<boolean>(true);

  // Danh sách tiêu chí đang chỉnh sửa trực tiếp
  const [editableCriteria, setEditableCriteria] = useState<
    Array<{
      id?: string;
      name: string;
      description: string;
      rule_type: FormatRuleType;
      expected_value: Record<string, unknown>;
      source_citation?: string;
    }>
  >([]);

  const active = useMemo(() => sets.find((item) => item.status === "ACTIVE"), [sets]);

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

      // Tự động chọn tài liệu nếu chưa chọn
      if (docs.length > 0 && selectedDocs.length === 0) {
        setSelectedDocs(docs.map((d) => d.id));
      }

      // Nạp tiêu chí của bộ tiêu chí ACTIVE nếu danh sách đang sửa trống
      const currentActive = criteriaData.find((item) => item.status === "ACTIVE");
      if (currentActive && currentActive.criteria.length > 0) {
        setTitle(currentActive.title || "Bộ tiêu chí hình thức báo cáo");
        setEditableCriteria(
          currentActive.criteria.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description || "",
            rule_type: c.rule_type,
            expected_value: c.expected_value,
            source_citation: c.source_citation || undefined,
          }))
        );
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể tải dữ liệu kiểm tra hình thức.");
    }
  }

  useEffect(() => {
    setEditableCriteria([]);
    setSelectedDocs([]);
    void load();
  }, [selectedCourseId]);

  // 1. Trích xuất tiêu chí từ tài liệu
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
            expected_value: c.expected_value,
            source_citation: c.source_citation || undefined,
          }))
        );
        setMessage(`⚡ Đã trích xuất thành công ${draft.criteria.length} tiêu chí từ tài liệu. Bạn có thể sửa, bổ sung và bấm "Lưu & Áp dụng".`);
      } else {
        setMessage("Không tìm thấy quy định hình thức tự động nào trong tài liệu đã chọn.");
      }
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Lỗi khi trích xuất tiêu chí.");
    } finally {
      setExtracting(false);
    }
  }

  // 2. Thêm tiêu chí mới
  function handleAddCriterion() {
    setEditableCriteria((prev) => [
      ...prev,
      {
        name: "Tiêu chí mới",
        description: "Mô tả yêu cầu hình thức",
        rule_type: "MEASUREMENT",
        expected_value: { property: "page_count", operator: "max", value: 30 },
      },
    ]);
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
        title: title.trim() || "Bộ tiêu chí hình thức báo cáo",
        criteria: editableCriteria.map((c) => ({
          name: c.name.trim(),
          description: c.description.trim(),
          rule_type: c.rule_type,
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

  const totals = metrics.reduce(
    (sum, item) => ({
      total: sum.total + item.total_checks,
      pass: sum.pass + item.passed_checks,
      fix: sum.fix + item.needs_fix_checks,
      unable: sum.unable + item.unable_to_check_checks,
    }),
    { total: 0, pass: 0, fix: 0, unable: 0 }
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-wrap justify-between items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <p className="text-xs font-bold tracking-wider text-red-700 uppercase">Giảng viên phụ trách</p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Quản lý Tiêu chí Hình thức</h1>
            <p className="text-sm text-slate-500 mt-1">Trích xuất từ đề cương, bổ sung/sửa đổi tiêu chí và phê duyệt cho học phần.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-600">Học phần:</span>
            <CriteriaSelect catalog={catalog} courseId={selectedCourseId} onChange={onSelectCourse} />
          </div>
        </header>

        {message && (
          <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sm text-sky-800 flex items-center justify-between">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} className="text-xs text-sky-600 hover:text-sky-900 font-bold ml-2">Đóng</button>
          </div>
        )}

        {/* ── 1. KHU VỰC TRÍCH XUẤT TIÊU CHÍ Ở TRÊN ────────────────────────── */}
        <section className="bg-gradient-to-r from-red-900/10 via-slate-900/5 to-white border border-red-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>⚡ Trích xuất tiêu chí từ tài liệu học phần</span>
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Hệ thống tự động quét các văn bản hướng dẫn/rubric để bóc tách quy định căn lề, số trang và khung đề mục (Template).
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
                      className={`text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-all flex items-center gap-2 ${
                        isChecked
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

              {/* Tùy chọn linh hoạt tên đề mục (tương đương ngữ nghĩa nhưng bảo toàn cấu trúc & thứ tự) */}
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
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                      allowSemanticEquivalent
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

        {/* ── 2. DANH SÁCH TIÊU CHÍ (CHỈNH SỬA, BỔ SUNG & LƯU) ─────────────── */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Danh sách tiêu chí đối soát</h2>
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
                Xem lại các tiêu chí sau trích xuất, chỉnh sửa giá trị kỳ vọng hoặc bổ sung tiêu chí mới trước khi lưu.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddCriterion}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>➕ Bổ sung tiêu chí</span>
              </button>
              <button
                type="button"
                disabled={saving || editableCriteria.length === 0}
                onClick={handleSaveAndApprove}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-900/20 disabled:opacity-50 flex items-center gap-1.5 transition-all cursor-pointer"
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

          {/* Danh sách các thẻ tiêu chí */}
          {editableCriteria.length === 0 ? (
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
                  onClick={handleAddCriterion}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  ➕ Thêm tiêu chí thủ công
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {editableCriteria.map((item, index) => {
                const summary = getCriterionSummary(item);
                const isExpanded = expandedIndex === index;
                return (
                  <div
                    key={`${item.id || index}-${index}`}
                    className={`border rounded-2xl transition-all p-4 shadow-xs space-y-3 ${
                      isExpanded
                        ? "bg-white border-slate-300 ring-2 ring-slate-200/60"
                        : "bg-white border-slate-200/90 hover:border-slate-300"
                    }`}
                  >
                    {/* HÀNG HEADER: #index + Tên tiêu chí + Badge loại + Tóm tắt + Chỉnh sửa/Thu gọn + Xóa */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 flex-1 min-w-64">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center border border-slate-200 flex-shrink-0">
                          {index + 1}
                        </span>
                        <input
                          value={item.name}
                          onChange={(e) => handleUpdateCriterion(index, { name: e.target.value })}
                          className="font-bold text-sm text-slate-900 bg-transparent hover:bg-slate-50 focus:bg-white px-2.5 py-1 rounded-lg border border-transparent hover:border-slate-200 focus:border-slate-300 focus:ring-1 focus:ring-slate-400 flex-1 transition-all"
                          placeholder="Tên tiêu chí (ví dụ: Căn lề trang, Khung đề mục, Chuẩn trích dẫn...)"
                        />
                        <RuleTypeBadge
                          ruleType={item.rule_type}
                          name={item.name}
                          expectedValue={item.expected_value}
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
                          onClick={() => setExpandedIndex(isExpanded ? null : index)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                            isExpanded
                              ? "bg-slate-800 text-white"
                              : "text-slate-700 bg-slate-100 hover:bg-slate-200"
                          }`}
                        >
                          {isExpanded ? "Thu gọn ▴" : "Chỉnh sửa ▾"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveCriterion(index)}
                          className="text-xs px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-800 rounded-lg font-bold transition-all cursor-pointer"
                          title="Xóa tiêu chí này"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* HIỂN THỊ KHI THU GỌN: Trích đoạn ngắn + Mô tả ngắn */}
                    {!isExpanded && (
                      <div className="pl-8 space-y-2">
                        {item.source_citation && (
                          <div className="bg-amber-50/70 border-l-3 border-amber-400 px-3 py-1.5 rounded-r-lg text-xs text-amber-950 flex items-start gap-2">
                            <span className="text-amber-500 font-serif text-sm leading-none mt-0.5 select-none">❝</span>
                            <div className="flex-1 leading-normal line-clamp-2">
                              <span className="font-semibold text-amber-800">Trích đoạn nguồn: </span>
                              <span className="italic">{item.source_citation}</span>
                            </div>
                          </div>
                        )}
                        {item.description && (
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                        {item.rule_type === "TEMPLATE" && Array.isArray(item.expected_value?.headings) && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="text-[11px] font-semibold text-slate-400">Các mục:</span>
                            {(item.expected_value.headings as string[]).slice(0, 6).map((heading, hIdx) => (
                              <span
                                key={hIdx}
                                className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 text-slate-800 px-2 py-0.5 rounded text-[11px] font-medium"
                              >
                                <span className="text-slate-400 font-mono text-[10px]">{hIdx + 1}.</span>
                                <span>{heading}</span>
                              </span>
                            ))}
                            {(item.expected_value.headings as string[]).length > 6 && (
                              <span className="text-[10px] text-slate-400 font-medium italic">
                                +{(item.expected_value.headings as string[]).length - 6} mục khác...
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* HIỂN THỊ KHI MỞ RỘNG: TUÂN THỦ TUYỆT ĐỐI THỨ TỰ: TRÍCH -> MÔ TẢ -> LOẠI QUY TẮC -> Ô SỬA NỘI DUNG */}
                    {isExpanded && (
                      <div className="pl-8 pt-3 border-t border-slate-200/80 space-y-4">
                        {/* 1. TRÍCH ĐOẠN NGUỒN */}
                        <div className="bg-amber-50/60 border border-amber-200/90 rounded-xl p-3.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                              <span className="text-amber-600 font-serif text-sm">❝</span>
                              <span>1. Trích dẫn quy chế nguồn:</span>
                            </label>
                            <span className="text-[11px] text-amber-800/80 font-medium">
                              Điều khoản hoặc hướng dẫn gốc từ tài liệu
                            </span>
                          </div>
                          <textarea
                            value={item.source_citation || ""}
                            onChange={(e) => handleUpdateCriterion(index, { source_citation: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs text-amber-950 italic focus:ring-2 focus:ring-amber-400 focus:outline-none transition-all leading-relaxed"
                            placeholder="Dán hoặc chỉnh sửa đoạn văn bản quy định trích từ tài liệu học phần..."
                          />
                        </div>

                        {/* 2. MÔ TẢ TIÊU CHÍ */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <span>📝</span>
                              <span>2. Mô tả tiêu chí đối chiếu:</span>
                            </label>
                            <span className="text-[11px] text-slate-400">Yêu cầu cụ thể để đối chiếu</span>
                          </div>
                          <input
                            value={item.description}
                            onChange={(e) => handleUpdateCriterion(index, { description: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-400 focus:outline-none transition-all"
                            placeholder="Mô tả điều cần đối chiếu (ví dụ: Khổ giấy A4 in 1 mặt, lề trái 3.0cm, lề phải 2.0cm...)"
                          />
                        </div>

                        {/* 3. LOẠI QUY TẮC */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span>⚙️</span>
                            <span>3. Loại quy tắc kiểm tra:</span>
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateCriterion(index, { rule_type: "MEASUREMENT" })}
                              className={`p-2.5 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                                item.rule_type === "MEASUREMENT"
                                  ? "bg-sky-50 border-sky-400 text-sky-950 font-bold ring-2 ring-sky-400/50 shadow-xs"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 text-xs font-bold">
                                <span>📏</span>
                                <span>Số đo (MEASUREMENT)</span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                                Lề trang, khổ giấy, cỡ chữ, phông, số trang
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleUpdateCriterion(index, { rule_type: "TEMPLATE" })}
                              className={`p-2.5 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                                item.rule_type === "TEMPLATE"
                                  ? "bg-purple-50 border-purple-400 text-purple-950 font-bold ring-2 ring-purple-400/50 shadow-xs"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 text-xs font-bold">
                                <span>📑</span>
                                <span>Khung đề mục (TEMPLATE)</span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                                Dàn ý các chương mục theo thứ tự phân cấp
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleUpdateCriterion(index, { rule_type: "PRESENCE" })}
                              className={`p-2.5 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                                item.rule_type === "PRESENCE"
                                  ? "bg-amber-50 border-amber-400 text-amber-950 font-bold ring-2 ring-amber-400/50 shadow-xs"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 text-xs font-bold">
                                <span>📚</span>
                                <span>Bảng &amp; Trích dẫn (PRESENCE)</span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                                Tài liệu tham khảo, bảng phân công, trang bìa
                              </p>
                            </button>
                          </div>
                        </div>

                        {/* 4. Ô SỬA NỘI DUNG (CẤU TRÚC TRỰC QUAN, DỄ SỬ DỤNG) */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <span>🎯</span>
                              <span>4. Ô sửa nội dung quy chuẩn:</span>
                            </label>
                            <span className="text-[11px] text-slate-500 font-medium">
                              Thiết kế có tính cấu trúc, trực quan, dễ sử dụng
                            </span>
                          </div>
                          <StructuredContentEditor
                            ruleType={item.rule_type}
                            expectedValue={item.expected_value}
                            name={item.name}
                            onChange={(val) => handleUpdateCriterion(index, { expected_value: val })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
                Các bài nộp của sinh viên có cấu trúc gần khớp hoặc cần giảng viên xác nhận trực tiếp.
              </p>
            </div>
          </div>

          {reviews.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Chưa có ca nào cần giảng viên xem xét.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((item) => (
                <article
                  key={item.id}
                  className={`p-4 border rounded-xl space-y-2 transition-all ${
                    item.status === "UNDER_REVIEW"
                      ? "border-amber-300 bg-amber-50/60"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{item.filename}</p>
                      <p className="text-xs text-slate-500">
                        Sinh viên: <b>{item.actor_id}</b> · Gửi lúc: {new Date(item.created_at).toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <ResultBadge status={item.status} />
                  </div>

                  <details className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                    <summary className="cursor-pointer font-semibold text-slate-800">
                      Xem cấu trúc trích xuất từ bài nộp &amp; điểm mơ hồ
                    </summary>
                    <pre className="whitespace-pre-wrap mt-2 p-2 bg-slate-50 rounded text-[11px] overflow-auto max-h-48">
                      {JSON.stringify({ snapshot: item.extracted_snapshot, ambiguous: item.ambiguous_results }, null, 2)}
                    </pre>
                  </details>

                  {item.status === "UNDER_REVIEW" ? (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => decideReview(item, "ACCEPTED")}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                      >
                        ✓ Chấp thuận hợp lệ
                      </button>
                      <button
                        type="button"
                        onClick={() => decideReview(item, "REQUIRES_FIX")}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                      >
                        ✕ Yêu cầu sinh viên sửa
                      </button>
                    </div>
                  ) : (
                    item.decision_reason && (
                      <p className="text-xs text-slate-700 bg-white p-2 rounded border border-slate-200">
                        <b>Phản hồi của giảng viên:</b> {item.decision_reason}
                      </p>
                    )
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ── 4. THỐNG KÊ LƯỢT KIỂM TRA ────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["Lượt kiểm tra", totals.total, "text-slate-800"],
            ["Đạt chuẩn", totals.pass, "text-emerald-700"],
            ["Cần sửa lại", totals.fix, "text-rose-700"],
            ["Cần xem xét", totals.unable, "text-amber-700"],
          ].map(([label, value, colorClass]) => (
            <div key={String(label)} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

export function FormatPrecheckPage({ role, catalog, selectedCourseId, onSelectCourse }: Props) {
  return role === "student" ? <StudentFormatCheck catalog={catalog} selectedCourseId={selectedCourseId} onSelectCourse={onSelectCourse} /> : <LecturerFormatCheck catalog={catalog} selectedCourseId={selectedCourseId} onSelectCourse={onSelectCourse} />;
}
