import React, { FormEvent, useState } from "react";
import { postJson } from "../api/client";
import {
  IconBookOpen,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconMessageSquare,
  IconScale,
  IconSparkle,
  IconWarning,
} from "../components/Icons";
import { StatusBadge, type CaseStatus } from "../components/StatusBadge";
import { Stepper } from "../components/Stepper";
import type { QuestionResponse } from "../types";

interface StudentSubmitViewProps {
  actorId?: string;
  defaultCourseId?: string;
  onSubmitted?: (questionId: string) => void;
  onViewHistory?: (questionId: string) => void;
}

const QUICK_PROMPTS = {
  "DADN-HK242": [
    "Tỷ lệ điểm giữa kỳ, quá trình, báo cáo tổng kết và demo là bao nhiêu?",
    "Yêu cầu nộp mô tả tổng quan đề tài là gì?",
    "Nhóm em xin phép có 6 thành viên được không?",
  ],
  CO3001: [
    "Một nhóm đồ án được có bao nhiêu thành viên?",
    "Rubric chấm điểm báo cáo và sản phẩm như thế nào?",
    "Nhóm em xin phép có 6 thành viên được không?",
  ],
};

export function StudentSubmitView({
  actorId = "student-dadn-a1",
  defaultCourseId = "DADN-HK242",
  onSubmitted,
  onViewHistory,
}: StudentSubmitViewProps) {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState(defaultCourseId);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastSubmittedQuestion, setLastSubmittedQuestion] = useState("");
  const [lastSubmittedTopic, setLastSubmittedTopic] = useState(defaultCourseId);
  const [result, setResult] = useState<QuestionResponse | null>(null);

  const courseId = topic.includes("CO3001") ? "CO3001" : "DADN-HK242";
  const prompts =
    QUICK_PROMPTS[courseId as keyof typeof QUICK_PROMPTS] || QUICK_PROMPTS["DADN-HK242"];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) {
      setError("Vui lòng nhập nội dung câu hỏi chi tiết.");
      return;
    }
    setBusy(true);
    setError("");

    const fullQuestion = subject.trim() ? `${subject.trim()}: ${body.trim()}` : body.trim();
    setLastSubmittedQuestion(fullQuestion);
    setLastSubmittedTopic(topic);

    const effectiveCourseId = topic.includes("CO3001") ? "CO3001" : "DADN-HK242";
    const effectiveActorId = effectiveCourseId === "CO3001" ? "student-a1" : actorId;

    try {
      const res = await postJson<QuestionResponse>("/api/questions", {
        actor_id: effectiveActorId,
        course_id: effectiveCourseId,
        text: fullQuestion,
      });

      setResult(res);

      // Notify parent to refresh counts without switching tab
      if (onSubmitted && res.question_id) {
        onSubmitted(res.question_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi câu hỏi. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    setSubject("");
    setBody("");
    setError("");
  }

  function handleNewQuestion() {
    setSubject("");
    setBody("");
    setError("");
    setResult(null);
    setLastSubmittedQuestion("");
  }

  function handlePickPrompt(text: string) {
    setBody(text);
    if (!subject) {
      setSubject(text.slice(0, 45) + (text.length > 45 ? "..." : ""));
    }
  }

  // Derive status for display
  let displayStatus: CaseStatus = "auto_replied";
  if (result) {
    if (result.final_decision) {
      displayStatus = "approved";
    } else if (result.route === "ESCALATE" || result.status === "ESCALATED") {
      displayStatus = "pending_lecturer";
    } else if (result.route === "CLARIFY" || result.status === "CLARIFICATION_REQUIRED") {
      displayStatus = "clarify";
    } else {
      displayStatus = "auto_replied";
    }
  }

  const caseDisplayId = result
    ? result.case_id || result.question_id.replace(/^q_/, "CASE_").slice(0, 9).toUpperCase()
    : "";

  const cleanDate = result?.created_at
    ? new Date(result.created_at).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  const displayTopic =
    lastSubmittedTopic.includes("CO3001") || result?.course_id === "CO3001"
      ? "CO3001 · Đồ án chuyên ngành"
      : "Đồ án Đa ngành (DADN-HK242)";

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-y-auto">
      {/* Header */}
      <div className="px-8 pt-7 pb-5 border-b border-slate-200 bg-white flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Gửi câu hỏi mới</h1>
          <p className="text-sm text-slate-500 mt-1">
            Câu hỏi sẽ được AI Referee đối soát quy chế tức thì, hiển thị kết quả phân luồng ngay bên phải
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-medium text-slate-600 font-mono">Referee Engine · Real-time</span>
        </div>
      </div>

      {/* Main 2-Column Responsive Workspace */}
      <div className="p-6 lg:p-8 max-w-[1520px] w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
          {/* ── LEFT COLUMN: Input Form (~42% / 5 cols) ── */}
          <div className="lg:col-span-5 space-y-5">
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
                {error}
              </div>
            )}

            {/* AI Referee Note Banner */}
            <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-xl flex items-start gap-3 shadow-xs">
              <div className="text-sky-600 mt-0.5 flex-shrink-0">
                <IconSparkle size={16} />
              </div>
              <p className="text-xs text-sky-900 leading-relaxed font-medium">
                AI Referee sẽ đối chiếu câu hỏi với cơ sở dữ liệu quy chế môn học và phản hồi tức thì.
                Trường hợp xin ngoại lệ hoặc vượt thẩm quyền sẽ tự động chuyển tiếp Giảng viên.
              </p>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4"
            >
              {/* Question Subject */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">
                  Tiêu đề câu hỏi
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="VD: Quy định về số lượng thành viên nhóm đồ án..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]/20 transition-all"
                />
              </div>

              {/* Course Selector */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">
                  Phân nhóm môn học
                </label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]/20 transition-all cursor-pointer"
                >
                  <option value="DADN-HK242">Đồ án Đa ngành (DADN-HK242)</option>
                  <option value="CO3001">Đồ án chuyên ngành (CO3001)</option>
                  <option value="Luận văn Thạc sĩ">Luận văn Thạc sĩ</option>
                  <option value="Luận văn Tốt nghiệp">Luận văn Tốt nghiệp</option>
                  <option value="Chương trình Quốc tế">Chương trình Quốc tế</option>
                  <option value="Bảo lưu học tập">Bảo lưu học tập</option>
                </select>
              </div>

              {/* Quick Prompt Chips */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">
                  Gợi ý câu hỏi nhanh
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {prompts.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handlePickPrompt(p)}
                      className="text-[11px] text-left px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md border border-slate-200 transition-colors"
                    >
                      {p.length > 36 ? p.slice(0, 36) + "…" : p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Body */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">
                  Nội dung chi tiết <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Mô tả cụ thể thắc mắc của bạn về quy chế, số lượng thành viên, tỷ lệ điểm hoặc yêu cầu đặc biệt..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]/20 resize-none transition-all leading-relaxed"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 sm:flex-initial px-6 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Đang đối soát…</span>
                    </>
                  ) : (
                    <>
                      <span>Gửi câu hỏi</span>
                      <IconChevronRight size={14} />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={busy}
                  className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition-all"
                >
                  Huỷ
                </button>
              </div>
            </form>
          </div>

          {/* ── RIGHT COLUMN: Live Result Panel (~58% / 7 cols) ── */}
          <div className="lg:col-span-7 space-y-4">
            {/* Header Box of Result Panel */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col min-h-[580px]">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-red-50 text-[#DC2626] flex items-center justify-center">
                    <IconScale size={15} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                      Kết quả đối soát quy chế học vụ
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Hiển thị tiến trình & phân luồng thẩm định tương tự Câu hỏi của tôi
                    </p>
                  </div>
                </div>

                {result && <StatusBadge status={displayStatus} />}
              </div>

              {/* Panel Content Area */}
              <div className="p-6 flex-1 flex flex-col">
                {/* 1. LOADING STATE */}
                {busy && (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full border-4 border-slate-200 border-t-[#DC2626] animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-[#DC2626]">
                        <IconSparkle size={18} />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        Đang đối soát quy chế học vụ...
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm">
                        Hệ thống đang truy xuất các điều khoản quy định liên quan và phân luồng thẩm định.
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. INITIAL EMPTY STATE */}
                {!busy && !result && (
                  <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
                      <IconMessageSquare size={28} />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">Chưa có kết quả đối soát</h3>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-md leading-relaxed">
                      Nhập câu hỏi ở khung bên trái và bấm{" "}
                      <strong className="text-slate-700">"Gửi câu hỏi"</strong>. AI Referee sẽ tra
                      cứu quy chế và hiển thị đầy đủ Stepper tiến trình, mã Case, trích dẫn quy chế ngay tại đây.
                    </p>

                    {/* Explanatory Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full max-w-lg text-left">
                      <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-lg">
                        <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold mb-1">
                          <IconCheck size={14} />
                          <span>Trả lời tự động tức thì</span>
                        </div>
                        <p className="text-[11px] text-emerald-700 leading-relaxed">
                          Với câu hỏi thường quy (tỷ lệ điểm, số lượng thành viên chuẩn...), AI trích dẫn văn bản và trả lời ngay.
                        </p>
                      </div>

                      <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-lg">
                        <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold mb-1">
                          <IconWarning size={14} />
                          <span>Chuyển tiếp Giảng viên</span>
                        </div>
                        <p className="text-[11px] text-amber-700 leading-relaxed">
                          Với câu hỏi xin ngoại lệ hoặc vượt quyền, hệ thống tự động mở ca chuyển tiếp lên Giảng viên phụ trách.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. RESULT STATE: Exactly like "Câu hỏi của tôi" */}
                {!busy && result && (
                  <div className="space-y-6 flex-1">
                    {/* Stepper (Flow trạng thái) */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
                      <Stepper status={displayStatus} />
                    </div>

                    {/* 4 Metadata Cards (2x2 Grid) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">
                          Mã Case
                        </p>
                        <p className="text-sm font-mono font-bold text-slate-800">
                          #{caseDisplayId}
                        </p>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">
                          Nhóm
                        </p>
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {displayTopic}
                        </p>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">
                          Thời gian gửi
                        </p>
                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                          <IconClock size={13} className="text-slate-400" />
                          <span>{cleanDate}</span>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">
                          Trạng thái phân luồng
                        </p>
                        <p className="text-sm font-medium text-slate-800">
                          {displayStatus === "auto_replied"
                            ? "AI Xử lý · Hoàn tất"
                            : displayStatus === "pending_lecturer"
                            ? "Chuyển tiếp · Chờ thẩm định"
                            : displayStatus === "approved"
                            ? "Giảng viên phê duyệt"
                            : "Yêu cầu làm rõ"}
                        </p>
                      </div>
                    </div>

                    {/* Student Question Box */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                        Nội dung câu hỏi của sinh viên
                      </h3>
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                        <p className="text-sm text-slate-800 leading-relaxed font-normal">
                          {lastSubmittedQuestion || result.text}
                        </p>
                      </div>
                    </div>

                    {/* Processing Status Box */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                        Trạng thái xử lý
                      </h3>

                      {/* Case 1: AI Auto Replied */}
                      {result.route === "ANSWER" && result.answer && (
                        <div className="p-5 rounded-xl bg-emerald-50/70 border border-emerald-200 shadow-xs space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-emerald-600 flex-shrink-0">
                              <IconCheck size={18} />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1.5">
                                AI Phản hồi tự động
                              </p>
                              <p className="text-sm text-emerald-950 leading-relaxed font-medium whitespace-pre-line">
                                {result.answer}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Case 2: Pending Lecturer Escalate */}
                      {result.route === "ESCALATE" && (
                        <div className="p-5 rounded-xl bg-amber-50/70 border border-amber-200 shadow-xs space-y-2">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-amber-600 flex-shrink-0">
                              <IconWarning size={18} />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">
                                Đã chuyển tiếp lên Giảng viên
                              </p>
                              <p className="text-sm text-amber-950 leading-relaxed">
                                Câu hỏi có tính chất xin ngoại lệ quy chế môn học hoặc vượt thẩm quyền tự quyết của AI.
                                Hồ sơ đã được đưa vào hàng đợi thẩm định của Giảng viên phụ trách môn học.
                              </p>
                              <div className="mt-2.5 flex items-center gap-2 font-mono text-[11px] text-amber-800 font-semibold">
                                <span>Lý do phân luồng:</span>
                                <span className="px-2 py-0.5 bg-amber-100 rounded text-amber-900 border border-amber-300/60">
                                  {result.reason_code || "EXCEPTION_REQUIRES_AUTHORITY"}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-amber-700 font-medium">
                                ⏱️ Thời gian phản hồi dự kiến: Trong vòng 48 giờ làm việc.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Case 3: Clarify */}
                      {result.route === "CLARIFY" && result.clarifying_question && (
                        <div className="p-5 rounded-xl bg-sky-50/70 border border-sky-200 shadow-xs space-y-2">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-sky-600 flex-shrink-0">
                              <IconSparkle size={18} />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-sky-800 uppercase tracking-wider mb-1">
                                Cần bổ sung thông tin để phán quyết
                              </p>
                              <p className="text-sm text-slate-800 leading-relaxed">
                                {result.clarifying_question}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Citations Section */}
                    {result.citations && result.citations.length > 0 && (
                      <div className="space-y-2.5 pt-2">
                        <div className="flex items-center gap-2">
                          <IconBookOpen size={14} className="text-slate-500" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Căn cứ quy chế đối chiếu ({result.citations.length})
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {result.citations.map((c, i) => (
                            <div
                              key={i}
                              className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1 shadow-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-red-100 text-[#DC2626] font-mono font-bold text-[10px] rounded">
                                  {c.label}
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {c.document_title}
                                </span>
                                {c.heading && (
                                  <span className="text-slate-400 font-normal">· {c.heading}</span>
                                )}
                              </div>
                              {c.quote && (
                                <p className="text-slate-600 italic text-[11px] leading-relaxed pl-1 pt-0.5 border-l-2 border-slate-300 ml-1">
                                  "{c.quote}"
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Next Action Buttons */}
                    <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleNewQuestion}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                      >
                        + Đặt câu hỏi khác
                      </button>

                      {onViewHistory && (
                        <button
                          type="button"
                          onClick={() => onViewHistory(result.question_id)}
                          className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                        >
                          <span>Xem trong Câu hỏi của tôi</span>
                          <IconChevronRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
