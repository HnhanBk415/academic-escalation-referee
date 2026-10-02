import React, { useEffect, useState } from "react";
import { api, postJson } from "../api/client";
import {
  IconArrowUpRight,
  IconBookOpen,
  IconCheck,
  IconClock,
  IconInfo,
  IconSparkle,
  IconX,
} from "../components/Icons";
import { SlaTimer } from "../components/SLATimer";
import { EscalationTagBadge, type EscalationTag } from "../components/StatusBadge";
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
  escalationTag: EscalationTag;
  submittedAt: string;
  slaDueAt?: string | null;
  slaOverdue: boolean;
  question: string;
  citations: Citation[];
}

type DecisionType = "APPROVED" | "REJECTED" | null;

interface LecturerInboxViewProps {
  reviewerId?: string;
  onDecisionMade?: () => void;
}

export function LecturerInboxView({
  reviewerId = "lecturer-01",
  onDecisionMade,
}: LecturerInboxViewProps) {
  const [queue, setQueue] = useState<LecturerQueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [filterTarget, setFilterTarget] = useState<"ALL" | "COURSE_LECTURER">("ALL");
  const [decision, setDecision] = useState<DecisionType>(null);
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

  useEffect(() => {
    async function loadCases() {
      try {
        const summaries = await api<CaseSummary[]>("/api/v1/cases?status=UNDER_REVIEW");
        if (Array.isArray(summaries) && summaries.length > 0) {
          const detailList = await Promise.all(
            summaries.map(async (s) => {
              try {
                const d = await api<CaseDetail>(`/api/v1/cases/${s.id}`);
                const studentDisplayName = d.group_name
                  ? `Sinh viên demo · ${d.group_name}`
                  : d.group_id
                  ? `Sinh viên demo · ${d.group_id}`
                  : "Sinh viên demo";
                return {
                  id: d.id,
                  questionId: d.question_id,
                  studentId: d.actor_id || "demo-student",
                  studentName: studentDisplayName,
                  courseId: d.course_id || "CO3001",
                  groupId: d.group_id,
                  groupName: d.group_name,
                  policyTopic: d.policy_topic || "GROUP_MEMBERSHIP",
                  escalationTarget: d.escalation_target || "COURSE_LECTURER",
                  title: d.decision_question || d.original_question.slice(0, 60),
                  topic: d.course_id === "CO3001" ? "Đồ án chuyên ngành" : "Đồ án Đa ngành",
                  escalationTag: (d.uncertainty_type as EscalationTag) || "OUT_OF_POLICY",
                  submittedAt: new Date(d.created_at).toLocaleString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  slaDueAt: d.sla_due_at,
                  slaOverdue: d.sla_overdue ?? false,
                  question: d.original_question,
                  citations: d.citations || [],
                } as LecturerQueueItem;
              } catch {
                return null;
              }
            })
          );
          const valid = detailList.filter(Boolean) as LecturerQueueItem[];
          setQueue(valid);
          if (valid.length > 0) {
            setSelectedId(valid[0].id);
          } else {
            setSelectedId("");
          }
        } else {
          setQueue([]);
          setSelectedId("");
        }
      } catch (err) {
        console.warn("Could not load lecturer queue", err);
        setQueue([]);
        setSelectedId("");
      }
    }
    void loadCases();
  }, []);

  const filteredQueue = queue.filter((c) => {
    if (filterTarget === "ALL") return true;
    return c.escalationTarget === filterTarget;
  });

  const selected =
    filteredQueue.find((c) => c.id === selectedId) ||
    filteredQueue[0] ||
    queue.find((c) => c.id === selectedId) ||
    queue[0];

  async function handleConfirmDecision() {
    if (!decision || !selected) return;
    setSubmitting(true);
    setMessage("");

    try {
      let scopeId = selected.groupId || "group-a";
      if (exceptionScope === "STUDENT") {
        scopeId = selected.studentId || "demo-student";
      } else if (exceptionScope === "COURSE") {
        scopeId = selected.courseId || "CO3001";
      }

      const payload: CaseDecisionCreate = {
        reviewer_id: reviewerId,
        decision,
        reason:
          reason.trim() ||
          (decision === "APPROVED"
            ? "Giảng viên phụ trách đã phê duyệt yêu cầu."
            : "Giảng viên từ chối yêu cầu do không đáp ứng quy chuẩn."),
        create_exception: createException && decision === "APPROVED",
        exception:
          createException && decision === "APPROVED"
            ? {
                scope_type: exceptionScope,
                scope_id: scopeId,
                course_id: selected.courseId,
                policy_topic: selected.policyTopic || "GROUP_MEMBERSHIP",
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
        `/api/v1/cases/${selected.id}/decision`,
        payload,
        { "Idempotency-Key": `decision-${selected.id}-${Date.now()}` }
      );

      if (res?.exception_id) {
        setMessage(
          `✓ Đã phê duyệt và lưu ngoại lệ thành công! Mã ngoại lệ: #${res.exception_id}`
        );
      } else if (decision === "APPROVED") {
        setMessage("✓ Đã phê duyệt một lần thành công (không lưu ngoại lệ).");
      } else {
        setMessage("✓ Đã gửi thông báo từ chối yêu cầu.");
      }

      // Remove from active queue
      setQueue((prev) => prev.filter((item) => item.id !== selected.id));
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

  const decisionButtons: Array<{
    key: DecisionType;
    label: string;
    icon: React.ReactNode;
    activeColor: string;
  }> = [
    {
      key: "APPROVED",
      label: "Phê duyệt (Duyệt)",
      icon: <IconCheck size={15} />,
      activeColor: "bg-emerald-600 border-emerald-600 text-white shadow-xs font-bold",
    },
    {
      key: "REJECTED",
      label: "Từ chối",
      icon: <IconX size={15} />,
      activeColor: "bg-rose-600 border-rose-600 text-white shadow-xs font-bold",
    },
  ];


  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {/* Top Header */}
      <div className="px-8 pt-6 pb-4 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hồ sơ học vụ giảng viên</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Review câu hỏi, scope actor và policy evidence trước khi quyết định
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs text-amber-800 font-bold">
              {queue.length} chờ thẩm định
            </span>
          </div>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column (~33%) */}
        <div className="w-[33%] border-r border-slate-200 overflow-y-auto bg-slate-50/50 p-3 space-y-2 flex-shrink-0 flex flex-col">
          {/* Target Filter Pills */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg text-xs font-medium mb-1">
            <button
              type="button"
              onClick={() => setFilterTarget("ALL")}
              className={`flex-1 py-1 px-1 rounded text-center transition-all ${
                filterTarget === "ALL"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tất cả ({queue.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTarget("COURSE_LECTURER")}
              className={`flex-1 py-1 px-1 rounded text-center transition-all ${
                filterTarget === "COURSE_LECTURER"
                  ? "bg-white text-amber-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Giảng viên ({queue.filter((q) => q.escalationTarget === "COURSE_LECTURER").length})
            </button>
          </div>

          {filteredQueue.length === 0 && (
            <div className="text-center py-16 text-slate-400 text-sm font-medium">
              Không có hồ sơ nào phù hợp với bộ lọc
            </div>
          )}
          {filteredQueue.map((c) => (
            <button
              type="button"
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
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selected?.id === c.id
                  ? "bg-white border-[#DC2626] shadow-sm ring-1 ring-[#DC2626]/20"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold text-slate-400">
                    #{c.id}
                  </span>
                  {c.escalationTarget === "POLICY_VIOLATION" ? (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                      Vi phạm
                    </span>
                  ) : c.escalationTarget === "ACADEMIC_AFFAIRS" ? (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                      P. Đào tạo
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                      Giảng viên
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  {c.slaOverdue ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      QUÁ HẠN SLA
                    </span>
                  ) : (
                    <>
                      <IconClock size={12} />
                      <span className="font-mono text-[10px]">
                        {c.slaDueAt ? new Date(c.slaDueAt).toLocaleDateString("vi-VN") : "48h"}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-800 leading-snug mb-2.5 line-clamp-2">
                {c.title}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono font-medium">{c.studentId}</span>
                <span className="text-[11px] text-slate-500">{c.groupName || c.groupId || "Chưa có nhóm"}</span>
                <EscalationTagBadge tag={c.escalationTag} />
              </div>
            </button>
          ))}
        </div>

        {/* Right Column (~67%) */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#F8FAFC]">
          {selected ? (
            <div className="space-y-5 max-w-3xl">
              {/* SLA 48h Timer */}
              <SlaTimer
                isOverdue={selected.slaOverdue}
                dueAt={selected.slaDueAt || undefined}
                key={selected.id}
              />

              {/* Case Summary Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      #{selected.id}
                    </span>
                    {selected.slaOverdue && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-rose-100 text-rose-800 border border-rose-300">
                        ĐÃ QUÁ HẠN SLA
                      </span>
                    )}
                    {selected.escalationTarget === "POLICY_VIOLATION" ? (
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-rose-100 text-rose-800 border border-rose-300">
                        Cảnh báo: Vi phạm quy chế (Auditor / Thanh tra)
                      </span>
                    ) : selected.escalationTarget === "ACADEMIC_AFFAIRS" ? (
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-indigo-100 text-indigo-800 border border-indigo-300">
                        Thẩm quyền: Phòng Đào tạo & CTSV
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-300">
                        Thẩm quyền: Giảng viên phụ trách môn học
                      </span>
                    )}
                  </div>
                  <EscalationTagBadge tag={selected.escalationTag} />
                </div>
                <h2 className="text-base font-bold text-slate-900 leading-snug mb-3">
                  {selected.title}
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  <div className="flex items-center gap-1 font-medium text-slate-700">
                    <span>{selected.studentName}</span>
                    <span>·</span>
                    <span className="font-mono">{selected.studentId}</span>
                  </div>
                  <span>·</span>
                  <span className="font-medium text-slate-600">{selected.topic}</span>
                  <span>·</span>
                  <span>{selected.groupName || selected.groupId || "Chưa có nhóm"}</span>
                  <span>·</span>
                  <span>{selected.submittedAt}</span>
                </div>
              </div>

              {/* Question Content */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                  Nội dung câu hỏi
                </h3>
                <p className="text-sm text-slate-800 leading-relaxed font-normal">
                  {selected.question}
                </p>
              </div>

              {/* AI Referee Insights */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3.5">
                  <span className="text-sky-600">
                    <IconSparkle size={15} />
                  </span>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    AI Referee Insights
                  </h3>
                </div>

                <div className="space-y-3.5">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500 font-medium">Lý do leo thang:</span>
                    <EscalationTagBadge tag={selected.escalationTag} />
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500 font-medium">Chủ đề quy chế (policy_topic):</span>
                    <span className="font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      {selected.policyTopic || "GROUP_MEMBERSHIP"}
                    </span>
                  </div>

                  {selected.citations && selected.citations.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-2">
                        Trích dẫn quy chế liên quan (RAG Citations):
                      </p>
                      <div className="space-y-2">
                        {selected.citations.map((cite, i) => (
                          <div
                            key={i}
                            className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg"
                          >
                            <div className="flex items-center justify-between text-xs font-semibold text-sky-700 mb-1">
                              <div className="flex items-center gap-1.5">
                                <IconBookOpen size={13} />
                                <span>
                                  {cite.document_title} · {cite.heading || cite.label}
                                </span>
                              </div>
                              {cite.page_number !== null && cite.page_number !== undefined && (
                                <span className="text-[11px] text-slate-500 font-mono">
                                  Trang {cite.page_number}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 italic leading-relaxed">
                              "{cite.quote}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 italic">
                      Không tìm thấy điều khoản liên quan trực tiếp trong cơ sở dữ liệu quy chế.
                    </div>
                  )}
                </div>
              </div>

              {/* Lecturer Decision Form */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Quyết định của Giảng viên
                  </h3>
                  <span className="text-xs text-slate-400 font-mono font-medium">
                    Hồ sơ #{selected.id}
                  </span>
                </div>

                {/* 2 Decision Buttons: APPROVED & REJECTED */}
                <div className="grid grid-cols-2 gap-3">
                  {decisionButtons.map((btn) => (
                    <button
                      type="button"
                      key={btn.key}
                      onClick={() => {
                        setDecision(btn.key);
                        if (btn.key === "REJECTED") {
                          setCreateException(false);
                        }
                      }}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm transition-all ${
                        decision === btn.key
                          ? btn.activeColor
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                      }`}
                    >
                      {btn.icon}
                      <span>{btn.label}</span>
                    </button>
                  ))}
                </div>

                {/* APPROVED Options: Duyệt 1 lần vs Duyệt và lưu ngoại lệ */}
                {decision === "APPROVED" && (
                  <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Hình thức phê duyệt
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setCreateException(false)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          !createException
                            ? "bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900">Duyệt một lần</div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                          Không lưu ngoại lệ. Quyết định không được dùng tự động cho câu hỏi sau.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCreateException(true)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          createException
                            ? "bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                          <span>Duyệt và lưu ngoại lệ</span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">Tự động áp dụng</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                          Lưu ngoại lệ vào hệ thống để tự động chấp thuận cho các câu hỏi sau cùng phạm vi.
                        </p>
                      </button>
                    </div>

                    {/* Detailed exception inputs if createException */}
                    {createException && (
                      <div className="pt-3 border-t border-slate-200/80 space-y-3">
                        {/* Scope Selector: GROUP, STUDENT, COURSE */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Phạm vi áp dụng ngoại lệ (Scope Type)
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setExceptionScope("GROUP")}
                              className={`py-2 px-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                                exceptionScope === "GROUP"
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              Theo Nhóm ({selected.groupName || selected.groupId || "Nhóm"})
                            </button>
                            <button
                              type="button"
                              onClick={() => setExceptionScope("STUDENT")}
                              className={`py-2 px-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                                exceptionScope === "STUDENT"
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              Theo Sinh viên ({selected.studentId})
                            </button>
                            <button
                              type="button"
                              onClick={() => setExceptionScope("COURSE")}
                              className={`py-2 px-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                                exceptionScope === "COURSE"
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              Toàn môn ({selected.courseId})
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1.5 font-mono">
                            Mã phạm vi áp dụng (scope_id):{" "}
                            <span className="font-bold text-slate-800">
                              {exceptionScope === "GROUP"
                                ? selected.groupId || "group-a"
                                : exceptionScope === "STUDENT"
                                ? selected.studentId || "demo-student"
                                : selected.courseId}
                            </span>{" "}
                            · Chủ đề:{" "}
                            <span className="font-bold text-slate-800">
                              {selected.policyTopic || "GROUP_MEMBERSHIP"}
                            </span>
                          </p>
                        </div>

                        {/* Date Validity */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Hiệu lực từ ngày (valid_from)
                            </label>
                            <input
                              type="date"
                              value={validFrom}
                              onChange={(e) => setValidFrom(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-600"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Hiệu lực đến ngày (valid_until)
                            </label>
                            <input
                              type="date"
                              value={validUntil}
                              min={validFrom}
                              onChange={(e) => setValidUntil(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-600"
                            />
                          </div>
                        </div>

                        {/* Exception Content */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Nội dung ngoại lệ quy chế (content)
                          </label>
                          <textarea
                            rows={2}
                            value={exceptionContent}
                            onChange={(e) => setExceptionContent(e.target.value)}
                            placeholder="Ví dụ: Nhóm được phép có tối đa 6 thành viên."
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-600"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Reason Textarea */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    {decision === "REJECTED" ? "Lý do từ chối (bắt buộc)" : "Căn cứ quyết định / Ghi chú (reason)"}
                  </label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      decision === "REJECTED"
                        ? "Nhập lý do từ chối yêu cầu (ví dụ: Không đáp ứng điều kiện ngoại lệ của môn học)..."
                        : "Nhập căn cứ chấp thuận (ví dụ: Đồng ý cho nhóm này có tối đa 6 thành viên)..."
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#DC2626] resize-none leading-relaxed"
                  />
                </div>

                {/* Feedback message */}
                {message && (
                  <div
                    className={`p-3 rounded-lg text-xs font-semibold ${
                      message.startsWith("✓")
                        ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                        : "bg-rose-50 border border-rose-200 text-rose-800"
                    }`}
                  >
                    {message}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="button"
                  onClick={handleConfirmDecision}
                  disabled={!decision || submitting || (decision === "REJECTED" && !reason.trim())}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-bold transition-all shadow-sm ${
                    decision && !(decision === "REJECTED" && !reason.trim())
                      ? decision === "APPROVED"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        : "bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                  }`}
                >
                  {submitting
                    ? "Đang gửi quyết định lên hệ thống..."
                    : decision === "APPROVED"
                    ? createException
                      ? "Xác nhận Phê duyệt & Lưu ngoại lệ quy chế"
                      : "Xác nhận Phê duyệt một lần"
                    : decision === "REJECTED"
                    ? "Xác nhận Từ chối yêu cầu"
                    : "Chọn hình thức quyết định"}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 font-medium">
              Không có hồ sơ nào trong hàng chờ thẩm định.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

