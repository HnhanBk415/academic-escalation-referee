import React, { useEffect, useState, useMemo } from "react";
import {
  Inbox,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Check,
  X,
  HelpCircle,
  Forward,
  Clock,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronDown,
} from "lucide-react";
import { api, postJson } from "../api/client";
import { SlaTimer } from "../components/SLATimer";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
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

export function LecturerInboxView({
  reviewerId = "lecturer-01",
  onDecisionMade,
}: LecturerInboxViewProps) {
  const [queue, setQueue] = useState<LecturerQueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [filterTarget, setFilterTarget] = useState<"ALL" | "COURSE_LECTURER">("ALL");
  const [loading, setLoading] = useState(false);
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

  // Maximize state persisted in localStorage
  const [isMaximized, setIsMaximized] = useState<boolean>(() => {
    try {
      return localStorage.getItem("aer_lecturer_maximized") === "true";
    } catch {
      return false;
    }
  });

  const toggleMaximize = () => {
    setIsMaximized((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("aer_lecturer_maximized", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const loadCases = async () => {
    setLoading(true);
    try {
      const summaries = await api<CaseSummary[]>("/api/v1/cases?status=UNDER_REVIEW");
      if (Array.isArray(summaries) && summaries.length > 0) {
        const detailList = await Promise.all(
          summaries.map(async (s) => {
            try {
              const d = await api<CaseDetail>(`/api/v1/cases/${s.id}`);
              const studentDisplayName = d.group_name
                ? `Sinh viên · ${d.group_name}`
                : d.group_id
                ? `Sinh viên · ${d.group_id}`
                : "Sinh viên";
              const item: LecturerQueueItem = {
                id: d.id,
                questionId: d.question_id,
                studentId: d.actor_id || "demo-student",
                studentName: studentDisplayName,
                courseId: d.course_id || "CO3001",
                groupId: d.group_id,
                groupName: d.group_name,
                policyTopic: d.policy_topic,
                escalationTarget: d.escalation_target || "COURSE_LECTURER",
                title: d.decision_question || d.original_question.slice(0, 60),
                topic: d.course_id === "CO3001" ? "Đồ án chuyên ngành" : "Đồ án Đa ngành",
                escalationTag: d.uncertainty_type || "OUT_OF_POLICY",
                submittedAt: new Date(d.created_at).toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                rawCreatedAt: d.created_at,
                slaDueAt: d.sla_due_at,
                slaOverdue: d.sla_due_at ? new Date() > new Date(d.sla_due_at) : false,
                question: d.original_question,
                citations: d.citations ?? [],
              };
              return item;
            } catch {
              return null;
            }
          })
        );
        const validItems = detailList.filter((item): item is LecturerQueueItem => item !== null);
        setQueue(validItems);
      } else {
        setQueue([]);
      }
    } catch {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCases();
  }, []);

  const handleCopyId = (idToCopy: string) => {
    void navigator.clipboard.writeText(idToCopy);
    setCopiedId(idToCopy);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredQueue = useMemo(() => {
    return queue.filter((c) => {
      if (filterTarget === "ALL") return true;
      return c.escalationTarget === filterTarget;
    });
  }, [queue, filterTarget]);

  const selectedCase = useMemo(() => {
    if (!selectedId) return null;
    return filteredQueue.find((c) => c.id === selectedId) || queue.find((c) => c.id === selectedId) || null;
  }, [filteredQueue, queue, selectedId]);

  async function handleConfirmDecision() {
    if (!decision || !selectedCase) return;
    if (!reason.trim()) {
      setMessage("Lỗi: Vui lòng nhập lý do quyết định.");
      return;
    }
    setSubmitting(true);
    setMessage("");

    try {
      let scopeId = selectedCase.groupId || "group-a";
      if (exceptionScope === "STUDENT") {
        scopeId = selectedCase.studentId || "demo-student";
      } else if (exceptionScope === "COURSE") {
        scopeId = selectedCase.courseId || "CO3001";
      }

      const payload: CaseDecisionCreate = {
        reviewer_id: reviewerId,
        decision,
        reason: reason.trim(),
        create_exception: createException && decision === "APPROVED",
        exception:
          createException && decision === "APPROVED"
            ? {
                scope_type: exceptionScope,
                scope_id: scopeId,
                course_id: selectedCase.courseId,
                policy_topic: selectedCase.policyTopic || "GROUP_MEMBERSHIP",
                content:
                  exceptionContent.trim() ||
                  reason.trim() ||
                  "Cho phép ngoại lệ đối với trường hợp được xem xét.",
                valid_from: validFrom,
                valid_until: validUntil,
              }
            : null,
      };

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
      setQueue((prev) => prev.filter((item) => item.id !== selectedCase.id));
      setSelectedId("");
      setDecision(null);
      setReason("");
      setCreateException(false);
      setExceptionContent("");
      onDecisionMade?.();
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
    {
      key: "NEED_MORE_INFO",
      label: "Cần thêm thông tin",
      icon: HelpCircle,
      activeBg: "bg-[#FFF8E1]",
      activeText: "text-[#8C5000]",
      activeBorder: "border-[#FFE082]",
    },
    {
      key: "FORWARDED",
      label: "Chuyển tiếp",
      icon: Forward,
      activeBg: "bg-[#E3F2FD]",
      activeText: "text-[#0B57D0]",
      activeBorder: "border-[#BBDEFB]",
    },
  ];

  // Empty state
  if (!loading && queue.length === 0) {
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
    <div className="flex-1 w-full bg-[var(--surface-dim)] flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* ── TOP TOOLBAR (FILTER PILLS + STATS) ── */}
      <div className="px-4 sm:px-6 py-3 bg-[var(--surface)] border-b border-[var(--outline)]/30 shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterTarget("ALL")}
            className={`h-7 px-3 rounded-[var(--radius-sm)] text-xs font-medium border transition-colors cursor-pointer ${
              filterTarget === "ALL"
                ? "bg-[var(--primary-container)] border-[var(--primary)] text-[var(--primary)] font-semibold"
                : "bg-[var(--surface)] border-[var(--outline)]/40 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]"
            }`}
          >
            Tất cả ({queue.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTarget("COURSE_LECTURER")}
            className={`h-7 px-3 rounded-[var(--radius-sm)] text-xs font-medium border transition-colors cursor-pointer ${
              filterTarget === "COURSE_LECTURER"
                ? "bg-[var(--primary-container)] border-[var(--primary)] text-[var(--primary)] font-semibold"
                : "bg-[var(--surface)] border-[var(--outline)]/40 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]"
            }`}
          >
            Giảng viên phụ trách ({queue.filter((q) => q.escalationTarget === "COURSE_LECTURER").length})
          </button>
        </div>

        <div className="text-xs text-[var(--on-surface-variant)] font-mono">
          {queue.length} hồ sơ chờ duyệt
        </div>
      </div>

      {/* ── MAIN WORKSPACE AREA ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* CASE 1: No case selected → Full-width Gmail list view */}
        {!selectedCase && (
          <div className="flex-1 overflow-y-auto bg-[var(--surface)]">
            {filteredQueue.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedId(c.id);
                  setDecision(null);
                  setReason("");
                  setCreateException(false);
                  setExceptionScope(c.groupId ? "GROUP" : "STUDENT");
                  setExceptionContent("");
                  setMessage("");
                }}
                className="flex items-center h-14 px-4 border-b border-[var(--outline)]/20 hover:bg-[var(--surface-container-high)] transition-colors cursor-pointer select-none group"
              >
                <div className="shrink-0 w-32 flex items-center gap-2">
                  <Badge route={c.escalationTag} className="text-[11px] py-0.5 px-2" />
                </div>
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm font-medium text-[var(--on-surface)] truncate group-hover:text-[var(--primary)] transition-colors">
                    {c.title}
                  </p>
                </div>
                <div className="hidden sm:block shrink-0 w-44 text-xs text-[var(--on-surface-variant)] truncate text-right pr-6">
                  {c.studentName}
                </div>
                <div className="shrink-0 text-xs font-mono text-[var(--on-surface-variant)] text-right w-16">
                  {formatGmailDate(c.rawCreatedAt || c.submittedAt)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CASE 2: Case selected → 2-column or Maximized view */}
        {selectedCase && (
          <>
            {/* Left compact list (~380px) */}
            {!isMaximized && (
              <div className="hidden md:flex w-[380px] shrink-0 border-r border-[var(--outline)]/30 flex-col bg-[var(--surface-dim)] overflow-y-auto p-3 space-y-2">
                {filteredQueue.map((c) => {
                  const isSelected = selectedCase.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(c.id);
                        setDecision(null);
                        setReason("");
                        setCreateException(false);
                        setExceptionScope(c.groupId ? "GROUP" : "STUDENT");
                        setExceptionContent("");
                        setMessage("");
                      }}
                      className={`w-full text-left p-3.5 rounded-[var(--radius-md)] border transition-all ${
                        isSelected
                          ? "bg-[var(--primary-container)]/50 border-[var(--primary)] shadow-xs"
                          : "bg-[var(--surface)] border-[var(--outline)]/30 hover:bg-[var(--surface-container-high)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <Badge route={c.escalationTag} className="text-[11px] py-0.5 px-2" />
                        <span className="text-[11px] text-[var(--on-surface-variant)] font-mono">
                          {formatGmailDate(c.rawCreatedAt || c.submittedAt)}
                        </span>
                      </div>
                      <p
                        className={`text-xs leading-snug line-clamp-2 ${
                          isSelected
                            ? "font-semibold text-[var(--primary)]"
                            : "font-medium text-[var(--on-surface)]"
                        }`}
                      >
                        {c.title}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[var(--on-surface-variant)]">
                        <span className="truncate">{c.studentName}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Right detail & decision panel */}
            <div className="flex-1 overflow-y-auto bg-[var(--surface)] p-6 md:p-8 flex flex-col">
              <div
                className={`w-full ${
                  isMaximized ? "max-w-[760px] mx-auto" : "max-w-3xl"
                } space-y-6 flex-1`}
              >
                {/* Detail Toolbar */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--outline)]/30">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedId("")}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-xl)] bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-xs font-medium text-[var(--on-surface)] transition-colors cursor-pointer"
                      title="Quay lại danh sách"
                    >
                      <ArrowLeft size={14} />
                      <span>Quay lại</span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleMaximize}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-xl)] bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-xs font-medium text-[var(--on-surface)] transition-colors cursor-pointer"
                      title={isMaximized ? "Thu nhỏ" : "Phóng to"}
                    >
                      {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      <span>{isMaximized ? "Thu nhỏ" : "Phóng to"}</span>
                    </button>
                  </div>

                  {selectedCase.slaDueAt && (
                    <div className="text-xs">
                      <SlaTimer dueAt={selectedCase.slaDueAt} compact />
                    </div>
                  )}
                </div>

                {/* Case Info Header */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge route={selectedCase.escalationTag} />
                    <span className="font-mono text-xs font-bold text-[var(--on-surface-variant)]">
                      #{selectedCase.id.slice(0, 8)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(selectedCase.id)}
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--primary)] hover:underline ml-1 cursor-pointer"
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
                  <h2 className="text-base font-normal text-[var(--on-surface)] leading-relaxed">
                    {selectedCase.question}
                  </h2>
                </div>

                {/* Metadata cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Môn học", value: selectedCase.topic },
                    { label: "Sinh viên / Nhóm", value: selectedCase.studentName },
                    { label: "Ngày gửi", value: selectedCase.submittedAt },
                    { label: "Chủ đề quy định", value: selectedCase.policyTopic || "Chung" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="bg-[var(--surface-container)] rounded-[var(--radius-md)] p-3 border border-[var(--outline)]/30"
                    >
                      <p className="text-[11px] text-[var(--on-surface-variant)] mb-0.5">
                        {item.label}
                      </p>
                      <p className="text-xs text-[var(--on-surface)] font-medium truncate">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Citations List if available */}
                {selectedCase.citations && selectedCase.citations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-[var(--on-surface-variant)]">
                      Căn cứ điều khoản liên quan ({selectedCase.citations.length})
                    </p>
                    <div className="space-y-2">
                      {selectedCase.citations.map((c, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-[var(--surface-container)] rounded-[var(--radius-sm)] border border-[var(--outline)]/30 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-[var(--on-surface)] font-medium">
                            <span>{c.document_title}</span>
                            {c.heading && (
                              <span className="font-mono text-[11px] text-[var(--on-surface-variant)]">
                                {c.heading}
                              </span>
                            )}
                          </div>
                          <p className="text-[var(--on-surface-variant)] italic pl-2 border-l-2 border-[var(--outline)]">
                            "{c.quote}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── FORM QUYẾT ĐỊNH (MATERIAL SEGMENTED CONTROL) ── */}
                <div className="pt-4 border-t border-[var(--outline)]/30 space-y-4">
                  <h3 className="text-xs font-medium text-[var(--on-surface-variant)]">
                    Quyết định của Giảng viên (Thẩm định)
                  </h3>

                  {/* 4-way Segmented Button */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                    <Card variant="filled" className="space-y-3 bg-[var(--surface-container)]">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={createException}
                            onChange={(e) => setCreateException(e.target.checked)}
                            className="w-4 h-4 text-[var(--primary)] rounded focus:ring-[var(--primary)] cursor-pointer"
                          />
                          <span className="text-xs font-medium text-[var(--on-surface)]">
                            Lưu tiền lệ ngoại lệ quy chế cho môn học
                          </span>
                        </label>
                        {createException && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#146C2E] border border-[#C8E6C9] font-medium">
                            Tự động áp dụng sau này
                          </span>
                        )}
                      </div>

                      {createException && (
                        <div className="pt-3 border-t border-[var(--outline)]/30 space-y-3">
                          <div>
                            <label className="block text-[11px] font-medium text-[var(--on-surface-variant)] mb-1">
                              Phạm vi áp dụng ngoại lệ
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { scope: "GROUP", label: `Nhóm (${selectedCase.groupName || selectedCase.groupId || "Nhóm"})` },
                                { scope: "STUDENT", label: `Sinh viên (${selectedCase.studentId})` },
                                { scope: "COURSE", label: `Toàn môn (${selectedCase.courseId})` },
                              ].map((item) => (
                                <button
                                  key={item.scope}
                                  type="button"
                                  onClick={() => setExceptionScope(item.scope as "GROUP" | "STUDENT" | "COURSE")}
                                  className={`py-1.5 px-2 rounded-[var(--radius-sm)] border text-xs font-medium text-center transition-all cursor-pointer ${
                                    exceptionScope === item.scope
                                      ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                                      : "bg-[var(--surface)] text-[var(--on-surface-variant)] border-[var(--outline)]/40 hover:bg-[var(--surface-container-high)]"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-[var(--on-surface-variant)] mb-1">
                                Hiệu lực từ
                              </label>
                              <input
                                type="date"
                                value={validFrom}
                                onChange={(e) => setValidFrom(e.target.value)}
                                className="w-full h-9 px-3 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--outline)]/40 text-xs text-[var(--on-surface)]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-[var(--on-surface-variant)] mb-1">
                                Hiệu lực đến
                              </label>
                              <input
                                type="date"
                                value={validUntil}
                                min={validFrom}
                                onChange={(e) => setValidUntil(e.target.value)}
                                className="w-full h-9 px-3 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--outline)]/40 text-xs text-[var(--on-surface)]"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-[var(--on-surface-variant)] mb-1">
                              Nội dung ngoại lệ
                            </label>
                            <textarea
                              rows={2}
                              value={exceptionContent}
                              onChange={(e) => setExceptionContent(e.target.value)}
                              placeholder="Ví dụ: Nhóm được phép có tối đa 6 thành viên."
                              className="w-full p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--outline)]/40 text-xs text-[var(--on-surface)] focus:border-[var(--primary)] focus:outline-none resize-none"
                            />
                          </div>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* Reason Textarea (Bắt buộc) */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--on-surface-variant)] mb-1">
                      Lý do / Căn cứ phán quyết <span className="text-[var(--error)]">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={
                        decision === "REJECTED"
                          ? "Nhập lý do từ chối yêu cầu (bắt buộc)..."
                          : decision === "APPROVED"
                          ? "Nhập căn cứ phê duyệt (bắt buộc)..."
                          : "Nhập thông tin cần làm rõ hoặc chuyển tiếp (bắt buộc)..."
                      }
                      className="w-full p-3 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--outline)]/40 text-xs text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/60 focus:border-[var(--primary)] focus:outline-none resize-none leading-relaxed"
                    />
                  </div>

                  {/* Message Banner */}
                  {message && (
                    <div
                      className={`p-3 rounded-[var(--radius-sm)] text-xs font-medium flex items-center gap-2 ${
                        message.startsWith("Lỗi")
                          ? "bg-[#FFEBEE] border border-[#FFCDD2] text-[var(--error)]"
                          : "bg-[#E8F5E9] border border-[#C8E6C9] text-[var(--success)]"
                      }`}
                    >
                      {message.startsWith("Lỗi") ? (
                        <AlertCircle size={15} className="shrink-0" />
                      ) : (
                        <CheckCircle2 size={15} className="shrink-0" />
                      )}
                      <span>{message}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={handleConfirmDecision}
                    disabled={!decision || submitting || !reason.trim()}
                    className={`w-full h-11 rounded-[var(--radius-xl)] text-xs font-medium transition-colors flex items-center justify-center ${
                      decision && reason.trim() && !submitting
                        ? "bg-[var(--primary)] text-white hover:bg-[#0842A0] cursor-pointer shadow-xs"
                        : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]/50 cursor-not-allowed border border-[var(--outline)]/30"
                    }`}
                  >
                    {submitting ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    ) : null}
                    <span>
                      {submitting
                        ? "Đang gửi quyết định..."
                        : decision
                        ? `Xác nhận: ${decisionOptions.find((d) => d.key === decision)?.label}`
                        : "Chọn một hình thức quyết định"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
