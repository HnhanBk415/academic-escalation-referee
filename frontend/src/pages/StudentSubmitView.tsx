import React, { FormEvent, useState } from "react";
import { api, getLastRequestId, postJson } from "../api/client";
import {
  IconArrowUpRight,
  IconBookOpen,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconHelp,
  IconInfo,
  IconMessageSquare,
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
import { Send, Copy, Check } from "lucide-react";
import { StudentWorkflowTracker } from "../components/StudentWorkflowTracker";
import { Badge } from "../components/ui/Badge";
import { PageHeader } from "../components/ui";
import { routeLabel, routeTone } from "../utils/labels";
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
  const [refreshing, setRefreshing] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [copiedRequestId, setCopiedRequestId] = useState(false);
  const [conversationTurns, setConversationTurns] = useState<ClarificationTurnItem[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  // Time tracking
  const [submitTime, setSubmitTime] = useState("");
  const [processTime, setProcessTime] = useState("");

  const selectedCourse = catalog?.courses.find((c) => c.id === selectedCourseId);
  const availableGroups = selectedCourse?.groups ?? [];
  const selectedGroup = availableGroups.find((g) => g.id === selectedGroupId) ||
    availableGroups.find((g) => g.id === (actorId === "student-b1" ? "group-b" : "group-a"));

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
    if (!selectedCourseId) {
      setError("Vui lòng chọn môn học trước khi gửi thắc mắc.");
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

    const effectiveGroupId =
      selectedGroupId ||
      selectedGroup?.id ||
      (actorId === "student-b1" ? "group-b" : "group-a");

    try {
      const res = await postJson<QuestionResponse>("/api/v1/questions", {
        actor_id: actorId || "student-a1",
        course_id: selectedCourseId,
        group_id: effectiveGroupId,
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

  const handleCopyRequestId = (reqId: string) => {
    void navigator.clipboard.writeText(reqId);
    setCopiedRequestId(true);
    setTimeout(() => setCopiedRequestId(false), 2000);
  };

  // Format bold highlight for answer text (Material 3: font-medium, no red color)
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
            <strong key={idx} className="font-medium text-[var(--on-surface)]">
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
    <div className="flex-1 w-full bg-[var(--surface-dim)] space-y-5">
      {/* Title */}
      <PageHeader
        title="Hỏi đáp quy chế"
        description="Tra cứu quy chế đào tạo, đối soát điều khoản tự động và gửi yêu cầu thẩm định ngoại lệ"
      />

      {error && (
          <div className="p-4 bg-[#FFEBEE] border border-[#FFCDD2] rounded-[var(--radius-md)] text-sm text-[var(--error)] font-medium flex items-center gap-2 shadow-xs">
            <IconWarning size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Hàng 1: pill "Chọn môn" + chip nhóm read-only */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={selectedCourseId}
              disabled={!catalog || !catalog.courses || catalog.courses.length === 0}
              onChange={(e) => {
                onSelectCourse(e.target.value);
                setResult(null);
                setError("");
                setSubmitTime("");
                setProcessTime("");
              }}
              className="appearance-none h-10 pl-4 pr-9 rounded-[var(--radius-xl)] bg-[var(--surface)] border border-[var(--outline)] text-xs font-medium text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {!catalog || !catalog.courses || catalog.courses.length === 0 ? (
                <option value="" disabled>
                  Đang tải môn học…
                </option>
              ) : (
                catalog.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} - {course.name} ({course.semester})
                  </option>
                ))
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--on-surface-variant)]">
              <IconChevronRight size={14} className="rotate-90" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-xl)] bg-[var(--surface-container)] border border-[var(--outline)]/40 text-xs text-[var(--on-surface-variant)] select-none">
            <span>Nhóm:</span>
            <span className="font-semibold text-[var(--on-surface)]">
              {selectedGroup?.name || (actorId === "student-b1" ? "Nhóm 02 - CO3001" : "Nhóm 01 - CO3001")}
            </span>
          </div>
        </div>

        {/* Hàng 2: ô hỏi lớn với nút FAB nhỏ */}
        <div className="rounded-[var(--radius-lg)] bg-[var(--surface-container)] border border-[var(--outline)]/40 focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:bg-[var(--surface)] transition-all p-4 shadow-xs">
          <textarea
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            rows={3}
            placeholder="Nhập câu hỏi về quy chế môn học, vd: Nhóm đồ án được tối đa bao nhiêu thành viên?"
            style={{ border: "none", outline: "none", boxShadow: "none" }}
            className="border-0 outline-none ring-0 shadow-none focus:ring-0 focus:outline-none bg-transparent resize-none w-full text-sm text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/60 leading-relaxed min-h-[4.6875rem]"
          />
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={busy || !query.trim()}
              className="w-10 h-10 rounded-full bg-[var(--primary)] text-white hover:bg-[#0842A0] active:bg-[#073682] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] cursor-pointer"
              title="Gửi câu hỏi (Enter)"
            >
              {busy ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>

        {/* Dưới ô hỏi: hàng filter-chip "Gợi ý nhanh" */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <span className="text-xs text-[var(--on-surface-variant)] mr-1 flex items-center gap-1 font-medium select-none">
            <IconSparkle size={13} />
            Gợi ý nhanh:
          </span>
          {QUICK_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQueryChange(chip.prompt)}
              className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--outline)]/50 text-xs font-medium text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] transition-colors cursor-pointer shadow-xs"
            >
              {chip.label}
            </button>
          ))}
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
          <div className="bg-[var(--surface)] border border-[var(--outline)]/30 rounded-[var(--radius-lg)] shadow-xs overflow-hidden transition-all">
            {/* Header: 1 line with Badge + sentence case text + subtle case ID */}
            <div className="px-5 py-3.5 border-b border-[var(--outline)]/20 bg-[var(--surface-container-low)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Badge tone={routeTone(result.route)}>
                  {routeLabel(result.route)}
                </Badge>
                <span className="text-sm text-[var(--on-surface)]">
                  {result.applied_exception_id
                    ? "Đã áp dụng ngoại lệ phê duyệt từ giảng viên"
                    : result.route === "ANSWER"
                    ? "Trả lời tự động từ quy chế hiện hành"
                    : result.route === "OUT_OF_SCOPE"
                    ? "Ngoài phạm vi thẩm quyền của môn học"
                    : result.route === "REJECT"
                    ? "Yêu cầu không được chấp thuận theo quy chế"
                    : result.final_decision
                    ? `Giảng viên đã ${result.final_decision === "APPROVED" ? "phê duyệt" : "từ chối"}`
                    : result.route === "ESCALATE"
                    ? "Đã chuyển tiếp cho giảng viên phụ trách"
                    : `Cần bổ sung thông tin (Lượt ${result.clarification_round || 1}/2)`}
                </span>
              </div>
              {result.case_id && (
                <span className="text-xs font-mono text-[var(--on-surface-variant)]">
                  Hồ sơ #{result.case_id}
                </span>
              )}
            </div>

            <div className="p-5 md:p-6 space-y-6">
              {/* Applied Exception Banner if present */}
              {result.applied_exception_id && (
                <div className="p-3.5 bg-[#E8F5E9] border border-[#C8E6C9] rounded-[var(--radius-md)] flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#146C2E] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <IconCheck size={14} />
                  </div>
                  <div className="flex-1 text-xs">
                    <span className="font-semibold text-[#146C2E]">
                      Đã áp dụng ngoại lệ #{result.applied_exception_id}
                    </span>
                    <p className="text-[#146C2E]/90 mt-0.5 leading-relaxed">
                      Câu hỏi này đã được đối chiếu với cơ sở dữ liệu ngoại lệ và tự động áp dụng ngoại lệ được Giảng viên phê duyệt trước đó cho nhóm/môn này.
                    </p>
                  </div>
                </div>
              )}

              {/* 1. Official Conclusion / Decision Block */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-[var(--on-surface)]">
                  {result.route === "ANSWER"
                    ? "Kết luận quy chế chính thức"
                    : result.route === "OUT_OF_SCOPE"
                    ? "Hướng dẫn học vụ ngoài phạm vi môn học"
                    : result.route === "REJECT"
                    ? "Thông báo từ chối yêu cầu"
                    : result.final_decision
                    ? "Quyết định chính thức từ Giảng viên"
                    : result.route === "ESCALATE"
                    ? "Hồ sơ chuyển tiếp Giảng viên phụ trách thụ lý"
                    : `Yêu cầu làm rõ từ hệ thống (Lượt ${result.clarification_round || 1}/2)`}
                </h3>

                {/* Answer box according to route */}
                <div className="p-4 bg-[var(--surface-container)] border border-[var(--outline)]/20 rounded-[var(--radius-md)]">
                  {/* ANSWER route */}
                  {result.route === "ANSWER" && result.answer && (
                    <p className="text-base text-[var(--on-surface)] leading-relaxed">
                      {renderFormattedAnswer(result.answer)}
                    </p>
                  )}

                  {/* OUT_OF_SCOPE route */}
                  {result.route === "OUT_OF_SCOPE" && (
                    <div className="space-y-3">
                      {result.answer && (
                        <p className="text-base text-[var(--on-surface)] leading-relaxed">
                          {result.answer}
                        </p>
                      )}
                      <div className="p-3 bg-[var(--surface)] border border-[var(--outline)]/30 rounded-[var(--radius-sm)] text-xs space-y-1 text-[var(--on-surface-variant)]">
                        <p className="font-medium text-[var(--on-surface)]">
                          Ngoài phạm vi xử lý của môn học
                        </p>
                        <p className="leading-relaxed">
                          Yêu cầu của bạn không thuộc thẩm quyền của Giảng viên hay Quy chế môn học này. Vui lòng liên hệ Phòng Đào tạo, Ban Quản lý Ký túc xá hoặc đơn vị phụ trách liên quan theo hướng dẫn.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* REJECT route */}
                  {result.route === "REJECT" && (
                    <div className="space-y-3">
                      {result.answer && (
                        <p className="text-base text-[var(--on-surface)] leading-relaxed">
                          {result.answer}
                        </p>
                      )}
                      <div className="p-3 bg-[#FFEBEE] border border-[#FFCDD2] rounded-[var(--radius-sm)] text-xs space-y-1 text-[#B3261E]">
                        <p className="font-medium">
                          Thông báo từ chối
                        </p>
                        <p className="leading-relaxed">
                          Nội dung yêu cầu vi phạm chính sách học vụ hoặc không hợp lệ. Hệ thống từ chối yêu cầu và không tạo hồ sơ chuyển tiếp cho giảng viên.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ESCALATE route */}
                  {result.route === "ESCALATE" && (
                    <div className="space-y-3">
                      {result.final_decision ? (
                        <div className="p-4 bg-[#E8F5E9] border border-[#C8E6C9] rounded-[var(--radius-md)] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-[#146C2E]">
                              Quyết định: {result.final_decision === "APPROVED" ? "Đã phê duyệt" : "Đã từ chối"}
                            </span>
                            {result.exception_id && (
                              <span className="font-mono text-xs bg-[#C8E6C9] text-[#146C2E] px-2 py-0.5 rounded font-semibold">
                                Ngoại lệ: #{result.exception_id}
                              </span>
                            )}
                          </div>
                          <p className="text-base text-[var(--on-surface)] leading-relaxed">
                            {result.final_decision_reason || "Giảng viên đã hoàn tất thẩm định hồ sơ."}
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="text-base text-[var(--on-surface)] leading-relaxed">
                            Yêu cầu của bạn thuộc diện <span className="font-medium">ngoại lệ quy chế hoặc vượt thẩm quyền tự động</span> của AI. Hồ sơ đã được chuyển tiếp đến Giảng viên phụ trách môn học và đang chờ xem xét.
                          </p>
                          <div className="p-3.5 bg-[var(--surface)] border border-[var(--outline)]/30 rounded-[var(--radius-sm)] text-xs space-y-1.5 text-[var(--on-surface-variant)]">
                            {result.case_id && (
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-[var(--on-surface)]">Mã hồ sơ thẩm định:</span>
                                <span className="font-mono font-medium text-[var(--on-surface)]">#{result.case_id}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span>Giảng viên thụ lý:</span>
                              <span className="font-medium text-[var(--on-surface)]">
                                {catalog?.lecturer.display_name || "TS. Trần Minh Tuấn"} ({catalog?.lecturer.id || "lecturer-01"})
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Phân luồng:</span>
                              <span className="font-medium text-[var(--on-surface)]">
                                {result.escalation_target || "Giảng viên phụ trách"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Lý do phân luồng:</span>
                              <span className="font-medium text-[var(--on-surface)]">
                                {result.reason_code || "Cần thẩm quyền giảng viên"}
                              </span>
                            </div>
                          </div>

                          {/* Refresh button to check lecturer's decision */}
                          <div className="pt-2 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={handleRefreshQuestion}
                              disabled={refreshing}
                              className="px-3 py-1.5 bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-highest)] text-[var(--on-surface)] text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
                      {conversationTurns.length > 0 && (
                        <div className="space-y-2 border-b border-[var(--outline)]/20 pb-3">
                          <div className="text-xs font-medium text-[var(--on-surface-variant)]">
                            Tiến trình đối thoại bổ sung (Tối đa 2 lượt)
                          </div>
                          {conversationTurns.map((turn, idx) => (
                            <div key={idx} className="p-3 bg-[var(--surface)] border border-[var(--outline)]/30 rounded-[var(--radius-sm)] text-xs space-y-1.5">
                              <div className="flex items-center justify-between text-[var(--on-surface-variant)]">
                                <span className="font-medium">{turn.round === 0 ? "Câu hỏi gốc ban đầu" : `Lượt làm rõ ${turn.round}/2`}</span>
                                {turn.round > 0 && (
                                  <span className="font-mono text-xs">
                                    Vòng {turn.round}
                                  </span>
                                )}
                              </div>
                              {turn.clarifyingQuestion && (
                                <div className="text-[var(--on-surface)] bg-[var(--surface-container)] p-2 rounded border border-[var(--outline)]/20 flex items-start gap-1.5">
                                  <span><b>AI:</b> {turn.clarifyingQuestion}</span>
                                </div>
                              )}
                              {turn.studentResponse && (
                                <div className="text-[var(--on-surface)] bg-[var(--surface-container)] p-2 rounded border border-[var(--outline)]/20 flex items-start gap-1.5">
                                  <span><b>Sinh viên:</b> {turn.studentResponse}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Current clarifying question */}
                      {result.clarifying_question && (
                        <div className="p-3.5 bg-[var(--surface)] border border-[var(--primary)]/30 rounded-[var(--radius-sm)] space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-[var(--primary)]">
                              Câu hỏi làm rõ từ AI:
                            </span>
                            <span className="text-xs font-medium text-[var(--on-surface-variant)]">
                              Lượt {result.clarification_round || 1}/2
                            </span>
                          </div>
                          <p className="text-sm font-medium text-[var(--on-surface)]">
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
                            className="flex-1 px-3.5 py-2 text-xs border border-[var(--outline)]/40 rounded-[var(--radius-sm)] focus:outline-none focus:border-[var(--primary)] bg-[var(--surface)] text-[var(--on-surface)]"
                          />
                          <button
                            type="submit"
                            disabled={clarifyingBusy || !clarificationText.trim()}
                            className="px-4 py-2 bg-[var(--primary)] text-white text-xs font-medium rounded-[var(--radius-sm)] hover:bg-[#0842A0] disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            {clarifyingBusy ? "Đang gửi…" : "Gửi thông tin bổ sung"}
                          </button>
                        </form>
                      ) : (
                        <div className="p-3 bg-[var(--surface-container)] rounded-[var(--radius-sm)] text-xs text-[var(--on-surface-variant)]">
                          Hệ thống đã đạt giới hạn tối đa 2 lượt bổ sung thông tin.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Citations Section */}
              {result.citations && result.citations.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-[var(--on-surface)]">
                      Căn cứ trích dẫn học phần ({result.citations.length})
                    </h4>
                  </div>

                  {/* Citations Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.citations.map((c, i) => (
                      <div
                        key={i}
                        className="p-3.5 bg-[var(--surface-container)] border border-[var(--outline)]/30 rounded-[var(--radius-md)] flex flex-col justify-between text-xs space-y-2"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-[var(--on-surface)] truncate" title={c.document_title}>
                              {c.document_title}
                            </span>
                            <span className="text-xs font-mono text-[var(--on-surface-variant)] shrink-0">
                              {c.label}
                            </span>
                          </div>

                          {c.heading && (
                            <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
                              {c.heading}
                              {c.page_number !== null && c.page_number !== undefined
                                ? ` · Trang ${c.page_number}`
                                : ""}
                            </p>
                          )}

                          {c.quote && (
                            <p className="text-xs text-[var(--on-surface)] italic mt-2 pl-2.5 border-l-2 border-[var(--outline)] line-clamp-3 leading-relaxed">
                              "{c.quote}"
                            </p>
                          )}
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() => setSelectedCitation(c)}
                            className="text-xs font-medium text-[var(--primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Xem thêm điều khoản</span>
                            <IconArrowUpRight size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Escalation Suggestion Banner (Only shown for ANSWER route) */}
              {result.route === "ANSWER" && (
                <div className="p-4 bg-[var(--surface-container)] border border-[var(--outline)]/30 rounded-[var(--radius-md)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-medium text-[var(--on-surface)]">
                      Trường hợp của bạn vượt quá quy chuẩn hoặc có lý do đặc biệt?
                    </h5>
                    <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
                      Hệ thống hỗ trợ tạo hồ sơ ngoại lệ để chuyển trực tiếp Giảng viên phụ trách xem xét và phê duyệt.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleEscalateManually}
                    className="px-3.5 py-2 bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-highest)] text-[var(--on-surface)] text-xs font-medium rounded-[var(--radius-sm)] border border-[var(--outline)]/40 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <span>Chuyển tiếp hồ sơ</span>
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}

              {/* 4. Bottom Utility Bar */}
              <div className="pt-4 border-t border-[var(--outline)]/20 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--on-surface-variant)]">
                <div className="flex items-center gap-2">
                  {onViewHistory && (
                    <button
                      type="button"
                      onClick={() => onViewHistory(result.question_id)}
                      className="px-3.5 py-1.5 bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface)] text-xs font-medium rounded-[var(--radius-sm)] border border-[var(--outline)]/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <IconBookOpen size={13} />
                      <span>Lưu vào Hồ sơ</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleNewQuestion}
                    className="px-3.5 py-1.5 bg-[var(--surface)] hover:bg-[var(--surface-container)] border border-[var(--outline)]/40 text-[var(--on-surface)] text-xs font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                  >
                    + Đặt câu hỏi mới
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {result.case_id && (
                    <span className="font-mono text-xs">
                      Mã hồ sơ: #{result.case_id}
                    </span>
                  )}
                  {currentRequestId && (
                    <div className="flex items-center gap-1 font-mono text-xs text-[var(--on-surface-variant)]">
                      <span>Req: {currentRequestId.slice(0, 8)}...</span>
                      <button
                        type="button"
                        onClick={() => handleCopyRequestId(currentRequestId)}
                        className="p-1 hover:bg-[var(--surface-container)] rounded transition-colors cursor-pointer"
                        title="Sao chép Request ID"
                      >
                        {copiedRequestId ? (
                          <Check size={12} className="text-[#146C2E]" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CARD 4: FOOTER FEEDBACK BAR ── */}
        <div className="px-5 py-3.5 bg-[var(--surface)] border border-[var(--outline)]/30 rounded-[var(--radius-lg)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--on-surface-variant)] shadow-xs">
          <div className="flex items-center gap-2">
            <span>Thông tin phản hồi có hữu ích với bạn không?</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFeedback("up")}
                className={`p-1.5 rounded hover:bg-[var(--surface-container)] transition-colors cursor-pointer ${
                  feedback === "up" ? "text-[#146C2E] bg-[#E8F5E9]" : "text-[var(--on-surface-variant)]"
                }`}
                title="Hữu ích"
              >
                <IconThumbUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => setFeedback("down")}
                className={`p-1.5 rounded hover:bg-[var(--surface-container)] transition-colors cursor-pointer ${
                  feedback === "down" ? "text-[var(--error)] bg-[#FFEBEE]" : "text-[var(--on-surface-variant)]"
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
            className="text-[var(--on-surface-variant)] hover:text-[var(--primary)] font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Cần khiếu nại hoặc chuyển tiếp giảng viên xem xét</span>
            <IconChevronRight size={13} />
          </button>
        </div>

      {/* ── CITATION DETAILS MODAL ── */}
      {selectedCitation && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--outline)]/30 rounded-[var(--radius-lg)] max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--outline)]/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-[var(--primary-container)] text-[var(--primary)] font-mono font-medium text-xs rounded">
                  {selectedCitation.label}
                </span>
                <h4 className="text-sm font-medium text-[var(--on-surface)]">
                  {selectedCitation.document_title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCitation(null)}
                className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors p-1 rounded hover:bg-[var(--surface-container)] cursor-pointer"
                aria-label="Đóng"
              >
                <IconX size={18} />
              </button>
            </div>

            {selectedCitation.heading && (
              <p className="text-xs font-medium text-[var(--on-surface)]">
                Điều khoản: {selectedCitation.heading}
              </p>
            )}

            <div className="p-4 bg-[var(--surface-container)] border border-[var(--outline)]/30 rounded-[var(--radius-md)] text-xs text-[var(--on-surface)] leading-relaxed font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
              {selectedCitation.quote}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCitation(null)}
                className="px-4 py-2 bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-highest)] text-[var(--on-surface)] text-xs font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer"
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
