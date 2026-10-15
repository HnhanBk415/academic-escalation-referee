import React, { FormEvent, useState, useRef, useEffect } from "react";
import { api, getLastRequestId, postJson } from "../api/client";
import {
  Send,
  Check,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  Copy,
  Clock,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  XCircle,
  BookOpen,
} from "lucide-react";
import { DEMO_ACCOUNTS } from "../components/AccountSwitcher";
import type { Citation, DemoCatalog, QuestionResponse } from "../types";

interface StudentSubmitViewProps {
  actorId?: string;
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
    prompt: "Hạn định hủy môn học được tính từ tuần thứ mấy theo quy chế?",
  },
  {
    label: "Đăng ký nhóm ngoại lệ",
    prompt: "Đăng ký nhóm ngoại lệ dưới 2 sinh viên hoặc 6 sinh viên được giải quyết thế nào?",
  },
  {
    label: "Quy định số lượng thành viên",
    prompt: "Quy định số lượng thành viên tối đa trong một nhóm đồ án chuyên ngành?",
  },
  {
    label: "Tỷ lệ điểm đồ án",
    prompt: "Tỷ lệ điểm giữa kỳ, quá trình, báo cáo tổng kết và demo là bao nhiêu?",
  },
];

export function StudentSubmitView({
  actorId,
  catalog,
  selectedCourseId,
  selectedGroupId,
  onSelectCourse,
  onSelectGroup,
  onSubmitted,
  onViewHistory,
}: StudentSubmitViewProps) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QuestionResponse | null>(null);
  const [clarificationText, setClarificationText] = useState("");
  const [clarifyingBusy, setClarifyingBusy] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [copiedRequestId, setCopiedRequestId] = useState(false);
  const [conversationTurns, setConversationTurns] = useState<ClarificationTurnItem[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [copiedQuote, setCopiedQuote] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  // Dropdown states
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  const selectedCourse = catalog?.courses.find((c) => c.id === selectedCourseId);
  const availableGroups = selectedCourse?.groups ?? [];
  const selectedGroup =
    availableGroups.find((g) => g.id === selectedGroupId) || availableGroups[0];

  const effectiveGroupId =
    availableGroups.some((g) => g.id === selectedGroupId)
      ? selectedGroupId
      : selectedGroup?.id || "";

  const defaultAccount = DEMO_ACCOUNTS.find((a) => a.id === actorId);
  const memberGroup = availableGroups.find((g) =>
    (g as unknown as { member_ids?: string[] }).member_ids?.includes(actorId || "")
  );
  const defaultGroupId =
    memberGroup?.id ||
    (defaultAccount?.courseId === selectedCourseId ? defaultAccount.groupId : undefined);

  const isDifferentFromDefault = Boolean(
    defaultGroupId &&
    effectiveGroupId &&
    effectiveGroupId !== defaultGroupId
  );

  const activeGroupObj = availableGroups.find((g) => g.id === effectiveGroupId) || selectedGroup;
  const activeGroupShortName = activeGroupObj?.name
    ? activeGroupObj.name.includes(" - ")
      ? activeGroupObj.name.split(" - ")[0].trim()
      : activeGroupObj.name.trim()
    : "";

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(e.target as Node)) {
        setIsCourseDropdownOpen(false);
      }
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target as Node)) {
        setIsGroupDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Determine current active scenario based strictly on real result route
  const activeScenario: "A" | "B" | "C" | "REJECT" =
    result?.route === "ANSWER"
      ? "A"
      : result?.route === "CLARIFY"
      ? "B"
      : result?.route === "REJECT" || (result as any)?.status === "REJECTED"
      ? "REJECT"
      : "C";

  async function handleSubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!selectedCourseId) {
      setError("Vui lòng chọn môn học trước khi gửi thắc mắc.");
      return;
    }
    if (availableGroups.length === 0 || !effectiveGroupId) {
      setError("Môn học này hiện chưa có nhóm đồ án để gửi thắc mắc.");
      return;
    }
    if (!query.trim()) {
      setError("Vui lòng nhập nội dung thắc mắc quy chế.");
      return;
    }

    setResult(null);
    setConversationTurns([]);
    setFeedback(null);
    setSelectedCitation(null);
    setBusy(true);
    setError("");

    try {
      const res = await postJson<QuestionResponse>("/api/v1/questions", {
        actor_id: actorId || "student-a1",
        course_id: selectedCourseId,
        group_id: effectiveGroupId,
        text: query.trim(),
      });

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

  async function handleSendClarification(e?: FormEvent) {
    if (e) e.preventDefault();
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

  const handleChipClick = (promptText: string) => {
    setQuery(promptText);
    // Focus or submit
  };

  const handleCopyRequestId = () => {
    const idToCopy = currentRequestId || result?.question_id;
    if (idToCopy) {
      navigator.clipboard.writeText(idToCopy);
      setCopiedRequestId(true);
      setTimeout(() => setCopiedRequestId(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. HEADER SECTION & ACADEMIC SELECTORS */}
      <section className="pt-1 pb-1">
        <div>
          <h1 className="font-display text-xl sm:text-2xl text-stone-900 font-bold tracking-tight">
            Hỏi đáp quy chế
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Tra cứu quy chế đào tạo, đối soát điều khoản tự động và gửi yêu cầu thẩm định ngoại lệ
          </p>
        </div>

        {/* 2 Dropdown Selectors directly under title */}
        <div className="flex flex-wrap items-center gap-2.5 mt-3">
          {/* Subject Dropdown */}
          <div className="relative" ref={courseDropdownRef}>
            <button
              type="button"
              onClick={() => setIsCourseDropdownOpen((prev) => !prev)}
              className="inline-flex items-center justify-between gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-rose-200/80 shadow-2xs text-stone-800 hover:border-ruby-400 text-xs sm:text-sm font-semibold transition-all cursor-pointer min-w-[14rem]"
            >
              <span className="truncate">
                {selectedCourse
                  ? `${selectedCourse.id} - ${selectedCourse.name}`
                  : "Chọn học phần"}
              </span>
              <ChevronDown size={15} className="text-stone-500 shrink-0" />
            </button>

            {isCourseDropdownOpen && catalog && (
              <div className="absolute left-0 mt-1.5 w-72 bg-white rounded-xl shadow-lg border border-rose-100 py-1.5 z-50 animate-fade-in">
                <div className="px-3 py-1 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Danh sách học phần
                </div>
                {catalog.courses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => {
                      onSelectCourse(course.id);
                      setIsCourseDropdownOpen(false);
                      setResult(null);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm transition-colors flex items-center justify-between cursor-pointer hover:bg-rose-50 ${
                      course.id === selectedCourseId
                        ? "text-ruby-800 font-bold bg-rose-50/70"
                        : "text-stone-700"
                    }`}
                  >
                    <span className="truncate">
                      {course.id} - {course.name}
                    </span>
                    {course.id === selectedCourseId && (
                      <Check size={14} className="text-ruby-700 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Group Selector */}
          <div className="relative" ref={groupDropdownRef}>
            <button
              type="button"
              onClick={() => setIsGroupDropdownOpen((prev) => !prev)}
              disabled={availableGroups.length === 0}
              className="inline-flex items-center justify-between gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-rose-200/80 shadow-2xs text-stone-800 hover:border-ruby-400 text-xs sm:text-sm font-semibold transition-all cursor-pointer min-w-[10.5rem] disabled:opacity-50"
            >
              <span className="truncate">
                {availableGroups.length === 0
                  ? "Chưa có nhóm"
                  : selectedGroup
                  ? selectedGroup.name
                  : "Chọn nhóm đồ án"}
              </span>
              <ChevronDown size={15} className="text-stone-500 shrink-0" />
            </button>

            {isGroupDropdownOpen && availableGroups.length > 0 && (
              <div className="absolute left-0 mt-1.5 w-60 bg-white rounded-xl shadow-lg border border-rose-100 py-1.5 z-50 animate-fade-in">
                <div className="px-3 py-1 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Nhóm trong học phần
                </div>
                {availableGroups.map((grp) => (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => {
                      onSelectGroup(grp.id);
                      setIsGroupDropdownOpen(false);
                      setResult(null);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm transition-colors flex items-center justify-between cursor-pointer hover:bg-rose-50 ${
                      grp.id === effectiveGroupId
                        ? "text-ruby-800 font-bold bg-rose-50/70"
                        : "text-stone-700"
                    }`}
                  >
                    <span className="truncate">{grp.name}</span>
                    {grp.id === effectiveGroupId && (
                      <Check size={14} className="text-ruby-700 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Thông báo khóa khi môn học chưa có nhóm */}
        {availableGroups.length === 0 && (
          <p className="text-xs text-red-600 flex items-center gap-1.5 mt-2">
            <AlertTriangle size={13} className="shrink-0" />
            <span>Môn học này hiện chưa có nhóm đồ án. Vui lòng chọn môn học khác để gửi câu hỏi.</span>
          </p>
        )}

        {/* Dòng chú thích khi chọn nhóm khác nhóm mặc định của tài khoản */}
        {isDifferentFromDefault && activeGroupShortName && (
          <p className="text-xs text-stone-500 flex items-center gap-1.5 mt-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-ruby-700" />
            <span>Đang hỏi với tư cách thành viên {activeGroupShortName} (chế độ demo)</span>
          </p>
        )}
      </section>

      {/* 2. BIG QUERY INPUT CARD */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-soft-card border border-rose-100 relative">
        <form onSubmit={handleSubmit}>
          <div className="relative w-full rounded-2xl border border-rose-200/80 bg-white focus-within:border-ruby-500 focus-within:ring-2 focus-within:ring-ruby-100 transition-all p-3.5 pb-13">
            <textarea
              className="w-full bg-transparent text-stone-900 font-sans text-sm sm:text-base focus:outline-none resize-none placeholder:text-stone-400 leading-relaxed font-medium"
              id="questionInput"
              placeholder="Nhập câu hỏi về quy chế môn học, vd: Nhóm đồ án được tối đa bao nhiêu thành viên?"
              rows={3}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={busy}
            />

            {/* Round circular submit button with send / paper plane icon */}
            <div className="absolute bottom-2.5 right-2.5 flex items-center justify-end">
              <button
                type="submit"
                disabled={busy || !query.trim() || availableGroups.length === 0}
                title="Gửi câu hỏi"
                className="w-9 h-9 rounded-full bg-ruby-700 text-white flex items-center justify-center shadow-md hover:bg-ruby-800 hover:shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                {busy ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={15} className="text-white ml-0.5" />
                )}
              </button>
            </div>
          </div>
        </form>

        {error && (
          <div className="mt-2.5 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800 flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick suggestion chips ("Gợi ý nhanh:") */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1 flex items-center gap-1 select-none">
            <span>✨</span> Gợi ý nhanh:
          </span>
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => handleChipClick(chip.prompt)}
              className="px-2.5 py-1 rounded-full border border-rose-200/80 bg-white text-stone-700 text-xs font-medium hover:border-ruby-400 hover:text-ruby-800 hover:bg-rose-50/50 transition-all cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. WORKFLOW PROGRESS STEPPER (Always visible, dynamic status) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-soft-card border border-rose-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-rose-100/80 gap-2.5">
          <h3 className="font-display text-sm sm:text-base text-stone-900 font-bold tracking-tight">
            Tiến trình thẩm định & phân luồng học vụ
          </h3>
          <div className="flex items-center">
            {busy ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-ruby-800 border border-rose-300 font-semibold text-xs">
                <span className="w-2 h-2 rounded-full bg-ruby-600 animate-pulse" />
                <span>Đang đối soát & phân luồng…</span>
              </span>
            ) : result ? (
              activeScenario === "A" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span>AI trả lời tự động</span>
                </span>
              ) : activeScenario === "B" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 font-semibold text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Cần bổ sung thông tin (Lượt {result.clarification_round || 1}/2)</span>
                </span>
              ) : activeScenario === "REJECT" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-ruby-900 border border-rose-300 font-semibold text-xs">
                  <span className="w-2 h-2 rounded-full bg-ruby-700" />
                  <span>Từ chối trực tiếp (Vi phạm bảo mật)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-ruby-800 border border-rose-300 font-semibold text-xs">
                  <span className="w-2 h-2 rounded-full bg-ruby-600 animate-pulse" />
                  <span>Chuyển Giảng viên thụ lý</span>
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-600 border border-stone-200 font-semibold text-xs">
                <span>Sẵn sàng tra cứu</span>
              </span>
            )}
          </div>
        </div>

        {/* Connected Horizontal Line Stepper Structure */}
        <div className="relative mt-6 mb-3 px-2 sm:px-6">
          {/* Continuous connecting line */}
          <div className="absolute top-4 left-8 sm:left-12 right-8 sm:right-12 h-[2px] bg-stone-200 -z-0">
            <div
              className="h-full bg-ruby-700 transition-all duration-300"
              style={{
                width: result ? (activeScenario === "B" ? "50%" : "100%") : busy ? "50%" : "0%",
              }}
            />
          </div>

          {/* 3 Stepper Nodes */}
          <div className="relative z-10 grid grid-cols-3 gap-2 sm:gap-6">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all ${
                  result || busy
                    ? "bg-ruby-700 text-white ring-4 ring-rose-50"
                    : "border border-stone-200 bg-stone-50 text-stone-500"
                }`}
              >
                {result || busy ? <Check size={15} /> : <span>1</span>}
              </div>
              <div className="mt-2.5">
                <div className="font-bold text-stone-900 text-xs">Gửi câu hỏi</div>
                <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                  Sinh viên gửi đề xuất học vụ
                  <br />
                  <span className="text-stone-400">
                    {result || busy ? "Đã tiếp nhận vào hệ thống" : "Chờ gửi câu hỏi"}
                  </span>
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all ${
                  result
                    ? "bg-ruby-700 text-white ring-4 ring-rose-50"
                    : busy
                    ? "border-2 border-ruby-700 bg-white text-ruby-700 ring-4 ring-rose-100"
                    : "border border-stone-200 bg-stone-50 text-stone-500"
                }`}
              >
                {result ? (
                  <Check size={15} />
                ) : busy ? (
                  <span className="w-3.5 h-3.5 border-2 border-ruby-700 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>2</span>
                )}
              </div>
              <div className="mt-2.5">
                <div className="font-bold text-stone-900 text-xs">
                  Kiểm tra & Phân luồng
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                  {busy ? "Hệ thống AI đối chiếu quy chế" : "RAG đối chiếu quy chế định mức"}
                  <br />
                  {busy ? (
                    <span className="text-ruby-700 font-semibold">Đang đối chiếu quy chế…</span>
                  ) : result ? (
                    activeScenario === "A" ? (
                      <span className="text-emerald-700 font-semibold">
                        Quy chuẩn hợp lệ (Đủ thẩm quyền AI)
                      </span>
                    ) : activeScenario === "B" ? (
                      <span className="text-amber-700 font-semibold">
                        Thiếu dữ kiện tình huống cụ thể
                      </span>
                    ) : activeScenario === "REJECT" ? (
                      <span className="text-ruby-700 font-semibold">
                        Phát hiện can thiệp hệ thống / Prompt Injection
                      </span>
                    ) : (
                      <span className="text-ruby-700 font-semibold">
                        Trường hợp ngoại lệ (Cần phê duyệt)
                      </span>
                    )
                  ) : (
                    <span className="text-stone-400">Chờ tiếp nhận & phân luồng</span>
                  )}
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all ${
                  result
                    ? activeScenario === "A"
                      ? "bg-emerald-600 text-white ring-4 ring-emerald-50"
                      : activeScenario === "B"
                      ? "bg-white text-ruby-800 border-2 border-ruby-700 ring-4 ring-rose-50"
                      : activeScenario === "REJECT"
                      ? "bg-ruby-700 text-white ring-4 ring-rose-100"
                      : "bg-white text-ruby-700 border-2 border-ruby-700 ring-4 ring-rose-50"
                    : "border border-stone-200 bg-stone-50 text-stone-500"
                }`}
              >
                {result ? (
                  activeScenario === "A" ? (
                    <Check size={15} />
                  ) : activeScenario === "B" ? (
                    <span>3</span>
                  ) : activeScenario === "REJECT" ? (
                    <XCircle size={15} />
                  ) : (
                    <ArrowRight size={15} className="text-ruby-700" />
                  )
                ) : (
                  <span>3</span>
                )}
              </div>
              <div className="mt-2.5">
                <div
                  className={`font-bold text-xs ${
                    result ? "text-ruby-800" : "text-stone-900"
                  }`}
                >
                  {result
                    ? activeScenario === "A"
                      ? "AI Trả lời & Trích dẫn"
                      : activeScenario === "B"
                      ? "AI Yêu cầu làm rõ"
                      : activeScenario === "REJECT"
                      ? "Từ chối trực tiếp"
                      : "Chuyển Giảng viên"
                    : "Thẩm định & Trả lời"}
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                  {result ? (
                    activeScenario === "A" ? (
                      <>
                        Căn cứ pháp lý rõ ràng
                        <br />
                        <span className="text-stone-400">Đã trích xuất khung quy chế đào tạo</span>
                      </>
                    ) : activeScenario === "B" ? (
                      <>
                        Chưa đủ dữ kiện đối chiếu
                        <br />
                        <span className="text-stone-400">Chờ sinh viên bổ sung tình huống</span>
                      </>
                    ) : activeScenario === "REJECT" ? (
                      <>
                        Vi phạm an toàn hệ thống
                        <br />
                        <span className="text-ruby-700 font-medium">Hệ thống từ chối can thiệp</span>
                      </>
                    ) : (
                      <>
                        Vượt thẩm quyền tự động AI
                        <br />
                        <span className="text-stone-400">Hồ sơ chờ Giảng viên xem xét</span>
                      </>
                    )
                  ) : (
                    <>
                      Phản hồi chính thức
                      <br />
                      <span className="text-stone-400">Tự động đối soát bởi AI hoặc Giảng viên</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CHỈ HIỂN THỊ KẾT QUẢ PHÂN LUỒNG KHI ĐÃ ĐẶT CÂU HỎI VÀ CÓ KẾT QUẢ */}
      {result && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-soft-card border border-rose-100 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 gap-2.5 border-b border-rose-100">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase text-stone-900 font-extrabold tracking-wider">
                Kết quả phân luồng
              </span>
              {result?.question_id && (
                <span className="font-mono text-xs text-stone-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  #{result.question_id.replace(/^q_/, "").slice(0, 8).toUpperCase()}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setResult(null);
                setQuery("");
                setError("");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-rose-200 text-stone-600 hover:text-ruby-800 hover:bg-rose-50 text-xs font-semibold transition-all cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>Đặt câu hỏi mới</span>
            </button>
          </div>

        {/* SCENARIO A: AUTO RESOLVED */}
        {activeScenario === "A" && (
          <div className="pt-5 space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200">
              <div className="flex items-center gap-2">
                <Check size={18} className="text-emerald-700" />
                <span className="font-bold text-sm">Trả lời tự động từ quy chế hiện hành</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/50 space-y-1.5 border border-rose-100/60">
              <div className="flex items-center gap-1.5 text-ruby-800 text-[11px] uppercase tracking-wider font-bold">
                <span>Kết luận từ quy chế chính thức</span>
              </div>
              <p className="text-sm text-stone-800 font-medium leading-relaxed">
                {result?.answer || (
                  <>
                    Theo rubric đánh giá đồ án môn học {selectedCourseId || "CO3001"}, cơ cấu điểm bao gồm:{" "}
                    <span className="font-bold text-ruby-800">báo cáo kỹ thuật 30%</span>,{" "}
                    <span className="font-bold text-ruby-800">sản phẩm 40%</span>,{" "}
                    <span className="font-bold text-ruby-800">trình bày và trả lời câu hỏi 20%</span>,{" "}
                    <span className="font-bold text-ruby-800">hợp tác và đóng góp trong nhóm 10%</span>.
                  </>
                )}
              </p>
            </div>

            {/* Citations / Evidence Section */}
            {((result?.citations && result.citations.length > 0) || !result?.citations) && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5 text-ruby-800">
                    <BookOpen size={14} />
                    <span>
                      Căn cứ pháp lý & Trích dẫn quy chế
                      {result?.citations?.length ? ` (${result.citations.length})` : ""}
                    </span>
                  </span>
                  <span className="text-[11px] text-stone-400 font-medium">
                    Đối soát trực tiếp từ văn bản quy chế
                  </span>
                </div>

                <div className="space-y-3">
                  {(result?.citations && result.citations.length > 0
                    ? result.citations
                    : [
                        {
                          label: "C1",
                          chunk_id: "c1",
                          document_id: "rubric-01",
                          document_title: `Rubric đánh giá đồ án ${selectedCourseId || "CO3001"}`,
                          page_number: null,
                          heading: "Cơ cấu điểm & Tỷ lệ đánh giá",
                          quote:
                            "Mục 4.2 – Thành phần đánh giá đồ án tốt nghiệp và chuyên ngành CO3001 quy định trọng số tính tổng điểm học phần cuối kỳ: Thuyết minh báo cáo 30%, Hiện thực và demo mã nguồn 40%, Vấn đáp hội đồng chuyên môn 20%, Đánh giá nội bộ chéo giữa các thành viên 10%. Điểm làm tròn đến 0.5.",
                        },
                      ]
                  ).map((c, idx) => (
                    <div
                      key={c.chunk_id || idx}
                      className="p-4 rounded-xl bg-white border border-rose-200/90 shadow-2xs space-y-2.5 transition-all hover:border-ruby-300"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-mono text-xs font-bold bg-rose-100 text-ruby-800 px-2.5 py-0.5 rounded-full border border-rose-200 shadow-2xs">
                            [{c.label || `C${idx + 1}`}]
                          </span>
                          <span className="font-semibold text-sm text-stone-900 truncate">
                            {c.document_title}
                          </span>
                          {c.heading && (
                            <span className="text-xs text-stone-600 font-medium bg-rose-50/70 px-2 py-0.5 rounded-md border border-rose-100">
                              § {c.heading}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedCitation(c)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-ruby-700 hover:text-ruby-800 hover:bg-rose-50 text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                          title="Xem chi tiết toàn văn điều khoản"
                        >
                          <span>Xem toàn văn</span>
                          <ExternalLink size={13} />
                        </button>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#fff8f9] text-stone-700 text-xs leading-relaxed border-l-3 border-ruby-700 whitespace-pre-line italic selection:bg-rose-200">
                        “{c.quote}”
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar: Copy ID & Feedback */}
            <div className="flex items-center justify-between pt-2 text-xs text-stone-500">
              <button
                type="button"
                onClick={handleCopyRequestId}
                className="inline-flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer"
              >
                <Copy size={14} />
                <span>
                  {copiedRequestId ? "Đã sao chép mã!" : "Sao chép mã yêu cầu"}
                </span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[11px]">Đánh giá phản hồi:</span>
                <button
                  type="button"
                  onClick={() => setFeedback("up")}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    feedback === "up"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "hover:bg-stone-50 border-stone-200 text-stone-600"
                  }`}
                  title="Hữu ích"
                >
                  <ThumbsUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setFeedback("down")}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    feedback === "down"
                      ? "bg-red-50 text-red-700 border-red-300"
                      : "hover:bg-stone-50 border-stone-200 text-stone-600"
                  }`}
                  title="Chưa chính xác"
                >
                  <ThumbsDown size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO B: CLARIFY / CẦN BỔ SUNG */}
        {activeScenario === "B" && (
          <div className="pt-5 space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/10 text-amber-900 border border-amber-500/20">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-700" />
                <span className="font-bold text-sm">
                  Cần bổ sung thông tin (Lượt {result?.clarification_round || 1}/2)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/50 space-y-1.5 border border-rose-100/60">
              <span className="text-[11px] uppercase text-amber-800 font-bold tracking-wider block">
                thông báo từ hệ thống ai
              </span>
              <p className="text-sm text-stone-800 leading-relaxed">
                {result?.clarifying_question || (
                  <>
                    Câu hỏi của bạn quá ngắn hoặc chưa nêu rõ ngữ cảnh cụ thể (
                    <span className="font-bold text-ruby-800">
                      “{query.trim() || "ở ĐÂU"}”
                    </span>
                    ). Bạn vui lòng cung cấp thêm thông tin chi tiết về địa điểm, vấn đề hoặc nội dung cụ thể mà bạn đang muốn hỏi để hệ thống có thể đối chiếu chính xác với quy chế môn học {selectedCourseId || "CO3001"}.
                  </>
                )}
              </p>
            </div>

            {/* Supplementary Input Console */}
            <form onSubmit={handleSendClarification} className="space-y-2 pt-1">
              <label className="text-xs font-semibold text-stone-700 block">
                Nhập câu trả lời bổ sung làm rõ:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={clarificationText}
                  onChange={(e) => setClarificationText(e.target.value)}
                  placeholder="Ví dụ: Phòng nộp báo cáo đồ án ở đâu hoặc địa điểm bảo vệ hội đồng..."
                  disabled={clarifyingBusy}
                  className="flex-1 bg-rose-50/50 px-4 py-2.5 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-ruby-200 outline-none border border-rose-200/80 text-stone-900 placeholder:text-stone-400"
                />
                <button
                  type="submit"
                  disabled={clarifyingBusy || !clarificationText.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-ruby-700 text-white font-semibold text-sm hover:bg-ruby-800 transition-colors shadow-sm disabled:opacity-40 cursor-pointer"
                >
                  <span>{clarifyingBusy ? "Đang gửi..." : "Gửi thông tin bổ sung"}</span>
                  <Send size={15} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SCENARIO REJECT: PROMPT INJECTION / SUSPICIOUS INPUT */}
        {activeScenario === "REJECT" && (
          <div className="pt-5 space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-100/90 text-ruby-950 border border-rose-300">
              <div className="flex items-center gap-2">
                <XCircle size={18} className="text-ruby-700" />
                <span className="font-bold text-sm">
                  Yêu cầu bị từ chối do vi phạm an toàn hệ thống
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/70 space-y-1.5 border border-rose-200/80">
              <div className="flex items-center gap-1.5 text-ruby-800 text-[11px] uppercase tracking-wider font-bold">
                <span>Thông báo từ chối trực tiếp</span>
              </div>
              <p className="text-sm text-stone-800 font-medium leading-relaxed">
                {result?.answer ||
                  "Yêu cầu bị từ chối vì có dấu hiệu can thiệp hệ thống hoặc vi phạm quy định. Hệ thống không thực hiện thay đổi dữ liệu, điểm số hay phê duyệt ngoại lệ."}
              </p>
            </div>

            <div className="rounded-xl bg-white border border-rose-200/80 overflow-hidden shadow-xs">
              <div className="px-4 py-2.5 bg-rose-50/70 text-[11px] uppercase text-stone-600 font-bold border-b border-rose-100">
                Chi tiết xử lý vi phạm an toàn
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-stone-500 block mb-0.5">Mã hồ sơ:</span>
                  <span className="font-mono text-ruby-800 font-bold text-sm">
                    #{result?.question_id?.slice(0, 8) || "01"}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block mb-0.5">Phân loại an toàn:</span>
                  <span className="font-semibold text-stone-900 font-mono">
                    {result?.policy_topic || "SECURITY"}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block mb-0.5">Hình thức xử lý:</span>
                  <span className="font-mono bg-rose-100 text-ruby-900 px-2 py-0.5 rounded font-semibold border border-rose-200">
                    DIRECT_REJECT (Từ chối thẳng, không chuyển GV)
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block mb-0.5">Mã kiểm duyệt:</span>
                  <span className="font-mono text-ruby-700 font-semibold">
                    {result?.reason_code || "SUSPICIOUS_INPUT"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-rose-100 gap-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  if (result?.question_id && onViewHistory) {
                    onViewHistory(result.question_id);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-100 text-ruby-800 font-semibold hover:bg-rose-200 transition-all cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Xem chi tiết trong lịch sử</span>
              </button>
            </div>
          </div>
        )}

        {/* SCENARIO C: ESCALATED TO LECTURER */}
        {activeScenario === "C" && (
          <div className="pt-5 space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-500/10 text-rose-950 border border-rose-500/20">
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-ruby-700" />
                <span className="font-bold text-sm text-ruby-800">
                  Đã chuyển tiếp cho giảng viên phụ trách
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/50 space-y-1 border border-rose-100/60">
              <span className="text-[11px] uppercase text-ruby-800 font-bold tracking-wider block">
                Thông báo thẩm quyền học vụ:
              </span>
              <p className="text-sm text-stone-800 leading-relaxed">
                Yêu cầu của bạn thuộc diện ngoại lệ quy chế hoặc vượt thẩm quyền tự động của AI. Hồ sơ đã được chuyển tiếp đến Giảng viên phụ trách môn học và đang chờ xem xét.
              </p>
            </div>

            <div className="rounded-xl bg-white border border-rose-200/80 overflow-hidden shadow-xs">
              <div className="px-4 py-2.5 bg-rose-50/70 text-[11px] uppercase text-stone-600 font-bold border-b border-rose-100">
                Chi tiết hồ sơ điều phối phân luồng
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-stone-500 block mb-0.5">Mã hồ sơ thẩm định:</span>
                  <span className="font-mono text-ruby-800 font-bold text-sm">
                    #{result?.question_id?.slice(0, 8) || "01"}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block mb-0.5">Giảng viên thụ lý:</span>
                  <span className="font-semibold text-stone-900">
                    {(result as any)?.assigned_to || (result as any)?.assigned_reviewer_id || "TS. Trần Minh Tuấn"}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block mb-0.5">Phân luồng học vụ:</span>
                  <span className="font-mono bg-rose-50 px-2 py-0.5 rounded text-stone-800 font-semibold border border-rose-200">
                    {result?.escalation_target || "COURSE_LECTURER"}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block mb-0.5">Lý do phân luồng:</span>
                  <span className="font-mono text-ruby-700 font-semibold">
                    {result?.reason_code || "REQUIRES_LECTURER_APPROVAL"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-rose-100 gap-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  if (result?.question_id && onViewHistory) {
                    onViewHistory(result.question_id);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-100 text-ruby-800 font-semibold hover:bg-rose-200 transition-all cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Xem chi tiết trong lịch sử</span>
              </button>
            </div>
          </div>
        )}
      </div>
    )}

    {/* 5. FOOTER FEEDBACK BAR */}
    <div className="bg-white p-4 rounded-2xl shadow-soft-card border border-rose-100 flex items-center justify-between gap-3 text-xs text-stone-600">
      <div className="flex items-center gap-2">
        <span>Thông tin phản hồi có hữu ích với bạn không?</span>
        <button
          type="button"
          onClick={() => setFeedback("up")}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
            feedback === "up"
              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
              : "hover:bg-stone-50 border-stone-200 text-stone-600"
          }`}
          title="Hữu ích"
        >
          <ThumbsUp size={14} />
        </button>
        <button
          type="button"
          onClick={() => setFeedback("down")}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
            feedback === "down"
              ? "bg-red-50 text-red-700 border-red-300"
              : "hover:bg-stone-50 border-stone-200 text-stone-600"
          }`}
          title="Chưa chính xác"
        >
          <ThumbsDown size={14} />
        </button>
      </div>
    </div>

      {/* Citation Detail Modal */}
      {selectedCitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3.5 border-b border-rose-100 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-rose-100 text-ruby-800 px-2.5 py-0.5 rounded-full border border-rose-200">
                    [{selectedCitation.label || "C1"}]
                  </span>
                  <h3 className="font-bold text-base text-stone-900 leading-snug">
                    {selectedCitation.document_title}
                  </h3>
                </div>
                {selectedCitation.heading && (
                  <p className="text-xs text-stone-500 font-medium pl-0.5">
                    Mục / Điều khoản: <span className="text-stone-800 font-semibold">{selectedCitation.heading}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCitation(null);
                  setCopiedQuote(false);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors text-base font-bold shrink-0 cursor-pointer"
                title="Đóng"
              >
                ✕
              </button>
            </div>

            {/* Modal Quote Content */}
            <div className="space-y-2">
              <span className="text-[11px] uppercase tracking-wider font-bold text-stone-400 block">
                Nội dung trích xuất nguyên văn:
              </span>
              <div className="p-4 bg-rose-50/40 rounded-xl border border-rose-200/70 text-xs sm:text-sm text-stone-800 leading-relaxed whitespace-pre-line max-h-72 overflow-y-auto">
                {selectedCitation.quote}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-rose-100">
              <button
                type="button"
                onClick={() => {
                  if (selectedCitation?.quote) {
                    navigator.clipboard.writeText(selectedCitation.quote);
                    setCopiedQuote(true);
                    setTimeout(() => setCopiedQuote(false), 2000);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-rose-50 text-stone-600 hover:text-ruby-800 text-xs font-semibold transition-all cursor-pointer"
              >
                {copiedQuote ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Đã sao chép!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Sao chép điều khoản</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCitation(null);
                  setCopiedQuote(false);
                }}
                className="px-5 py-2 rounded-full bg-ruby-700 hover:bg-ruby-800 text-white font-semibold text-xs shadow-sm hover:shadow transition-all cursor-pointer"
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
