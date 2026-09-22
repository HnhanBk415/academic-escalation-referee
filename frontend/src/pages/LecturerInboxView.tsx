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
import type { CaseDetail, CaseSummary } from "../types";

export interface LecturerQueueItem {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  title: string;
  topic: string;
  escalationTag: EscalationTag;
  submittedAt: string;
  slaRemaining: string;
  question: string;
  ragCitations: Array<{ section: string; article: string; text: string }>;
}

const INITIAL_QUEUE: LecturerQueueItem[] = [
  {
    id: "CASE_A1B2",
    studentId: "2110482",
    studentName: "Nguyễn Văn An",
    courseId: "DADN-HK242",
    title: "Nhóm em xin phép có 6 thành viên được không?",
    topic: "Đồ án Đa ngành",
    escalationTag: "OUT_OF_POLICY",
    submittedAt: "22/09/2026 · 09:15",
    slaRemaining: "47:54:40",
    question:
      "Nhóm em hiện tại có 6 bạn cùng định hướng đề tài AI trong học phần Đồ án Đa ngành (DADN-HK242). Chúng em xin phép được đăng ký nhóm 6 người thay vì quy định chuẩn tối đa 5 người có được không?",
    ragCitations: [
      {
        section: "Quy định nhóm đồ án",
        article: "Điều 1, khoản 1",
        text: "Mỗi nhóm đồ án có từ 3 đến 5 sinh viên. Mọi thay đổi thành viên sau khi đăng ký phải được giảng viên phụ trách phê duyệt.",
      },
      {
        section: "Ngoại lệ quy chế môn học",
        article: "Điều 1, khoản 3",
        text: "Nhóm có nhiều hơn 5 sinh viên chỉ được chấp nhận khi có quyết định của giảng viên phụ trách. Quyết định ngoại lệ phải ghi rõ nhóm, thời hạn và lý do.",
      },
    ],
  },
  {
    id: "CASE_5E6F",
    studentId: "2109875",
    studentName: "Lê Thị Phương",
    courseId: "DADN-HK242",
    title: "Gia hạn thời gian nộp báo cáo tổng quan đề tài do sự cố máy chủ",
    topic: "Đồ án Đa ngành",
    escalationTag: "INSUFFICIENT_EVIDENCE",
    submittedAt: "22/09/2026 · 11:30",
    slaRemaining: "44:12:15",
    question:
      "Máy chủ phòng thí nghiệm gặp sự cố mất điện và khôi phục dữ liệu muộn 2 ngày so với kế hoạch. Nhóm em xin phép được gia hạn nộp báo cáo tổng quan thêm 48h.",
    ragCitations: [
      {
        section: "Kế hoạch môn học DADN",
        article: "Mục 4.2",
        text: "Các trường hợp bất khả kháng về cơ sở vật chất cần có xác nhận bằng văn bản của cán bộ phụ trách phòng Lab trước hạn nộp 24h.",
      },
    ],
  },
  {
    id: "CASE_7G8H",
    studentId: "2111234",
    studentName: "Phạm Đức Hải",
    courseId: "CO3001",
    title: "Xét duyệt bảo lưu tiến độ đồ án chuyên ngành sang học kỳ sau",
    topic: "Đồ án chuyên ngành",
    escalationTag: "OUT_OF_POLICY",
    submittedAt: "22/09/2026 · 08:00",
    slaRemaining: "39:58:30",
    question:
      "Em có lịch thực tập toàn thời gian tại doanh nghiệp nước ngoài trong 3 tháng tới. Em muốn xin bảo lưu kết quả đồ án đợt 1 và tiếp tục bảo vệ vào học kỳ tới.",
    ragCitations: [],
  },
];

type DecisionType = "APPROVED" | "REJECTED" | "NEED_MORE_INFO" | "FORWARDED" | null;

interface LecturerInboxViewProps {
  reviewerId?: string;
  onDecisionMade?: () => void;
}

export function LecturerInboxView({
  reviewerId = "lecturer-01",
  onDecisionMade,
}: LecturerInboxViewProps) {
  const [queue, setQueue] = useState<LecturerQueueItem[]>(INITIAL_QUEUE);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_QUEUE[0].id);
  const [decision, setDecision] = useState<DecisionType>(null);
  const [reason, setReason] = useState("");
  const [createException, setCreateException] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadCases() {
      try {
        const summaries = await api<CaseSummary[]>("/api/cases?status=UNDER_REVIEW");
        if (Array.isArray(summaries) && summaries.length > 0) {
          const detailList = await Promise.all(
            summaries.slice(0, 5).map(async (s) => {
              try {
                const d = await api<CaseDetail>(`/api/cases/${s.id}`);
                return {
                  id: d.id,
                  studentId: d.actor_id || "2110482",
                  studentName: d.actor_id === "student-dadn-a1" ? "Lê Văn Cường" : "Nguyễn Văn An",
                  courseId: d.course_id || "DADN-HK242",
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
                  slaRemaining: "47:50:00",
                  question: d.original_question,
                  ragCitations: (d.citations || []).map((c) => ({
                    section: c.document_title || "Quy chế môn học",
                    article: c.heading || c.label,
                    text: c.quote,
                  })),
                } as LecturerQueueItem;
              } catch {
                return null;
              }
            })
          );
          const valid = detailList.filter(Boolean) as LecturerQueueItem[];
          if (valid.length > 0) {
            setQueue(valid);
            setSelectedId(valid[0].id);
          }
        }
      } catch (err) {
        console.warn("Using initial demo queue data", err);
      }
    }
    loadCases();
  }, []);

  const selected = queue.find((c) => c.id === selectedId) || queue[0];

  async function handleConfirmDecision() {
    if (!decision || !selected) return;
    setSubmitting(true);
    setMessage("");

    try {
      const payload = {
        reviewer_id: reviewerId,
        decision,
        reason: reason.trim() || "Giảng viên phụ trách đã phê duyệt và đưa ra quyết định.",
        create_exception: createException && decision === "APPROVED",
        exception:
          createException && decision === "APPROVED"
            ? {
                scope_type: "STUDENT",
                scope_id: selected.studentId,
                course_id: selected.courseId,
                content: reason.trim() || "Chấp thuận ngoại lệ đặc cách theo phê duyệt của Giảng viên.",
                valid_from: "2026-09-01",
                valid_until: "2027-01-31",
              }
            : null,
      };

      await postJson(`/api/cases/${selected.id}/decision`, payload);

      setMessage("✓ Đã gửi thông báo quyết định thành công!");
      // Remove from active queue
      setQueue((prev) => prev.filter((item) => item.id !== selected.id));
      setDecision(null);
      setReason("");
      setCreateException(false);
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
      label: "Phê duyệt",
      icon: <IconCheck size={14} />,
      activeColor: "bg-emerald-600 border-emerald-600 text-white shadow-xs",
    },
    {
      key: "REJECTED",
      label: "Từ chối",
      icon: <IconX size={14} />,
      activeColor: "bg-rose-600 border-rose-600 text-white shadow-xs",
    },
    {
      key: "NEED_MORE_INFO",
      label: "Cần thêm thông tin",
      icon: <IconInfo size={14} />,
      activeColor: "bg-blue-600 border-blue-600 text-white shadow-xs",
    },
    {
      key: "FORWARDED",
      label: "Chuyển tiếp",
      icon: <IconArrowUpRight size={14} />,
      activeColor: "bg-slate-700 border-slate-700 text-white shadow-xs",
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
        <div className="w-[33%] border-r border-slate-200 overflow-y-auto bg-slate-50/50 p-3 space-y-2 flex-shrink-0">
          {queue.length === 0 && (
            <div className="text-center py-16 text-slate-400 text-sm font-medium">
              Không có hồ sơ nào cần thẩm định
            </div>
          )}
          {queue.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => {
                setSelectedId(c.id);
                setDecision(null);
                setReason("");
                setCreateException(false);
                setMessage("");
              }}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selected?.id === c.id
                  ? "bg-white border-[#DC2626] shadow-sm ring-1 ring-[#DC2626]/20"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] font-bold text-slate-400">
                  #{c.id}
                </span>
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <IconClock size={12} />
                  <span className="font-mono">{c.slaRemaining}</span>
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-800 leading-snug mb-2.5 line-clamp-2">
                {c.title}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono font-medium">{c.studentId}</span>
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
              <SlaTimer remaining={selected.slaRemaining} key={selected.id} />

              {/* Case Summary Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex items-start justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-slate-400">
                    #{selected.id}
                  </span>
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

                  {selected.ragCitations && selected.ragCitations.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-2">
                        Trích dẫn quy chế liên quan (RAG):
                      </p>
                      <div className="space-y-2">
                        {selected.ragCitations.map((cite, i) => (
                          <div
                            key={i}
                            className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg"
                          >
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 mb-1">
                              <IconBookOpen size={13} />
                              <span>
                                {cite.section} · {cite.article}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 italic leading-relaxed">
                              "{cite.text}"
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
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Quyết định của Giảng viên
                </h3>

                {/* 4 Decision Buttons */}
                <div className="grid grid-cols-4 gap-2.5">
                  {decisionButtons.map((btn) => (
                    <button
                      type="button"
                      key={btn.key}
                      onClick={() => setDecision(btn.key)}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
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

                {/* Decision Reason Textarea */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Căn cứ quyết định
                  </label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ghi lại căn cứ quyết định hoặc chỉ đạo cho sinh viên..."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]/20 resize-none transition-all leading-relaxed"
                  />
                </div>

                {/* Create Policy Exception Checkbox */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={createException}
                    onChange={(e) => setCreateException(e.target.checked)}
                    className="w-4 h-4 rounded text-[#DC2626] focus:ring-[#DC2626] border-slate-300 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 font-medium">
                    Tạo ngoại lệ chính sách sau khi phê duyệt{" "}
                    <span className="text-slate-400">(Policy Exception)</span>
                  </span>
                </label>

                {/* Submit Feedback */}
                {message && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800">
                    {message}
                  </div>
                )}

                {/* Submit Action */}
                <button
                  type="button"
                  onClick={handleConfirmDecision}
                  disabled={!decision || submitting}
                  className={`w-full py-3 px-4 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                    decision
                      ? "bg-[#DC2626] hover:bg-[#B91C1C] text-white cursor-pointer"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                  }`}
                >
                  {submitting ? "Đang gửi quyết định..." : "Xác nhận & Gửi thông báo"}
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
