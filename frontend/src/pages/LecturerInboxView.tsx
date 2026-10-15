import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Inbox,
  ArrowLeft,
  Check,
  X,
  Copy,
  Maximize2,
  Minimize2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { api, postJson } from "../api/client";
import { SlaTimer } from "../components/SLATimer";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import {
  ReadingToolbar,
  ReadingModeTriggerButton,
  ReadingContainer,
  useReadingMode,
} from "../components/ReadingMode";
import { uncertaintyLabel, uncertaintyTone, policyTopicLabel, groupLabel } from "../utils/labels";
import type { CaseDecisionCreate, CaseDetail, CaseSummary, Citation, DecisionResponse } from "../types";

export interface LecturerQueueItem {
  id: string;
  questionId: string;
  studentId: string;
  studentName: string;
  courseId: string;
  groupId: string | null;
  groupName: string | null;
  policyTopic: string | null;
  escalationTarget?: string | null;
  title: string;
  decisionQuestion: string;
  topic: string;
  escalationTag: string;
  submittedAt: string;
  rawCreatedAt?: string;
  slaDueAt?: string | null;
  slaOverdue: boolean;
  question: string;
  citations: Citation[];
}

export type DecisionType = "APPROVED" | "REJECTED" | "NEED_MORE_INFO" | "FORWARDED";

interface LecturerInboxViewProps {
  reviewerId?: string;
  onDecisionMade?: () => void;
}

function formatGmailDate(dateStr?: string): string {
  if (!dateStr) return "Hôm nay";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  return `${d.getDate()} thg ${d.getMonth() + 1}`;
}

function getShortGroupName(name?: string | null): string {
  if (!name) return "";
  if (name.startsWith("group-")) return groupLabel(name);
  return name.split(" - ")[0].trim();
}

export function LecturerInboxView({
  reviewerId = "lecturer-01",
  onDecisionMade,
}: LecturerInboxViewProps) {
  const navigate = useNavigate();
  const { caseId, questionId } = useParams<{ caseId?: string; questionId?: string }>();
  const currentCaseId = caseId || questionId || "";

  const [queue, setQueue] = useState<LecturerQueueItem[]>([]);
  const [filterTarget, setFilterTarget] = useState<"ALL" | "COURSE_LECTURER">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<DecisionType | null>(null);
  const [reason, setReason] = useState("");
  const [createException, setCreateException] = useState(false);
  const [exceptionScope, setExceptionScope] = useState<"GROUP" | "STUDENT" | "COURSE">("GROUP");
  const [exceptionContent, setExceptionContent] = useState("");
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(() => {
    const value = new Date();
    value.setDate(value.getDate() + 90);
    return value.toISOString().slice(0, 10);
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Detail cache on demand (citations, etc.)
  const [detailCache, setDetailCache] = useState<Record<string, CaseDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);

  const loadCases = async () => {
    setLoading(true);
    setError("");
    try {
      const summaries = await api<CaseSummary[]>("/api/v1/cases?status=UNDER_REVIEW");
      if (Array.isArray(summaries)) {
        const mapped: LecturerQueueItem[] = summaries.map((s) => {
          const studentDisplayName = s.group_name
            ? `Sinh viên · ${getShortGroupName(s.group_name)}`
            : s.group_id
            ? `Sinh viên · ${groupLabel(s.group_id)}`
            : "Sinh viên";
          return {
            id: s.id,
            questionId: s.question_id,
            studentId: s.actor_id || "demo-student",
            studentName: studentDisplayName,
            courseId: s.course_id || "CO3001",
            groupId: s.group_id || null,
            groupName: s.group_name || null,
            policyTopic: s.policy_topic || null,
            escalationTarget: s.escalation_target || "COURSE_LECTURER",
            title: s.original_question || s.decision_question,
            decisionQuestion: s.decision_question,
            topic: s.course_id === "CO3001" ? "Đồ án chuyên ngành" : "Đồ án Đa ngành",
            escalationTag: s.uncertainty_type || "OUT_OF_POLICY",
            submittedAt: new Date(s.created_at).toLocaleString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
            rawCreatedAt: s.created_at,
            slaDueAt: s.sla_due_at,
            slaOverdue: s.sla_overdue || (s.sla_due_at ? new Date() > new Date(s.sla_due_at) : false),
            question: s.original_question || s.decision_question,
            citations: [],
          };
        });
        setQueue(mapped);
      } else {
        setQueue([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải danh sách hồ sơ cần duyệt.");
      setQueue([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCases();
  }, []);

  // Fetch detail on demand when currentCaseId is selected
  useEffect(() => {
    if (!currentCaseId) return;
    if (detailCache[currentCaseId]) return;

    let cancelled = false;
    setDetailLoading(true);
    api<CaseDetail>(`/api/v1/cases/${currentCaseId}`)
      .then((data) => {
        if (!cancelled) {
          setDetailCache((prev) => ({ ...prev, [currentCaseId]: data }));
        }
      })
      .catch((err) => {
        console.warn("Could not load case detail", err);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentCaseId, detailCache]);

  const filteredQueue = useMemo(() => {
    if (filterTarget === "ALL") return queue;
    return queue.filter((item) => item.escalationTarget === filterTarget);
  }, [queue, filterTarget]);

  const selectedCase = useMemo(() => {
    if (!currentCaseId) return null;
    return queue.find((c) => c.id === currentCaseId) || null;
  }, [queue, currentCaseId]);

  const activeDetail = currentCaseId ? detailCache[currentCaseId] : null;
  const citations = activeDetail?.citations ?? [];

  // Reset form inputs when case changes
  useEffect(() => {
    setDecision(null);
    setReason("");
    setCreateException(false);
    setExceptionScope(selectedCase?.groupId ? "GROUP" : "STUDENT");
    setExceptionContent("");
    setMessage("");
  }, [currentCaseId, selectedCase?.groupId]);

  const filteredIds = useMemo(
    () => filteredQueue.map((c) => c.id),
    [filteredQueue]
  );

  const {
    isReadingMode,
    fontSize,
    setFontSize,
    enterReadingMode,
    exitReadingMode,
    handleBackToList,
    handlePrevCase,
    handleNextCase,
    displayIndex,
    totalCount,
    hasPrev,
    hasNext,
  } = useReadingMode({
    currentCaseId,
    filteredIds,
    basePath: "/workspace/inbox",
  });

  const handleCopyId = (idToCopy: string) => {
    void navigator.clipboard.writeText(idToCopy);
    setCopiedId(idToCopy);
    setTimeout(() => setCopiedId(null), 2000);
  };

  async function handleSubmitDecision() {
    if (!selectedCase || !decision) return;

    if (decision === "APPROVED" && createException && !exceptionContent.trim()) {
      setMessage("Vui lòng nhập nội dung ngoại lệ quy chế được cấp.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const payload: CaseDecisionCreate = {
      reviewer_id: reviewerId,
      decision,
      reason: reason.trim() || "Giảng viên xác nhận qua hệ thống AER",
      create_exception: decision === "APPROVED" && createException,
      exception:
        decision === "APPROVED" && createException
          ? {
              scope_type: exceptionScope,
              scope_id:
                exceptionScope === "COURSE"
                  ? selectedCase.courseId
                  : exceptionScope === "GROUP"
                  ? selectedCase.groupId || selectedCase.studentId
                  : selectedCase.studentId,
              course_id: selectedCase.courseId,
              policy_topic: selectedCase.policyTopic || "GENERAL",
              content: exceptionContent.trim(),
              valid_from: validFrom,
              valid_until: validUntil,
            }
          : null,
    };

    try {
      const res = await postJson<DecisionResponse>(
        `/api/v1/cases/${selectedCase.id}/decision`,
        payload,
        { "Idempotency-Key": `decision-${selectedCase.id}-${Date.now()}` }
      );

      if (res?.exception_id) {
        setMessage(`Đã phê duyệt và lưu ngoại lệ thành công! Mã ngoại lệ: #${res.exception_id}`);
      } else if (decision === "APPROVED") {
        setMessage("Đã phê duyệt một lần thành công (không lưu ngoại lệ).");
      } else if (decision === "REJECTED") {
        setMessage("Đã gửi thông báo từ chối yêu cầu.");
      } else {
        setMessage("Đã cập nhật trạng thái hồ sơ thành công.");
      }

      // Remove from active queue
      const remaining = queue.filter((item) => item.id !== selectedCase.id);
      setQueue(remaining);
      setDecision(null);
      setReason("");
      setCreateException(false);
      setExceptionContent("");
      onDecisionMade?.();

      // Automatically select next case (if any)
      const currentIndex = queue.findIndex((item) => item.id === selectedCase.id);
      if (remaining.length > 0) {
        const nextCase = remaining[currentIndex] || remaining[remaining.length - 1];
        navigate(`/workspace/inbox/${nextCase.id}`);
      } else {
        navigate("/workspace/inbox");
      }
    } catch (err) {
      setMessage(`Lỗi: ${err instanceof Error ? err.message : "Không thể gửi quyết định"}`);
    } finally {
      setSubmitting(false);
    }
  }

  // Segmented control items for decision
  const decisionOptions: Array<{
    key: DecisionType;
    label: string;
    icon: React.ComponentType<{ size?: number }>;
    activeBg: string;
    activeText: string;
    activeBorder: string;
  }> = [
    {
      key: "APPROVED",
      label: "Phê duyệt",
      icon: Check,
      activeBg: "bg-[#E8F5E9]",
      activeText: "text-[#146C2E]",
      activeBorder: "border-[#C8E6C9]",
    },
    {
      key: "REJECTED",
      label: "Từ chối",
      icon: X,
      activeBg: "bg-[#FFEBEE]",
      activeText: "text-[#B3261E]",
      activeBorder: "border-[#FFCDD2]",
    },
  ];

  // Empty state when not loading and queue is empty
  if (!loading && !error && queue.length === 0) {
    return (
      <div className="flex-1 w-full bg-[var(--surface-dim)] flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--surface-container)] border border-[var(--outline)]/40 flex items-center justify-center text-[var(--on-surface-variant)] mb-4">
          <Inbox size={32} />
        </div>
        <h2 className="text-lg font-normal text-[var(--on-surface)] mb-1">
          Hàng đợi thẩm định đang trống
        </h2>
        <p className="text-xs text-[var(--on-surface-variant)] max-w-sm mb-6 leading-relaxed">
          Hiện tại không có hồ sơ sinh viên nào cần phê duyệt hoặc xử lý ngoại lệ.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-[var(--surface-dim)] flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── TOP HEADER & TOOLBAR ── */}
      {!isReadingMode && (
        <div data-tour="inbox-filters" className="px-4 sm:px-6 py-3.5 bg-[var(--surface)] border-b border-[var(--outline)]/30 shrink-0 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-normal text-[var(--on-surface)]">
                Câu hỏi cần duyệt
              </h1>
              <p className="text-sm text-[var(--on-surface-variant)] mt-0.5">
                Hàng đợi thẩm định và phê duyệt các câu hỏi học vụ cần can thiệp từ giảng viên
              </p>
            </div>
            <div className="text-sm text-[var(--on-surface-variant)] self-start sm:self-auto">
              {loading ? "–" : queue.length} hồ sơ chờ duyệt
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              type="button"
              onClick={() => setFilterTarget("ALL")}
              className={`h-7 px-3 rounded-[var(--radius-sm)] text-xs font-medium border transition-colors cursor-pointer ${
                filterTarget === "ALL"
                  ? "bg-stone-800 border-stone-800 text-white font-semibold shadow-xs"
                  : "bg-white border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              Tất cả ({loading ? "–" : queue.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTarget("COURSE_LECTURER")}
              className={`h-7 px-3 rounded-[var(--radius-sm)] text-xs font-medium border transition-colors cursor-pointer ${
                filterTarget === "COURSE_LECTURER"
                  ? "bg-stone-800 border-stone-800 text-white font-semibold shadow-xs"
                  : "bg-white border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              Giảng viên phụ trách ({loading ? "–" : queue.filter((q) => q.escalationTarget === "COURSE_LECTURER").length})
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 mx-4 sm:mx-6 my-2 rounded-[var(--radius-md)] border border-[var(--error)]/30 bg-[var(--error)]/10 text-xs text-[var(--error)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadCases()}
            className="px-2.5 py-1 bg-[var(--error)] text-white text-xs font-medium rounded hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer shrink-0"
          >
            <RefreshCw size={11} />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* ── MAIN WORKSPACE AREA ── */}
      <div data-tour="inbox-queue" className="flex-1 flex overflow-hidden">
        {/* CASE 1: No case selected → Full-width Gmail list view */}
        {!selectedCase && (
          <div className="flex-1 overflow-y-auto bg-[var(--surface)]">
            {loading ? (
              /* Skeleton loading 6 rows */
              <div className="divide-y divide-[var(--outline)]/15">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="flex items-center h-16 px-4 gap-3 animate-pulse"
                  >
                    <div className="w-24 h-6 bg-[var(--surface-container-high)] rounded-[var(--radius-sm)] shrink-0" />
                    <div className="flex-1 space-y-2 min-w-0 pr-4">
                      <div className="h-3.5 bg-[var(--surface-container-high)] rounded w-3/4" />
                      <div className="h-2.5 bg-[var(--surface-container-high)] rounded w-1/2" />
                    </div>
                    <div className="hidden sm:block w-28 h-3.5 bg-[var(--surface-container-high)] rounded shrink-0" />
                    <div className="w-12 h-3.5 bg-[var(--surface-container-high)] rounded shrink-0" />
                  </div>
                ))}
              </div>
            ) : filteredQueue.length === 0 ? (
              <div className="text-center py-16 text-xs text-[var(--on-surface-variant)]">
                Không có hồ sơ nào phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              <div>
                {filteredQueue.map((c, idx) => (
                  <div
                    key={c.id}
                    data-tour={idx === 0 ? "inbox-first-row" : undefined}
                    onClick={() => navigate(`/workspace/inbox/${c.id}`)}
                    className="flex items-center min-h-[4rem] py-2.5 px-4 border-b border-[var(--outline)]/20 hover:bg-[var(--surface-container-high)] transition-colors cursor-pointer select-none group gap-3"
                  >
                    <div className="shrink-0 flex items-center">
                      <Badge tone={uncertaintyTone(c.escalationTag)} className="text-xs py-0.5 px-2 shrink-0">
                        {uncertaintyLabel(c.escalationTag)}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-medium text-[var(--on-surface)] truncate group-hover:text-[var(--primary)] transition-colors">
                        {c.title}
                      </p>
                      <p className="text-xs text-[var(--on-surface-variant)] mt-0.5 truncate flex items-center gap-1.5">
                        <span>{c.groupName ? getShortGroupName(c.groupName) : groupLabel(c.groupId)}</span>
                        <span>·</span>
                        <span>{c.topic}</span>
                        {c.policyTopic && (
                          <>
                            <span>·</span>
                            <span>{policyTopicLabel(c.policyTopic)}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-xs font-mono text-[var(--on-surface-variant)] text-right w-16">
                      {formatGmailDate(c.rawCreatedAt || c.submittedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CASE 2: Case selected → 2-column or Maximized view */}
        {selectedCase && (
          <>
            {/* Left compact list (~380px -> 23.75rem), hidden when isReadingMode */}
            {!isReadingMode && (
              <div className="hidden md:flex w-[23.75rem] shrink-0 border-r border-[var(--outline)]/30 flex-col bg-[var(--surface-dim)] overflow-y-auto p-3 space-y-2">
                {filteredQueue.map((c, idx) => {
                  const isSelected = selectedCase.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      data-tour={idx === 0 ? "inbox-first-row" : undefined}
                      onClick={() => navigate(`/workspace/inbox/${c.id}`)}
                      className={`w-full text-left p-3.5 rounded-[var(--radius-md)] border transition-all ${
                        isSelected
                          ? "bg-stone-100 border-stone-400 shadow-xs"
                          : "bg-white border-stone-200/70 hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <Badge tone={uncertaintyTone(c.escalationTag)} className="text-xs py-0.5 px-2 shrink-0">
                          {uncertaintyLabel(c.escalationTag)}
                        </Badge>
                        <span className="text-xs text-[var(--on-surface-variant)] font-mono shrink-0">
                          {formatGmailDate(c.rawCreatedAt || c.submittedAt)}
                        </span>
                      </div>
                      <p
                        className={`text-xs leading-snug line-clamp-2 ${
                          isSelected
                            ? "font-semibold text-stone-900"
                            : "font-medium text-stone-800"
                        }`}
                      >
                        {c.title}
                      </p>
                      <div 
                        className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--on-surface-variant)] truncate"
                        title={c.groupName ? `Sinh viên · ${c.groupName}` : c.studentName}
                      >
                        <span className="truncate">{c.groupName ? getShortGroupName(c.groupName) : groupLabel(c.groupId)}</span>
                        <span>·</span>
                        <span className="truncate">{policyTopicLabel(c.policyTopic)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Right detail & decision panel */}
            <div className={`flex-1 overflow-y-auto bg-[var(--surface)] ${isReadingMode ? "p-0" : "p-6 md:p-8"} flex flex-col`}>
              {isReadingMode && (
                <ReadingToolbar
                  onBackToList={handleBackToList}
                  onExitReadingMode={exitReadingMode}
                  fontSize={fontSize}
                  onFontSizeChange={setFontSize}
                  displayIndex={displayIndex}
                  totalCount={totalCount}
                  onPrevCase={handlePrevCase}
                  onNextCase={handleNextCase}
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                />
              )}

              <div className={`flex-1 flex flex-col ${isReadingMode ? "p-6 md:p-8" : ""}`}>
                <ReadingContainer isReadingMode={isReadingMode} fontSize={fontSize}>
                  {/* Detail Toolbar */}
                  {!isReadingMode && (
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--outline)]/30">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => navigate("/workspace/inbox")}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-xl)] bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-xs font-medium text-[var(--on-surface)] transition-colors cursor-pointer"
                          title="Quay lại danh sách"
                        >
                          <ArrowLeft size={14} />
                          <span>Quay lại</span>
                        </button>

                        <ReadingModeTriggerButton onClick={enterReadingMode} />
                      </div>

                      {selectedCase.slaDueAt && (
                        <div data-tour="inbox-sla" className="text-xs">
                          <SlaTimer dueAt={selectedCase.slaDueAt} compact />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Case Info Header */}
                  <div className={isReadingMode ? "max-w-[68ch] mx-auto w-full space-y-2" : "space-y-1.5"}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone={uncertaintyTone(selectedCase.escalationTag)}>
                        {uncertaintyLabel(selectedCase.escalationTag)}
                      </Badge>
                      <span className="font-mono text-xs font-semibold text-[var(--on-surface-variant)]">
                        #{selectedCase.id.slice(0, 8)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyId(selectedCase.id)}
                        className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline ml-1 cursor-pointer"
                        title="Sao chép ID đầy đủ"
                      >
                        {copiedId === selectedCase.id ? (
                          <>
                            <Check size={12} className="text-[var(--success)]" />
                            <span className="text-[var(--success)] font-medium">Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Mã đầy đủ</span>
                          </>
                        )}
                      </button>
                    </div>
                    <h2
                      className={`font-normal text-[var(--on-surface)] ${
                        isReadingMode
                          ? fontSize === "lg"
                            ? "text-3xl sm:text-[2rem] leading-tight"
                            : fontSize === "sm"
                            ? "text-2xl leading-snug"
                            : "text-2xl sm:text-[1.75rem] leading-snug"
                          : "text-base leading-relaxed"
                      }`}
                    >
                      {selectedCase.question}
                    </h2>
                  </div>

                  {/* Decision Question from System / Referee */}
                  {selectedCase.decisionQuestion && (
                    <div className={`p-3 bg-[var(--surface-container)] rounded-[var(--radius-md)] border border-[var(--outline)]/30 text-xs space-y-1 ${isReadingMode ? "max-w-[68ch] mx-auto w-full" : ""}`}>
                      <span className="text-[var(--on-surface-variant)] block font-medium">
                        Yêu cầu thẩm định chuyển cấp:
                      </span>
                      <p className={isReadingMode ? "text-[var(--on-surface)] text-[length:var(--reading-font-size)] leading-[1.75]" : "text-xs text-[var(--on-surface)] leading-relaxed"}>
                        {selectedCase.decisionQuestion}
                      </p>
                    </div>
                  )}

                {/* Metadata cards */}
                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${isReadingMode ? "max-w-[64rem] mx-auto w-full" : ""}`}>
                  {[
                    { label: "Môn học", value: selectedCase.topic, fullValue: selectedCase.topic },
                    { 
                      label: "Sinh viên / Nhóm", 
                      value: selectedCase.groupName 
                        ? `${selectedCase.studentId} · ${getShortGroupName(selectedCase.groupName)}`
                        : selectedCase.groupId
                        ? `${selectedCase.studentId} · ${groupLabel(selectedCase.groupId)}`
                        : selectedCase.studentName,
                      fullValue: selectedCase.groupName 
                        ? `${selectedCase.studentId} · ${selectedCase.groupName}`
                        : selectedCase.groupId
                        ? `${selectedCase.studentId} · ${groupLabel(selectedCase.groupId)}`
                        : selectedCase.studentName,
                    },
                    { label: "Ngày gửi", value: selectedCase.submittedAt, fullValue: selectedCase.submittedAt },
                    { 
                      label: "Chủ đề quy định", 
                      value: policyTopicLabel(selectedCase.policyTopic), 
                      fullValue: policyTopicLabel(selectedCase.policyTopic) 
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="bg-[var(--surface-container)] rounded-[var(--radius-md)] p-3 border border-[var(--outline)]/30"
                      title={item.fullValue}
                    >
                      <p className="text-xs text-[var(--on-surface-variant)] mb-0.5">
                        {item.label}
                      </p>
                      <p className="text-xs text-[var(--on-surface)] font-medium truncate">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Citations List if available */}
                {detailLoading ? (
                  <div className={`space-y-2 animate-pulse ${isReadingMode ? "max-w-[68ch] mx-auto w-full" : ""}`}>
                    <div className="h-4 bg-[var(--surface-container-high)] rounded w-48" />
                    <div className="h-16 bg-[var(--surface-container)] rounded-[var(--radius-sm)]" />
                  </div>
                ) : citations.length > 0 ? (
                  <div data-tour="inbox-citations" className={`space-y-2 ${isReadingMode ? "max-w-[68ch] mx-auto w-full" : ""}`}>
                    <p className="text-xs font-medium text-[var(--on-surface-variant)]">
                      Căn cứ điều khoản liên quan ({citations.length})
                    </p>
                    <div className="space-y-2">
                      {citations.map((c, idx) => (
                        <div
                          key={idx}
                          className={`p-3 bg-[var(--surface-container)] ${
                            isReadingMode
                              ? "border-l-4 border-l-[var(--outline)]/60 rounded-none border-y-0 border-r-0"
                              : "rounded-[var(--radius-sm)] border border-[var(--outline)]/30"
                          } text-xs space-y-1`}
                        >
                          <div className="flex items-center justify-between text-[var(--on-surface)] font-medium">
                            <span>{c.document_title}</span>
                            {c.heading && (
                              <span className="font-mono text-xs text-[var(--on-surface-variant)]">
                                {c.heading}
                              </span>
                            )}
                          </div>
                          <p className={
                            isReadingMode
                              ? "text-[var(--on-surface)] text-[length:var(--reading-font-size)] leading-[1.75] pt-1"
                              : "text-[var(--on-surface-variant)] italic pl-2 border-l-2 border-[var(--outline)]"
                          }>
                            "{c.quote}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* ── FORM QUYẾT ĐỊNH (MATERIAL SEGMENTED CONTROL) ── */}
                <div data-tour="inbox-decision" className={`pt-4 border-t border-[var(--outline)]/30 space-y-4 ${isReadingMode ? "max-w-[68ch] mx-auto w-full" : ""}`}>
                  <h3 className="text-xs font-medium text-[var(--on-surface-variant)]">
                    Quyết định của Giảng viên (Thẩm định)
                  </h3>

                  {/* 2-way Decision Segmented Button */}
                  <div className="grid grid-cols-2 gap-3">
                    {decisionOptions.map((opt) => {
                      const IconComponent = opt.icon;
                      const isSelected = decision === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setDecision(opt.key);
                            if (opt.key !== "APPROVED") {
                              setCreateException(false);
                            }
                          }}
                          className={`flex items-center justify-center gap-2 h-11 px-3 rounded-[var(--radius-md)] border text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? `${opt.activeBg} ${opt.activeText} ${opt.activeBorder} font-semibold shadow-xs`
                              : "bg-[var(--surface-container)] border-[var(--outline)]/40 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--on-surface)]"
                          }`}
                        >
                          <IconComponent size={15} />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Collapsible Card: Tạo ngoại lệ (chỉ khi APPROVED) */}
                  {decision === "APPROVED" && (
                    <Card data-tour="inbox-exception" variant="filled" className="space-y-3 bg-[var(--surface-container)]">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={createException}
                            onChange={(e) => setCreateException(e.target.checked)}
                            className="w-4 h-4 rounded border-[var(--outline)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                          />
                          <span className="text-xs font-medium text-[var(--on-surface)]">
                            Ban hành ngoại lệ quy chế chính thức
                          </span>
                        </label>
                        <span className="text-xs text-[var(--on-surface-variant)]">
                          Tự động áp dụng cho các câu hỏi tương tự về sau
                        </span>
                      </div>

                      {createException && (
                        <div className="space-y-3 pt-2 border-t border-[var(--outline)]/20">
                          <div>
                            <label className="block text-xs font-medium text-[var(--on-surface-variant)] mb-1">
                              Phạm vi áp dụng ngoại lệ
                            </label>
                            <div className="flex gap-2">
                              {(["GROUP", "STUDENT", "COURSE"] as const).map((scope) => (
                                <button
                                  key={scope}
                                  type="button"
                                  onClick={() => setExceptionScope(scope)}
                                  className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium border transition-colors cursor-pointer ${
                                    exceptionScope === scope
                                      ? "bg-stone-800 border-stone-800 text-white font-medium shadow-xs"
                                      : "bg-white border-stone-200 text-stone-700 hover:bg-stone-100"
                                  }`}
                                >
                                  {scope === "GROUP"
                                    ? "Theo nhóm"
                                    : scope === "STUDENT"
                                    ? "Cá nhân sinh viên"
                                    : "Toàn khóa / Toàn môn"}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[var(--on-surface-variant)] mb-1">
                              Nội dung điều khoản ngoại lệ được cấp *
                            </label>
                            <textarea
                              value={exceptionContent}
                              onChange={(e) => setExceptionContent(e.target.value)}
                              placeholder="Mô tả cụ thể điều khoản ngoại lệ được áp dụng..."
                              rows={2}
                              className="w-full text-xs p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--outline)]/40 text-[var(--on-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-[var(--on-surface-variant)] mb-1">
                                Hiệu lực từ ngày
                              </label>
                              <input
                                type="date"
                                value={validFrom}
                                onChange={(e) => setValidFrom(e.target.value)}
                                className="w-full text-xs p-2 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--outline)]/40 text-[var(--on-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[var(--on-surface-variant)] mb-1">
                                Đến ngày
                              </label>
                              <input
                                type="date"
                                value={validUntil}
                                onChange={(e) => setValidUntil(e.target.value)}
                                className="w-full text-xs p-2 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--outline)]/40 text-[var(--on-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* Lý do / Ghi chú phán quyết */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--on-surface-variant)] mb-1">
                      Lý do / Căn cứ phán quyết <span className="text-[var(--error)]">*</span>
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Nhập thông tin căn làm rõ hoặc chuyển tiếp (bắt buộc)..."
                      rows={2}
                      className="w-full text-xs p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-container)] border border-[var(--outline)]/40 text-[var(--on-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)] resize-none transition-colors"
                    />
                  </div>

                  {/* Thông báo kết quả thao tác */}
                  {message && (
                    <div className="p-3 bg-[var(--surface-container)] rounded-[var(--radius-sm)] text-xs text-[var(--on-surface)] border border-[var(--outline)]/30">
                      {message}
                    </div>
                  )}

                  {/* Nút hành động Submit */}
                  <div className="pt-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => void handleSubmitDecision()}
                      disabled={!decision || submitting}
                      className="w-full sm:w-auto px-6 h-10 rounded-[var(--radius-xl)] bg-[var(--primary)] text-white text-xs font-medium hover:bg-[#0842A0] active:bg-[#073682] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
                    >
                      {submitting
                        ? "Đang gửi quyết định..."
                        : decision
                        ? `Xác nhận ${
                            decision === "APPROVED"
                              ? "Phê duyệt"
                              : decision === "REJECTED"
                              ? "Từ chối"
                              : decision === "NEED_MORE_INFO"
                              ? "Yêu cầu bổ sung"
                              : "Chuyển tiếp"
                          }`
                        : "Chọn một hình thức quyết định"}
                    </button>
                  </div>
                </div>
              </ReadingContainer>
            </div>
          </div>
        </>
        )}
      </div>
    </div>
  );
}
