import React, { FormEvent, useState } from "react";
import { api, getLastRequestId, postJson } from "../api/client";
import {
  IconArrowUpRight,
  IconBookOpen,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconInfo,
  IconRotateCcw,
  IconScale,
  IconSearch,
  IconShield,
  IconSparkle,
  IconTeacher,
  IconThumbDown,
  IconThumbUp,
  IconUser,
  IconWarning,
  IconX,
} from "../components/Icons";
import { StudentWorkflowTracker } from "../components/StudentWorkflowTracker";
import type { Citation, DemoCatalog, QuestionResponse } from "../types";

interface StudentSubmitViewProps {
  catalog: DemoCatalog | null;
  selectedCourseId: string;
  selectedGroupId: string;
  onSelectCourse: (courseId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onSubmitted?: (questionId: string) => void;
  onViewHistory?: (questionId: string) => void;
}

export interface ClarificationTurnItem {
  round: number;
  questionText: string;
  clarifyingQuestion?: string | null;
  studentResponse?: string;
  route?: string;
}

const QUICK_CHIPS = [
  {
    label: "Hạn định hủy môn học",
    prompt:
      "Hạn chót để sinh viên được phép xin hủy môn học mà không bị ghi điểm F là khi nào?",
  },
  {
    label: "Cộng điểm rèn luyện",
    prompt:
      "Quy định về việc cộng điểm rèn luyện khi tham gia hoạt động nghiên cứu khoa học và đồ án môn học như thế nào?",
  },
  {
    label: "Đăng ký nhóm ngoại lệ",
    prompt:
      "Nhóm em có nguyện vọng đăng ký 6 thành viên cho đồ án môn học có được phê duyệt không?",
  },
  {
    label: "Quy định số lượng thành viên",
    prompt: "Một nhóm đồ án được có bao nhiêu thành viên theo quy chế chuẩn?",
  },
  {
    label: "Tỷ lệ điểm đồ án",
    prompt: "Tỷ lệ điểm giữa kỳ, quá trình, báo cáo tổng kết và demo là bao nhiêu?",
  },
];

export function StudentSubmitView({
  catalog,
  selectedCourseId,
  selectedGroupId,
  onSelectCourse,
  onSelectGroup,
  onSubmitted,
  onViewHistory,
}: StudentSubmitViewProps) {
  const [query, setQuery] = useState(QUICK_CHIPS[0].prompt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QuestionResponse | null>(null);
  const [clarificationText, setClarificationText] = useState("");
  const [clarifyingBusy, setClarifyingBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [conversationTurns, setConversationTurns] = useState<ClarificationTurnItem[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  // Time tracking
  const [submitTime, setSubmitTime] = useState("");
  const [processTime, setProcessTime] = useState("");

  const selectedCourse = catalog?.courses.find((c) => c.id === selectedCourseId);
  const availableGroups = selectedCourse?.groups ?? [];
  const selectedGroup = availableGroups.find((g) => g.id === selectedGroupId);

  function handleQueryChange(newQuery: string) {
    setQuery(newQuery);
    if (result) {
      setResult(null);
      setConversationTurns([]);
      setSubmitTime("");
      setProcessTime("");
      setFeedback(null);
      setSelectedCitation(null);
    }
  }

  async function handleSubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!selectedCourseId || !selectedGroupId) {
      setError("Vui lòng chọn môn học và nhóm môn học trước khi gửi thắc mắc.");
      return;
    }
    if (!query.trim()) {
      setError("Vui lòng nhập nội dung thắc mắc quy chế.");
      return;
    }

    // Reset previous workflow state when re-asking
    setResult(null);
    setConversationTurns([]);
    setProcessTime("");
    setFeedback(null);
    setSelectedCitation(null);
    setBusy(true);
    setError("");

    const now = new Date();
    const formattedSubmit = now.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setSubmitTime(formattedSubmit);

    try {
      const res = await postJson<QuestionResponse>("/api/v1/questions", {
        course_id: selectedCourseId,
        group_id: selectedGroupId,
        text: query.trim(),
      });

      const nowFinish = new Date();
      setProcessTime(
        nowFinish.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      );
      setCurrentRequestId(getLastRequestId());
      setResult(res);

      if (res.route === "CLARIFY") {
        setConversationTurns([
          {
            round: res.clarification_round || 0,
            questionText: query.trim(),
            clarifyingQuestion: res.clarifying_question,
            route: res.route,
          },
        ]);
      } else {
        setConversationTurns([]);
      }

      if (onSubmitted && res.question_id) {
        onSubmitted(res.question_id);
      }
    } catch (err) {
      setCurrentRequestId(getLastRequestId());
      setError(
        err instanceof Error ? err.message : "Không thể gửi câu hỏi. Vui lòng thử lại."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSendClarification(e: FormEvent) {
    e.preventDefault();
    if (!result || !clarificationText.trim()) return;

    setClarifyingBusy(true);
    setError("");
    try {
      const res = await postJson<QuestionResponse>(
        `/api/v1/questions/${result.question_id}/clarifications`,
        {
          text: clarificationText.trim(),
          group_id: selectedGroupId || result.group_id || undefined,
        }
      );
      setCurrentRequestId(getLastRequestId());

      // Update the thread with the student's reply and next round
      setConversationTurns((prev) => {
        const lastIdx = prev.length - 1;
        const updated = [...prev];
        if (lastIdx >= 0) {
          updated[lastIdx] = {
            ...updated[lastIdx],
            studentResponse: clarificationText.trim(),
          };
        }
        if (res.route === "CLARIFY") {
          updated.push({
            round: res.clarification_round || updated.length,
            questionText: res.text || "",
            clarifyingQuestion: res.clarifying_question,
            route: res.route,
          });
        }
        return updated;
      });

      setResult(res);
      setClarificationText("");
    } catch (err) {
      setCurrentRequestId(getLastRequestId());
      setError(err instanceof Error ? err.message : "Không thể gửi phản hồi bổ sung.");
    } finally {
      setClarifyingBusy(false);
    }
  }

  async function handleRefreshQuestion() {
    if (!result?.question_id) return;
    setRefreshing(true);
    setError("");
    try {
      const updated = await api<QuestionResponse>(`/api/v1/questions/${result.question_id}`);
      setCurrentRequestId(getLastRequestId());
      setResult(updated);
    } catch (err) {
      setCurrentRequestId(getLastRequestId());
      setError(err instanceof Error ? err.message : "Không thể làm mới kết quả.");
    } finally {
      setRefreshing(false);
    }
  }


  function handleEscalateManually() {
    const courseCode = selectedCourse?.code || "môn học";
    setQuery(
      `Nhóm em có nguyện vọng xin đăng ký ngoại lệ 6 thành viên cho đồ án môn học ${courseCode}`
    );
    setTimeout(() => {
      void handleSubmit();
    }, 50);
  }

  function handleNewQuestion() {
    setQuery("");
    setResult(null);
    setError("");
    setSelectedCitation(null);
    setFeedback(null);
    setSubmitTime("");
    setProcessTime("");
  }

  // Format bold highlight for answer text
  const renderFormattedAnswer = (text: string) => {
    const parts = text.split(
      /(hạn chót hủy môn không ghi điểm F là trước 17:00 ngày thứ Sáu của Tuần học thứ 6|3 đến 5 sinh viên|tối đa hai ngày|10%|40%|30%|20%|phải có lý do bất khả kháng và chuyển Giảng viên phê duyệt)/gi
    );

    return (
      <span className="leading-relaxed">
        {parts.map((part, idx) => {
          const isHighlight =
            /hạn chót|17:00|thứ Sáu|Tuần học thứ 6|3 đến 5|bất khả kháng|Giảng viên phê duyệt/i.test(
              part
            );
          return isHighlight ? (
            <strong key={idx} className="text-[#DC2626] font-bold bg-red-50/80 px-1 py-0.5 rounded">
              {part}
            </strong>
          ) : (
            part
          );
        })}
      </span>
    );
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[#F8FAFC]">
      {/* ── TOP NAV BAR ── */}
      <div className="px-6 lg:px-10 py-5 border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#DC2626]">
            <span>HỆ THỐNG PHÂN GIẢI & TRANH CHẤP HỌC VỤ</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-semibold lowercase">Tự động hóa học vụ</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Hỏi đáp quy chế học vụ
          </h1>
        </div>

        {/* Right Context Profile Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full transition-all shadow-xs">
            <div className="w-6 h-6 rounded-full bg-[#DC2626] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <IconUser size={13} />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-slate-800">Chế độ demo</span>
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-slate-700">
                {selectedCourse ? `${selectedCourse.code} · ${selectedCourse.name}` : "Môn học"}
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-slate-700">
                {selectedGroup?.name || "Chưa chọn nhóm"}
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-medium text-slate-500">
                GV: {catalog?.lecturer.display_name || "TS. Trần Minh Tuấn"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT CONTAINER (CENTERED SINGLE-COLUMN WORKSPACE) ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium flex items-center gap-2 shadow-xs">
            <IconWarning size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* ── CARD 0: CHỌN MÔN HỌC VÀ NHÓM (MATCHING USER UI MOCKUP) ── */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Môn học yêu cầu */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <IconBookOpen size={15} className="text-slate-500" />
                  <span>Môn học yêu cầu</span>
                </label>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Đang mở tiếp nhận
                </span>
              </div>
              <div className="relative">
                <select
                  value={selectedCourseId}
                  onChange={(e) => {
                    onSelectCourse(e.target.value);
                    setResult(null);
                    setError("");
                    setSubmitTime("");
                    setProcessTime("");
                  }}
                  className="w-full appearance-none px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition-all shadow-xs pr-10 cursor-pointer"
                >
                  {catalog?.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code} - {course.name} ({course.semester})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <IconChevronRight size={14} className="rotate-90" />
                </div>
              </div>
            </div>

            {/* Right: Lớp / Nhóm môn học */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <IconUser size={15} className="text-slate-500" />
                  <span>Lớp / Nhóm môn học</span>
                </label>
                <span className="text-xs font-medium text-slate-600">
                  GV: {catalog?.lecturer.display_name || "TS. Trần Minh Tuấn"}
                </span>
              </div>
              <div className="relative">
                <select
                  value={selectedGroupId}
                  onChange={(e) => {
                    onSelectGroup(e.target.value);
                    setResult(null);
                    setConversationTurns([]);
                    setError("");
                    setSubmitTime("");
                    setProcessTime("");
                  }}
                  className="w-full appearance-none px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition-all shadow-xs pr-10 cursor-pointer"
                >
                  <option value="">-- Chọn nhóm môn học --</option>
                  {availableGroups.length > 0 ? (
                    availableGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.id})
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>Chưa có nhóm nào</option>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <IconChevronRight size={14} className="rotate-90" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CARD 1: NỘI DUNG THẮC MẮC QUY CHẾ (INPUT CARD) ── */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
              <div className="text-red-600">
                <IconBookOpen size={16} />
              </div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Nội dung thắc mắc quy chế
              </h2>
            </div>
            {selectedCourse && (
              <div className="text-xs text-slate-500 font-medium">
                {selectedCourse.code} · {selectedCourse.semester}
              </div>
            )}
          </div>

          {/* Search Input Row with Crimson Button */}
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <IconSearch size={18} />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Nhập thắc mắc về quy định, số lượng nhóm, tỷ lệ điểm hoặc xin ngoại lệ..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition-all font-normal shadow-xs"
              />
            </div>

            <button
              type="submit"
              disabled={busy || !query.trim()}
              className="px-6 py-3 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 flex-shrink-0 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Đang tra cứu…</span>
                </>
              ) : (
                <>
                  <IconBookOpen size={15} />
                  <span>Tra cứu quy chế</span>
                </>
              )}
            </button>
          </form>

          {/* Quick suggestions chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
              <IconSparkle size={13} />
              Gợi ý nhanh:
            </span>
            {QUICK_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQueryChange(chip.prompt)}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 rounded-lg text-xs font-medium text-slate-600 transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── CARD 2: WORKFLOW TIẾN TRÌNH ── */}
        <StudentWorkflowTracker
          busy={busy}
          result={result}
          submitTime={submitTime}
          processTime={processTime}
        />

        {/* ── CARD 3: KẾT QUẢ ĐỐI SOÁT & TRÍCH LỤC QUY CHẾ ── */}
        {result && (
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden transition-all">
            {/* Top Ribbon Alert */}
            <div
              className={`border-b px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 ${
                result.route === "REJECT"
                  ? "bg-rose-50 border-rose-200 text-rose-900"
                  : result.route === "OUT_OF_SCOPE"
                  ? "bg-purple-50 border-purple-200 text-purple-900"
                  : result.applied_exception_id
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-gradient-to-r from-red-50/90 via-rose-50/70 to-orange-50/50 border-red-100 text-red-900"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    result.route === "REJECT"
                      ? "bg-rose-100 text-rose-600"
                      : result.route === "OUT_OF_SCOPE"
                      ? "bg-purple-100 text-purple-600"
                      : result.applied_exception_id
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-[#DC2626]"
                  }`}
                >
                  {result.route === "REJECT" ? (
                    <IconX size={12} />
                  ) : result.route === "OUT_OF_SCOPE" ? (
                    <IconInfo size={12} />
                  ) : (
                    <IconCheck size={12} />
                  )}
                </span>
                <span>
                  {result.applied_exception_id
                    ? "ĐÃ ÁP DỤNG NGOẠI LỆ • Phê duyệt tự động dựa trên ngoại lệ của Giảng viên"
                    : result.route === "ANSWER"
                    ? "ĐÃ ĐỐI CHIẾU THÀNH CÔNG • Trực tiếp từ quy chế hiện hành (AI Trả lời tự động)"
                    : result.route === "OUT_OF_SCOPE"
                    ? "NGOÀI PHẠM VI XỬ LÝ • Không thuộc thẩm quyền giải quyết của môn học"
                    : result.route === "REJECT"
                    ? "YÊU CẦU BỊ TỪ CHỐI • Không tạo hồ sơ chuyển giảng viên"
                    : result.final_decision
                    ? `GIẢNG VIÊN ĐÃ ${result.final_decision === "APPROVED" ? "PHÊ DUYỆT" : "TỪ CHỐI"} • Đã có phán quyết chính thức`
                    : result.route === "ESCALATE"
                    ? "ĐÃ CHUYỂN TIẾP CHO GIẢNG VIÊN • Vượt thẩm quyền AI (Chờ phê duyệt)"
                    : `CẦN BỔ SUNG THÔNG TIN • Lượt ${result.clarification_round || 1}/2`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {result.case_id && (
                  <div className="text-xs font-mono text-slate-500 font-semibold flex items-center gap-1.5">
                    <IconClock size={13} className="text-slate-400" />
                    <span>HỒ SƠ: #{result.case_id}</span>
                  </div>
                )}
                {currentRequestId && (
                  <div className="text-[11px] font-mono text-slate-400 font-normal">
                    Req: {currentRequestId.slice(0, 8)}...
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 lg:p-7 space-y-6">
              {/* Applied Exception Banner if present */}
              {result.applied_exception_id && (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start gap-3 shadow-xs">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                    <IconCheck size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-200 text-emerald-900 font-mono">
                        ĐÃ ÁP DỤNG NGOẠI LỆ
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-800">
                        #{result.applied_exception_id}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
                      Câu hỏi này đã được đối chiếu với cơ sở dữ liệu ngoại lệ và tự động áp dụng ngoại lệ được Giảng viên phê duyệt trước đó cho nhóm/môn này.
                    </p>
                  </div>
                </div>
              )}

              {/* 1. Official Conclusion / Decision Block */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[#DC2626]">
                    {result.route === "ANSWER" ? (
                      <IconScale size={18} />
                    ) : result.route === "OUT_OF_SCOPE" ? (
                      <IconInfo size={18} />
                    ) : result.route === "REJECT" ? (
                      <IconX size={18} />
                    ) : (
                      <IconTeacher size={18} />
                    )}
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {result.route === "ANSWER"
                      ? "KẾT LUẬN QUY CHẾ CHÍNH THỨC"
                      : result.route === "OUT_OF_SCOPE"
                      ? "HƯỚNG DẪN HỌC VỤ NGOÀI PHẠM VI MÔN HỌC"
                      : result.route === "REJECT"
                      ? "THÔNG BÁO TỪ CHỐI YÊU CẦU"
                      : result.final_decision
                      ? "QUYẾT ĐỊNH CHÍNH THỨC TỪ GIẢNG VIÊN"
                      : result.route === "ESCALATE"
                      ? "HỒ SƠ CHUYỂN TIẾP GIẢNG VIÊN PHỤ TRÁCH THỤ LÝ"
                      : `YÊU CẦU LÀM RÕ TỪ HỆ THỐNG (LƯỢT ${result.clarification_round || 1}/2)`}
                  </h3>
                </div>

                {/* Answer box according to route */}
                <div className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-xl">
                  {/* ANSWER route */}
                  {result.route === "ANSWER" && result.answer && (
                    <p className="text-sm text-slate-800 leading-relaxed font-medium">
                      {renderFormattedAnswer(result.answer)}
                    </p>
                  )}

                  {/* OUT_OF_SCOPE route */}
                  {result.route === "OUT_OF_SCOPE" && (
                    <div className="space-y-3">
                      {result.answer && (
                        <p className="text-sm text-slate-800 leading-relaxed font-medium">
                          {result.answer}
                        </p>
                      )}
                      <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-lg text-xs space-y-1.5 text-purple-900">
                        <div className="flex items-center gap-1.5 font-bold">
                          <IconInfo size={14} className="text-purple-700" />
                          <span>Ngoài phạm vi xử lý của môn học</span>
                        </div>
                        <p className="text-purple-800 leading-relaxed">
                          Yêu cầu của bạn không thuộc thẩm quyền của Giảng viên hay Quy chế môn học này. Vui lòng liên hệ Phòng Đào tạo, Ban Quản lý Ký túc xá hoặc đơn vị phụ trách liên quan theo hướng dẫn.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* REJECT route */}
                  {result.route === "REJECT" && (
                    <div className="space-y-3">
                      {result.answer && (
                        <p className="text-sm text-rose-900 leading-relaxed font-medium">
                          {result.answer}
                        </p>
                      )}
                      <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-1.5 text-rose-900">
                        <div className="flex items-center gap-1.5 font-bold text-rose-700">
                          <IconWarning size={14} />
                          <span>Thông báo từ chối</span>
                        </div>
                        <p className="text-rose-800 leading-relaxed">
                          Nội dung yêu cầu vi phạm chính sách học vụ hoặc không hợp lệ. Hệ thống từ chối yêu cầu và không tạo hồ sơ chuyển tiếp cho giảng viên.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ESCALATE route */}
                  {result.route === "ESCALATE" && (
                    <div className="space-y-3">
                      {result.final_decision ? (
                        <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs uppercase tracking-wider text-sky-900">
                              Quyết định: {result.final_decision === "APPROVED" ? "ĐÃ PHÊ DUYỆT" : "ĐÃ TỪ CHỐI"}
                            </span>
                            {result.exception_id && (
                              <span className="font-mono text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                                Ngoại lệ: #{result.exception_id}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-800 font-medium">
                            {result.final_decision_reason || "Giảng viên đã hoàn tất thẩm định hồ sơ."}
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-slate-800 leading-relaxed">
                            Yêu cầu của bạn thuộc diện{" "}
                            <strong className="text-red-700">ngoại lệ quy chế hoặc vượt thẩm quyền tự động</strong>{" "}
                            của AI. Hồ sơ đã được chuyển tiếp đến Giảng viên phụ trách môn học và đang chờ phê duyệt.
                          </p>
                          <div className="p-3 bg-white border border-amber-200 rounded-lg text-xs space-y-1.5 text-amber-900">
                            {result.case_id && (
                              <div className="flex items-center justify-between">
                                <span className="font-semibold">Mã hồ sơ thẩm định (lưu để xem trạng thái):</span>
                                <span className="font-mono font-bold text-slate-800 bg-amber-100 px-2 py-0.5 rounded">#{result.case_id}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">Giảng viên thụ lý:</span>
                              <span>
                                {catalog?.lecturer.display_name || "TS. Trần Minh Tuấn"} ({catalog?.lecturer.id || "lecturer-01"})
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">Phân luồng:</span>
                              <span className="font-semibold text-slate-800">
                                {result.escalation_target || "COURSE_LECTURER"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">Lý do phân luồng:</span>
                              <span className="font-mono text-[11px] bg-amber-100 px-1.5 py-0.5 rounded text-amber-800">
                                {result.reason_code || "AUTHORITY_EXCEPTION_REQUIRED"}
                              </span>
                            </div>
                          </div>

                          {/* Refresh button to check lecturer's decision */}
                          <div className="pt-2 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={handleRefreshQuestion}
                              disabled={refreshing}
                              className="px-3.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <IconRotateCcw size={13} className={refreshing ? "animate-spin" : ""} />
                              <span>{refreshing ? "Đang kiểm tra…" : "Làm mới kết quả hồ sơ"}</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* CLARIFY route */}
                  {result.route === "CLARIFY" && (
                    <div className="space-y-4">
                      {/* Conversation turns history if any */}
                      {conversationTurns.length > 0 && (
                        <div className="space-y-2 border-b border-slate-200/80 pb-3">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Tiến trình đối thoại bổ sung (Tối đa 2 lượt)
                          </div>
                          {conversationTurns.map((turn, idx) => (
                            <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1.5">
                              <div className="flex items-center justify-between font-semibold text-slate-600">
                                <span>{turn.round === 0 ? "Câu hỏi gốc ban đầu" : `Lượt làm rõ ${turn.round}/2`}</span>
                                {turn.round > 0 && (
                                  <span className="font-mono text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
                                    Vòng {turn.round}
                                  </span>
                                )}
                              </div>
                              {turn.clarifyingQuestion && (
                                <div className="text-sky-900 font-medium bg-sky-50/80 p-2 rounded-lg border border-sky-100">
                                  ❓ AI: {turn.clarifyingQuestion}
                                </div>
                              )}
                              {turn.studentResponse && (
                                <div className="text-slate-800 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100">
                                  💬 Sinh viên: {turn.studentResponse}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Current clarifying question */}
                      {result.clarifying_question && (
                        <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-sky-900 uppercase">
                              Câu hỏi làm rõ từ AI Referee:
                            </span>
                            <span className="text-[11px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full">
                              Lượt {result.clarification_round || 1}/2
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-sky-950">
                            {result.clarifying_question}
                          </p>
                        </div>
                      )}

                      {/* Clarification input form if round < 2 */}
                      {(result.clarification_round || 0) < 2 ? (
                        <form onSubmit={handleSendClarification} className="flex gap-2 pt-1">
                          <input
                            type="text"
                            value={clarificationText}
                            onChange={(e) => setClarificationText(e.target.value)}
                            placeholder="Nhập câu trả lời hoặc thông tin bổ sung (ví dụ: 'Nhóm em là nhóm A')..."
                            className="flex-1 px-3.5 py-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#DC2626] bg-white text-slate-800 shadow-xs"
                          />
                          <button
                            type="submit"
                            disabled={clarifyingBusy || !clarificationText.trim()}
                            className="px-5 py-2.5 bg-[#B91C1C] text-white text-xs font-semibold rounded-lg hover:bg-[#991B1B] disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-xs"
                          >
                            {clarifyingBusy ? "Đang gửi…" : "Gửi thông tin bổ sung"}
                          </button>
                        </form>
                      ) : (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-900">
                          Hệ thống đã đạt giới hạn tối đa 2 lượt bổ sung thông tin.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Citations Section (TRÍCH LỤC CĂN CỨ PHÁP LÝ & HỌC VỤ) */}
              {result.citations && result.citations.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[#DC2626]">
                        <IconBookOpen size={16} />
                      </span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        TRÍCH LỤC CĂN CỨ PHÁP LÝ & HỌC VỤ
                      </h4>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      Số trích dẫn: {result.citations.length} tài liệu
                    </span>
                  </div>

                  {/* Citations Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {result.citations.slice(0, 4).map((c, i) => (
                      <div
                        key={i}
                        className="p-4 bg-slate-50/60 hover:bg-slate-50 border border-slate-200/90 rounded-xl flex items-start gap-3 transition-all group shadow-2xs"
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-100/80 text-[#DC2626] flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                          {i % 2 === 0 ? <IconBookOpen size={16} /> : <IconShield size={16} />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {c.document_title}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 font-medium line-clamp-1">
                            {c.heading || `Trích đoạn quy chuẩn ${c.label}`}
                            {c.page_number !== null && c.page_number !== undefined
                              ? ` · Trang ${c.page_number}`
                              : ""}
                          </p>

                          {c.quote && (
                            <p className="text-[11px] text-slate-600 italic mt-1.5 line-clamp-2 pl-2 border-l-2 border-red-300">
                              "{c.quote}"
                            </p>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedCitation(c)}
                            className="mt-2 text-[11px] font-semibold text-[#DC2626] hover:text-[#991B1B] flex items-center gap-1 transition-colors"
                          >
                            <span>Xem điều khoản gốc</span>
                            <IconArrowUpRight size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Red Escalation Suggestion Banner (Only shown for ANSWER route) */}
              {result.route === "ANSWER" && (
                <div className="p-4 bg-gradient-to-r from-red-50/80 to-rose-50/50 border border-red-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#DC2626] text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                      <IconTeacher size={16} />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-red-950">
                        Trường hợp của bạn vượt quá quy chuẩn hoặc có lý do đặc biệt?
                      </h5>
                      <p className="text-[11px] text-red-800/80 mt-0.5">
                        Hệ thống hỗ trợ tạo hồ sơ ngoại lệ để chuyển trực tiếp Giảng viên phụ trách xem xét và phê duyệt.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleEscalateManually}
                    className="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5 flex-shrink-0"
                  >
                    <span>Chuyển tiếp ngay hồ sơ</span>
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}

              {/* 4. Bottom Utility Bar */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {onViewHistory && (
                    <button
                      type="button"
                      onClick={() => onViewHistory(result.question_id)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <IconBookOpen size={13} />
                      <span>Lưu vào Hồ sơ của tôi</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleNewQuestion}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
                  >
                    + Đặt câu hỏi mới
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {result.case_id && (
                    <div className="text-xs font-mono font-bold text-slate-500 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      <span>MÃ HỒ SƠ: #{result.case_id}</span>
                    </div>
                  )}
                  {currentRequestId && (
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">
                      X-Request-ID: {currentRequestId}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CARD 4: FOOTER FEEDBACK BAR ── */}
        <div className="px-5 py-3.5 bg-white border border-slate-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 shadow-2xs">
          <div className="flex items-center gap-2">
            <span>Thông tin phản hồi có hữu ích với bạn không?</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFeedback("up")}
                className={`p-1.5 rounded hover:bg-slate-100 transition-colors ${
                  feedback === "up" ? "text-emerald-600 bg-emerald-50" : "text-slate-400"
                }`}
                title="Hữu ích"
              >
                <IconThumbUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => setFeedback("down")}
                className={`p-1.5 rounded hover:bg-slate-100 transition-colors ${
                  feedback === "down" ? "text-red-600 bg-red-50" : "text-slate-400"
                }`}
                title="Chưa hữu ích"
              >
                <IconThumbDown size={14} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEscalateManually}
            className="text-slate-500 hover:text-[#DC2626] font-medium flex items-center gap-1 transition-colors"
          >
            <span>Cần khiếu nại hoặc chuyển tiếp Trọng tài viên xem xét</span>
            <IconChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* ── CITATION DETAILS MODAL ── */}
      {selectedCitation && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-red-100 text-[#DC2626] font-mono font-bold text-xs rounded">
                  {selectedCitation.label}
                </span>
                <h4 className="text-sm font-bold text-slate-900">
                  {selectedCitation.document_title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCitation(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {selectedCitation.heading && (
              <p className="text-xs font-semibold text-slate-700">
                Điều khoản: {selectedCitation.heading}
              </p>
            )}

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
              {selectedCitation.quote}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCitation(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
