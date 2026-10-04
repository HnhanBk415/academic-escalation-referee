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
  return <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
    <div className="flex gap-3 items-start"><ResultBadge status={result.overall_status} /><div><h2 className="font-bold text-slate-900">Kết quả kiểm tra hình thức</h2><p className="text-sm text-slate-600 mt-1">{result.message}</p>{result.criteria_version && <p className="text-xs text-slate-500 mt-2">Bộ tiêu chí phiên bản {result.criteria_version}{result.criteria_approved_at ? ` · duyệt ${new Date(result.criteria_approved_at).toLocaleDateString("vi-VN")}` : ""}</p>}</div></div>
    {result.review_case_id && <p className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">Một điểm trình bày chưa thể kết luận tự động đã được gửi cho giảng viên xem xét.</p>}
    {result.results.length > 0 && <div className="space-y-3">{result.results.map((item) => <CriterionResult key={item.criterion_id} item={item} />)}</div>}
  </section>;
}

function LecturerFormatCheck({ catalog, selectedCourseId, onSelectCourse }: Omit<Props, "role">) {
  const [sets, setSets] = useState<FormatCriteriaSet[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [reviews, setReviews] = useState<FormatReviewCase[]>([]);
  const [metrics, setMetrics] = useState<FormatMetric[]>([]);
  const [title, setTitle] = useState("Bộ tiêu chí hình thức báo cáo");
  const [criterionName, setCriterionName] = useState("");
  const [criterionDescription, setCriterionDescription] = useState("");
  const [criterionCitation, setCriterionCitation] = useState("");
  const [ruleType, setRuleType] = useState<FormatRuleType>("MEASUREMENT");
  const [expectedJson, setExpectedJson] = useState('{"property":"page_count","operator":"max","value":20}');
  const [criteria, setCriteria] = useState<Array<{ name: string; description: string; rule_type: FormatRuleType; expected_value: Record<string, unknown>; source_citation?: string }>>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const active = useMemo(() => sets.find((item) => item.status === "ACTIVE"), [sets]);
  async function load() {
    try {
      const [criteriaData, docs, reviewData, metricData] = await Promise.all([
        api<FormatCriteriaSet[]>(`/api/v1/format-checks/criteria?course_id=${encodeURIComponent(selectedCourseId)}`),
        api<DocumentSummary[]>(`/api/v1/documents?course_id=${encodeURIComponent(selectedCourseId)}`),
        api<FormatReviewCase[]>(`/api/v1/format-checks/reviews?course_id=${encodeURIComponent(selectedCourseId)}&lecturer_id=lecturer-01`),
        api<FormatMetric[]>(`/api/v1/format-checks/metrics?course_id=${encodeURIComponent(selectedCourseId)}&lecturer_id=lecturer-01`),
      ]);
      setSets(criteriaData); setDocuments(docs); setReviews(reviewData); setMetrics(metricData);
    } catch (err) { setMessage(err instanceof Error ? err.message : "Không thể tải dữ liệu kiểm tra hình thức."); }
  }
  useEffect(() => { void load(); }, [selectedCourseId]);

  function addCriterion() {
    try {
      const expected_value = JSON.parse(expectedJson) as Record<string, unknown>;
      if (!criterionName.trim() || !criterionDescription.trim()) throw new Error("Nhập tên và mô tả tiêu chí.");
      setCriteria((old) => [...old, { name: criterionName.trim(), description: criterionDescription.trim(), rule_type: ruleType, expected_value, source_citation: criterionCitation.trim() || undefined }]);
      setCriterionName(""); setCriterionDescription(""); setCriterionCitation(""); setMessage("");
    } catch (err) { setMessage(err instanceof Error ? err.message : "Giá trị kỳ vọng phải là JSON hợp lệ."); }
  }
  async function createDraft() {
    if (!criteria.length) { setMessage("Thêm ít nhất một tiêu chí trước khi tạo bản nháp."); return; }
    try { await postJson("/api/v1/format-checks/criteria/drafts", { course_id: selectedCourseId, lecturer_id: "lecturer-01", title, criteria }); setCriteria([]); setMessage("Đã tạo bản nháp. Hãy xem khả năng tự động trước khi duyệt."); await load(); } catch (err) { setMessage(err instanceof Error ? err.message : "Không thể tạo bản nháp."); }
  }
  async function draftFromDocuments() {
    if (!selectedDocs.length) { setMessage("Chọn ít nhất một tài liệu nguồn."); return; }
    try { await postJson("/api/v1/format-checks/criteria/drafts/from-documents", { course_id: selectedCourseId, lecturer_id: "lecturer-01", title, document_ids: selectedDocs, include_template_structure: true }); setMessage("Đã trích bản nháp từ tài liệu. Hãy kiểm tra rồi duyệt."); await load(); } catch (err) { setMessage(err instanceof Error ? err.message : "Không thể trích nháp."); }
  }
  async function approve(item: FormatCriteriaSet) { try { await postJson(`/api/v1/format-checks/criteria/${item.id}/approve?lecturer_id=lecturer-01`, {}); setMessage(`Đã duyệt phiên bản ${item.version}.`); await load(); } catch (err) { setMessage(err instanceof Error ? err.message : "Không thể duyệt."); } }
  async function decideReview(item: FormatReviewCase, decision: "ACCEPTED" | "REQUIRES_FIX") { const reason = window.prompt(decision === "ACCEPTED" ? "Lý do chấp thuận:" : "Yêu cầu sinh viên sửa:"); if (!reason) return; try { await postJson(`/api/v1/format-checks/reviews/${item.id}/decision`, { reviewer_id: "lecturer-01", decision, reason }); await load(); } catch (err) { setMessage(err instanceof Error ? err.message : "Không thể ghi quyết định."); } }
  const totals = metrics.reduce((sum, item) => ({ total: sum.total + item.total_checks, pass: sum.pass + item.passed_checks, fix: sum.fix + item.needs_fix_checks, unable: sum.unable + item.unable_to_check_checks }), { total: 0, pass: 0, fix: 0, unable: 0 });

  return <div className="flex-1 overflow-y-auto bg-slate-50 p-8"><div className="max-w-5xl mx-auto space-y-6">
    <header className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-bold tracking-wider text-red-700 uppercase">Giảng viên phụ trách</p><h1 className="text-2xl font-bold text-slate-900 mt-1">Bộ tiêu chí kiểm tra hình thức</h1><p className="text-sm text-slate-500 mt-2">Mỗi học phần chỉ có một phiên bản đang áp dụng; chỉnh sửa luôn bắt đầu bằng bản nháp mới.</p></div><CriteriaSelect catalog={catalog} courseId={selectedCourseId} onChange={onSelectCourse} /></header>
    {message && <p className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-sm text-sky-800">{message}</p>}
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["Lượt kiểm tra", totals.total], ["Đạt", totals.pass], ["Cần sửa", totals.fix], ["Chưa kết luận", totals.unable]].map(([label, value]) => <div key={String(label)} className="bg-white border border-slate-200 rounded-xl p-4"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-800 mt-1">{value}</p></div>)}</section>
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"><div><h2 className="font-bold text-slate-900">Tạo bản nháp tiêu chí</h2><p className="text-xs text-slate-500 mt-1">Không có danh mục mặc định: nhập đúng quy định của học phần hoặc trích nháp từ tài liệu hiện có.</p></div><input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" placeholder="Tên bộ tiêu chí" />
      <div className="grid md:grid-cols-2 gap-3"><input value={criterionName} onChange={(event) => setCriterionName(event.target.value)} className="p-2 border border-slate-300 rounded-lg text-sm" placeholder="Tên tiêu chí" /><select value={ruleType} onChange={(event) => setRuleType(event.target.value as FormatRuleType)} className="p-2 border border-slate-300 rounded-lg text-sm"><option value="MEASUREMENT">Số đo</option><option value="PRESENCE">Hiện diện/cấu trúc</option><option value="TEMPLATE">Theo mẫu đề mục</option></select></div>
      <textarea value={criterionDescription} onChange={(event) => setCriterionDescription(event.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" rows={2} placeholder="Mô tả điều cần đối chiếu" /><textarea value={criterionCitation} onChange={(event) => setCriterionCitation(event.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" rows={2} placeholder="Trích dẫn điều khoản nguồn (tuỳ chọn)" /><textarea value={expectedJson} onChange={(event) => setExpectedJson(event.target.value)} className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs" rows={3} aria-label="Giá trị kỳ vọng JSON" />
      <div className="flex gap-2"><button type="button" onClick={addCriterion} className="px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg">Thêm tiêu chí</button><button type="button" onClick={createDraft} className="px-3 py-2 text-sm font-bold text-white bg-red-700 rounded-lg">Tạo bản nháp ({criteria.length})</button></div>
      {criteria.length > 0 && <ul className="text-xs space-y-1">{criteria.map((item, index) => <li key={`${item.name}-${index}`} className="flex justify-between p-2 bg-slate-50 rounded"><span>{item.name} · {item.rule_type}</span><button type="button" className="text-rose-700" onClick={() => setCriteria((old) => old.filter((_, i) => i !== index))}>Bỏ</button></li>)}</ul>}
      <div className="border-t pt-4"><p className="text-sm font-semibold text-slate-700">Hoặc trích nháp từ tài liệu đã ingest</p><div className="mt-2 flex flex-wrap gap-2">{documents.map((doc) => <label key={doc.id} className="text-xs p-2 border rounded cursor-pointer"><input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={() => setSelectedDocs((old) => old.includes(doc.id) ? old.filter((id) => id !== doc.id) : [...old, doc.id])} /> {doc.title}</label>)}</div><button type="button" onClick={draftFromDocuments} className="mt-3 px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg">Trích nháp (kèm khung mẫu nếu có)</button></div>
    </section>
    <section className="bg-white border border-slate-200 rounded-2xl p-5"><h2 className="font-bold text-slate-900 mb-3">Phiên bản tiêu chí</h2>{sets.length === 0 ? <p className="text-sm text-slate-500">Chưa có bộ tiêu chí.</p> : <div className="space-y-3">{sets.map((item) => <article key={item.id} className="border border-slate-200 rounded-xl p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold">v{item.version} · {item.title}</p><p className="text-xs text-slate-500 mt-1">{item.criteria.length} tiêu chí · {item.criteria.filter((criterion) => criterion.automatable && !criterion.review_only).length} tự động</p></div><div className="text-right"><ResultBadge status={item.status === "ACTIVE" ? "PASS" : item.status} />{item.status === "DRAFT" && <button type="button" onClick={() => approve(item)} className="block mt-2 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded">Duyệt áp dụng</button>}</div></div><ul className="mt-3 text-xs text-slate-600 space-y-1">{item.criteria.map((criterion) => <li key={criterion.id}>• {criterion.name} — {criterion.automatable && !criterion.review_only ? "tự động" : "GV tự xem"}</li>)}</ul></article>)}</div>}</section>
    <section className="bg-white border border-slate-200 rounded-2xl p-5"><h2 className="font-bold text-slate-900 mb-3">Ca cần người phán đoán</h2>{reviews.filter((item) => item.status === "UNDER_REVIEW").length === 0 ? <p className="text-sm text-slate-500">Không có ca nào đang chờ.</p> : <div className="space-y-3">{reviews.filter((item) => item.status === "UNDER_REVIEW").map((item) => <article key={item.id} className="p-4 border border-amber-200 bg-amber-50 rounded-xl"><div className="flex justify-between gap-3"><div><p className="font-semibold text-slate-800">{item.filename}</p><p className="text-xs text-slate-600">Sinh viên: {item.actor_id} · hết hạn lưu {new Date(item.expires_at).toLocaleDateString("vi-VN")}</p></div><ResultBadge status={item.status} /></div><details className="mt-2 text-xs"><summary className="cursor-pointer">Xem cấu trúc trích xuất và phần mơ hồ</summary><pre className="whitespace-pre-wrap mt-2 p-2 bg-white rounded overflow-auto">{JSON.stringify({ snapshot: item.extracted_snapshot, ambiguous: item.ambiguous_results }, null, 2)}</pre></details><div className="mt-3 flex gap-2"><button type="button" onClick={() => decideReview(item, "ACCEPTED")} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded">Chấp thuận</button><button type="button" onClick={() => decideReview(item, "REQUIRES_FIX")} className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded">Yêu cầu sửa</button></div></article>)}</div>}</section>
  </div></div>;
}

export function FormatPrecheckPage({ role, catalog, selectedCourseId, onSelectCourse }: Props) {
  return role === "student" ? <StudentFormatCheck catalog={catalog} selectedCourseId={selectedCourseId} onSelectCourse={onSelectCourse} /> : <LecturerFormatCheck catalog={catalog} selectedCourseId={selectedCourseId} onSelectCourse={onSelectCourse} />;
}
