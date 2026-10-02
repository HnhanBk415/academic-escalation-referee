import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { IconBookOpen, IconCheck, IconRotateCcw, IconWarning, IconX } from "../components/Icons";
import { StatusBadge, type CaseStatus } from "../components/StatusBadge";
import { Stepper } from "../components/Stepper";
import type { DemoCatalog, QuestionResponse } from "../types";

export interface StudentCaseItem {
  id: string;
  rawId?: string;
  title: string;
  topic: string;
  timestamp: string;
  status: CaseStatus;
  question: string;
  group: string;
  aiResponse?: string;
  policyRef?: string;
  citations?: Array<{ label: string; quote: string; document_title: string; section?: string }>;
  escalationReason?: string;
  escalationNote?: string;
  appliedExceptionId?: string | null;
  exceptionId?: string | null;
  finalDecision?: string | null;
  finalDecisionReason?: string | null;
  lecturerDecision?: {
    decision: string;
    reason: string;
    policyRef: string;
    reviewer: string;
    date: string;
  };
}

// Fallback demo cases if database is empty
const INITIAL_DEMO_CASES: StudentCaseItem[] = [
  {
    id: "CASE_3F44",
    title: "Tỷ lệ điểm giữa kỳ, quá trình, báo cáo tổng kết và demo",
    topic: "Đồ án Đa ngành",
    timestamp: "22/09/2026 · 14:32",
    status: "auto_replied",
    group: "DADN-HK242",
    question: "Tỷ lệ điểm giữa kỳ, quá trình, báo cáo tổng kết và demo là bao nhiêu?",
    aiResponse:
      "Tỷ lệ điểm cho môn Đồ án Đa ngành cụ thể như sau: Giữa kỳ chiếm 10%, Quá trình chiếm 10%, Báo cáo tổng kết chiếm 40%, và Demo chiếm 40% [C1].",
    policyRef: "Hướng dẫn chấm bài môn Đồ án Đa ngành HK242",
    citations: [
      {
        label: "C1",
        quote: "Tỷ lệ điểm: Giữa kỳ: 10%, Quá trình: 10%, Báo cáo tổng kết: 40%, Demo: 40%.",
        document_title: "Hướng dẫn chấm bài môn Đồ án Đa ngành",
      },
    ],
  },
  {
    id: "CASE_A1B2",
    title: "Nhóm em xin phép có 6 thành viên được không?",
    topic: "Đồ án Đa ngành",
    timestamp: "22/09/2026 · 09:15",
    status: "pending_lecturer",
    group: "DADN-HK242",
    question: "Nhóm em xin phép có 6 thành viên được không?",
    escalationReason: "OUT_OF_POLICY",
    escalationNote:
      "Yêu cầu ngoại lệ quy chế số lượng thành viên (vượt quá 5 sinh viên) vượt thẩm quyền AI. Hồ sơ đã được chuyển tiếp lên Giảng viên phụ trách xem xét và quyết định.",
  },
  {
    id: "CASE_9C7D",
    title: "Miễn học phần Tiếng Anh học thuật cho sinh viên trao đổi",
    topic: "Chương trình Quốc tế",
    timestamp: "18/09/2026 · 16:45",
    status: "approved",
    group: "Học vụ · Miễn học phần",
    question:
      "Em là sinh viên trao đổi từ National University of Singapore với điểm IELTS 8.0 và đã hoàn thành 2 năm học hoàn toàn bằng tiếng Anh. Nhà trường có cho phép em được miễn học phần Tiếng Anh học thuật bắt buộc không?",
    lecturerDecision: {
      decision: "Phê duyệt — Miễn học phần",
      reason:
        "Sinh viên đáp ứng đủ điều kiện theo Thông tư 08/2024/TT-BGDĐT. Điểm IELTS 8.0 vượt ngưỡng yêu cầu tối thiểu (6.5) và lịch sử học thuật bằng tiếng Anh đã được xác minh qua hệ thống trao đổi sinh viên.",
      policyRef: "Thông tư 08/2024/TT-BGDĐT, Điều 15 — Miễn học phần Ngoại ngữ",
      reviewer: "TS. Trần Minh Tuấn",
      date: "19/09/2026",
    },
  },
];

interface StudentHistoryViewProps {
  initialSelectedId?: string;
  catalog?: DemoCatalog | null;
  selectedCourseId?: string;
  selectedGroupId?: string;
}

export function StudentHistoryView({
  initialSelectedId,
  catalog,
  selectedCourseId,
  selectedGroupId,
}: StudentHistoryViewProps) {
  const [cases, setCases] = useState<StudentCaseItem[]>(INITIAL_DEMO_CASES);
  const [selectedId, setSelectedId] = useState<string>(initialSelectedId || INITIAL_DEMO_CASES[0].id);
  const [filter, setFilter] = useState<"all" | CaseStatus>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append("actor_id", "demo-student");
        if (selectedCourseId) params.append("course_id", selectedCourseId);
        if (selectedGroupId) params.append("group_id", selectedGroupId);
        const queryStr = params.toString() ? `?${params.toString()}` : "";
        const raw = await api<QuestionResponse[]>(`/api/v1/questions${queryStr}`);
        if (Array.isArray(raw)) {
          const mapped: StudentCaseItem[] = raw.map((q) => {
            let status: CaseStatus = "auto_replied";
            if (q.final_decision === "APPROVED") {
              status = "approved";
            } else if (q.final_decision === "REJECTED") {
              status = "rejected";
            } else if (q.route === "OUT_OF_SCOPE" || q.status === "OUT_OF_SCOPE") {
              status = "out_of_scope";
            } else if (q.route === "REJECT" || q.status === "REJECTED" || (q.status as string) === "REJECT") {
              status = "rejected";
            } else if (q.route === "ESCALATE" || q.status === "ESCALATED") {
              status = "pending_lecturer";
            } else if (q.route === "CLARIFY" || q.status === "CLARIFICATION_REQUIRED") {
              status = "clarify";
            } else {
              status = "auto_replied";
            }

            const cleanDate = q.created_at
              ? new Date(q.created_at).toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Hôm nay";

            const displayTitle = q.text
              ? q.text.length > 70
                ? q.text.slice(0, 70) + "..."
                : q.text
              : q.clarifying_question || q.answer?.slice(0, 65) || "Yêu cầu quy chế học vụ";

            const courseObj = catalog?.courses.find((c) => c.id === q.course_id);
            const groupObj = courseObj?.groups.find((g) => g.id === q.group_id);

            return {
              id: q.case_id || q.question_id.replace(/^q_/, "CASE_").slice(0, 9).toUpperCase(),
              rawId: q.question_id,
              title: displayTitle,
              topic: courseObj ? `${courseObj.code} · ${courseObj.name}` : (q.course_id || "Môn học"),
              timestamp: cleanDate,
              status,
              question: q.text || (q.answer ? `Câu hỏi: ${q.question_id}` : "Yêu cầu học vụ từ sinh viên"),
              group: groupObj?.name || q.group_id || "Chưa có nhóm",
              aiResponse: q.answer || undefined,
              policyRef: q.citations?.[0]?.document_title || "Quy chế môn học",
              appliedExceptionId: q.applied_exception_id,
              exceptionId: q.exception_id,
              finalDecision: q.final_decision,
              finalDecisionReason: q.final_decision_reason,
              citations: q.citations?.map((c) => ({
                label: c.label,
                quote: c.quote,
                document_title: c.document_title,
                section: c.heading || (c.page_number ? `Trang ${c.page_number}` : undefined),
              })),
              escalationReason: q.reason_code,
              escalationNote:
                q.route === "ESCALATE"
                  ? `Yêu cầu (${q.reason_code}) vượt thẩm quyền AI hoặc cần xem xét chuyên môn. Hồ sơ đã được chuyển tiếp lên Giảng viên phụ trách.`
                  : undefined,
              lecturerDecision: q.final_decision
                ? {
                    decision: q.final_decision === "APPROVED" ? "Phê duyệt yêu cầu" : "Từ chối yêu cầu",
                    reason: q.final_decision_reason || "Giảng viên đã thẩm định và đưa ra quyết định.",
                    policyRef: q.exception_id ? `Ngoại lệ: #${q.exception_id}` : "Quy chế đào tạo & ngoại lệ áp dụng",
                    reviewer: catalog?.lecturer.display_name || "TS. Trần Minh Tuấn",
                    date: cleanDate.split(" · ")[0],
                  }
                : undefined,
            };
          });

          setCases(mapped);
          if (initialSelectedId) {
            const found = mapped.find(
              (c) =>
                c.id === initialSelectedId ||
                c.rawId === initialSelectedId ||
                c.id.includes(initialSelectedId) ||
                (c.rawId && c.rawId.includes(initialSelectedId))
            );
            if (found) setSelectedId(found.id);
          } else if (mapped.length > 0) {
            setSelectedId(mapped[0].id);
          } else {
            setSelectedId("");
          }
        }
      } catch (e) {
        console.warn("Could not fetch questions from API, using demo data", e);
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [initialSelectedId, selectedCourseId, selectedGroupId, catalog]);

  async function handleRefreshCurrentCase() {
    if (!selected?.rawId) return;
    setRefreshing(true);
    try {
      const q = await api<QuestionResponse>(`/api/v1/questions/${selected.rawId}`);
      setCases((prev) =>
        prev.map((c) => {
          if (c.rawId !== q.question_id) return c;
          let status: CaseStatus = c.status;
          if (q.final_decision === "APPROVED") status = "approved";
          else if (q.final_decision === "REJECTED") status = "rejected";
          return {
            ...c,
            status,
            appliedExceptionId: q.applied_exception_id,
            exceptionId: q.exception_id,
            finalDecision: q.final_decision,
            finalDecisionReason: q.final_decision_reason,
            lecturerDecision: q.final_decision
              ? {
                  decision: q.final_decision === "APPROVED" ? "Phê duyệt yêu cầu" : "Từ chối yêu cầu",
                  reason: q.final_decision_reason || "Giảng viên đã thẩm định và đưa ra quyết định.",
                  policyRef: q.exception_id ? `Ngoại lệ: #${q.exception_id}` : "Quy chế đào tạo",
                  reviewer: catalog?.lecturer.display_name || "TS. Trần Minh Tuấn",
                  date: new Date().toLocaleDateString("vi-VN"),
                }
              : undefined,
          };
        })
      );
    } catch (e) {
      console.warn("Could not refresh question", e);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (initialSelectedId && cases.length > 0) {
      const found = cases.find(
        (c) =>
          c.id === initialSelectedId ||
          c.rawId === initialSelectedId ||
          c.id.includes(initialSelectedId) ||
          (c.rawId && c.rawId.includes(initialSelectedId))
      );
      if (found) setSelectedId(found.id);
    }
  }, [initialSelectedId, cases]);

  const tabs: Array<{ key: "all" | CaseStatus; label: string }> = [
    { key: "all", label: "Tất cả" },
    { key: "auto_replied", label: "AI phản hồi" },
    { key: "pending_lecturer", label: "Chờ giảng viên" },
    { key: "approved", label: "Đã phê duyệt" },
    { key: "out_of_scope", label: "Ngoài phạm vi" },
    { key: "rejected", label: "Bị từ chối" },
    { key: "clarify", label: "Cần bổ sung" },
  ];

  const filtered = cases.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selected = cases.find((c) => c.id === selectedId) || filtered[0] || cases[0];

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {/* Top Header */}
      <div className="px-8 pt-6 pb-4 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hồ sơ câu hỏi học vụ</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Theo dõi tiến độ xử lý và phản hồi từ AI hoặc Giảng viên
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            {cases.length} hồ sơ
          </span>
        </div>

        {/* Search & Filter bar */}
        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm hồ sơ..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#DC2626] focus:bg-white w-56 transition-all"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all whitespace-nowrap ${
                  filter === tab.key
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column (~38%) */}
        <div className="w-[38%] border-r border-slate-200 overflow-y-auto bg-slate-50/50 p-3 space-y-2 flex-shrink-0">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400 text-sm">
              Không tìm thấy hồ sơ phù hợp
            </div>
          )}
          {filtered.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selected?.id === c.id
                  ? "bg-white border-[#DC2626] shadow-sm ring-1 ring-[#DC2626]/20"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-mono text-[11px] font-bold text-slate-400">
                  #{c.id}
                </span>
                <StatusBadge status={c.status} />
              </div>
              <p className="text-sm font-semibold text-slate-800 leading-snug mb-2 line-clamp-2">
                {c.title}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">
                  {c.topic}
                </span>
                <span>{c.timestamp}</span>
                {c.appliedExceptionId && (
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded border border-indigo-200">
                    ✨ Ngoại lệ #{c.appliedExceptionId}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Right Column (~62% - Read Only) */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#F8FAFC]">
          {selected ? (
            <div className="space-y-6 max-w-3xl">
              {/* Header & Refresh */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Chi tiết hồ sơ #{selected.id}</h2>
                  {selected.rawId && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Mã câu hỏi: <span className="font-mono font-semibold text-slate-700">{selected.rawId}</span>
                    </p>
                  )}
                </div>
                {selected.rawId && (
                  <button
                    type="button"
                    onClick={() => void handleRefreshCurrentCase()}
                    disabled={refreshing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                  >
                    <IconRotateCcw size={13} className={refreshing ? "animate-spin" : ""} />
                    {refreshing ? "Đang làm mới..." : "Làm mới kết quả"}
                  </button>
                )}
              </div>

              {/* Applied Exception Banner */}
              {selected.appliedExceptionId && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs shadow-xs">
                  <div className="flex items-center gap-2.5 text-indigo-900">
                    <span className="text-lg">✨</span>
                    <div>
                      <p className="font-bold text-indigo-900">
                        Đã áp dụng ngoại lệ: <span className="font-mono text-indigo-700">#{selected.appliedExceptionId}</span>
                      </p>
                      <p className="text-[11px] text-indigo-700 mt-0.5">
                        Câu hỏi này được tự động bao phủ bởi ngoại lệ quy chế đã lưu trước đó của Giảng viên.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Exception Created Banner */}
              {selected.exceptionId && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs shadow-xs">
                  <span className="text-lg">📜</span>
                  <div>
                    <p className="font-bold text-emerald-900">
                      Đã lưu ngoại lệ mới: <span className="font-mono text-emerald-700">#{selected.exceptionId}</span>
                    </p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Giảng viên đã tạo tiền lệ ngoại lệ quy chế từ hồ sơ này cho các câu hỏi tương tự tiếp theo.
                    </p>
                  </div>
                </div>
              )}

              {/* Stepper */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
                <Stepper status={selected.status} />
              </div>

              {/* 4 Metadata Cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Mã Case", value: `#${selected.id}`, mono: true },
                  { label: "Nhóm", value: selected.group },
                  { label: "Ngày gửi", value: selected.timestamp },
                  {
                    label: "Trạng thái phân luồng",
                    value:
                      selected.status === "auto_replied"
                        ? "AI Xử lý · Hoàn tất"
                        : selected.status === "pending_lecturer"
                        ? "Chuyển tiếp · Chờ thẩm định"
                        : selected.status === "approved"
                        ? "Giảng viên phê duyệt"
                        : selected.status === "rejected"
                        ? "Bị từ chối"
                        : selected.status === "clarify"
                        ? "Cần bổ sung"
                        : "Ngoài phạm vi",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs"
                  >
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">
                      {item.label}
                    </p>
                    <p
                      className={`text-sm text-slate-800 font-medium ${
                        item.mono ? "font-mono font-bold" : ""
                      }`}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Student Question Box */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                  Nội dung câu hỏi của sinh viên
                </h3>
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                  <p className="text-sm text-slate-800 leading-relaxed font-normal">
                    {selected.question}
                  </p>
                </div>
              </div>

              {/* Processing Status Box */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                  Trạng thái xử lý
                </h3>

                {/* Case 1: AI Auto Replied */}
                {selected.status === "auto_replied" && (
                  <div className="p-5 rounded-xl bg-emerald-50/70 border border-emerald-200 shadow-xs space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-emerald-600 flex-shrink-0">
                        <IconCheck size={18} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1.5">
                          AI Phản hồi tự động
                        </p>
                        <p className="text-sm text-emerald-950 leading-relaxed font-medium">
                          {selected.aiResponse}
                        </p>
                        {selected.policyRef && (
                          <div className="mt-3.5 flex items-center gap-1.5 text-xs text-emerald-700 font-medium pt-2 border-t border-emerald-200/60">
                            <IconBookOpen size={13} />
                            <span className="font-mono">{selected.policyRef}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Case 2: Pending Lecturer Escalate */}
                {selected.status === "pending_lecturer" && (
                  <div className="p-5 rounded-xl bg-amber-50/70 border border-amber-200 shadow-xs space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-amber-600 flex-shrink-0">
                        <IconWarning size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">
                          Đã chuyển tiếp lên Giảng viên (Đang chờ thẩm định)
                        </p>
                        <p className="text-sm text-amber-950 leading-relaxed">
                          {selected.escalationNote ||
                            "Yêu cầu vượt thẩm quyền AI. Hồ sơ đã được chuyển tiếp lên Giảng viên phụ trách xem xét."}
                        </p>
                        <p className="mt-2.5 text-xs text-amber-700 font-medium">
                          ⏱️ Thời gian phản hồi dự kiến: Trong vòng 48 giờ làm việc. (Bấm "Làm mới kết quả" ở góc trên để cập nhật khi giảng viên xử lý xong)
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Case 3: Lecturer Approved */}
                {selected.status === "approved" && selected.lecturerDecision && (
                  <div className="p-5 rounded-xl bg-sky-50/70 border border-sky-200 shadow-xs space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-sky-600 flex-shrink-0">
                        <IconCheck size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-bold text-sky-800 uppercase tracking-wider">
                            Quyết định chính thức của Giảng viên
                          </p>
                          <span className="text-xs font-mono text-sky-600">
                            {selected.lecturerDecision.date}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-sky-950 mb-2">
                          {selected.lecturerDecision.decision}
                        </p>
                        <p className="text-sm text-slate-700 leading-relaxed mb-3">
                          {selected.lecturerDecision.reason}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-sky-700 font-medium">
                          <IconBookOpen size={13} />
                          <span className="font-mono">{selected.lecturerDecision.policyRef}</span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-sky-200/60 flex items-center gap-2 text-xs text-slate-500">
                          <span>Ký duyệt bởi:</span>
                          <span className="font-bold text-slate-800">
                            {selected.lecturerDecision.reviewer}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Case 4: Rejected */}
                {selected.status === "rejected" && (
                  <div className="p-5 rounded-xl bg-rose-50/70 border border-rose-200 shadow-xs space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-rose-600 flex-shrink-0">
                        <IconX size={18} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-1.5">
                          Yêu cầu bị từ chối
                        </p>
                        <p className="text-sm text-rose-950 leading-relaxed font-medium">
                          {selected.finalDecisionReason || selected.aiResponse || "Yêu cầu không được chấp thuận theo quy chế hiện hành hoặc giảng viên đã từ chối."}
                        </p>
                        {selected.lecturerDecision && (
                          <div className="mt-3 pt-3 border-t border-rose-200/60 flex items-center gap-2 text-xs text-slate-500">
                            <span>Người từ chối:</span>
                            <span className="font-bold text-slate-800">
                              {selected.lecturerDecision.reviewer}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Case 5: Clarify */}
                {selected.status === "clarify" && (
                  <div className="p-5 rounded-xl bg-purple-50/70 border border-purple-200 shadow-xs space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-purple-600 flex-shrink-0">
                        <IconWarning size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-1">
                          Cần bổ sung thông tin
                        </p>
                        <p className="text-sm text-purple-950 leading-relaxed">
                          Hệ thống đã yêu cầu bổ sung thông tin chi tiết để xử lý câu hỏi này. Bạn có thể quay lại tab "Gửi câu hỏi" để tiếp tục hội thoại.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Case 6: Out of Scope */}
                {selected.status === "out_of_scope" && (
                  <div className="p-5 rounded-xl bg-slate-100 border border-slate-200 shadow-xs space-y-2">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Ngoài phạm vi học vụ môn học
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Câu hỏi không thuộc phạm vi quy chế học vụ môn học được cấu hình.
                    </p>
                  </div>
                )}
              </div>

              {/* Citations List */}
              {selected.citations && selected.citations.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Căn cứ pháp lý & Trích dẫn quy chế ({selected.citations.length})
                  </h3>
                  <div className="space-y-2">
                    {selected.citations.map((c, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                        <div className="flex items-center justify-between text-slate-600 font-semibold mb-1">
                          <span className="font-bold text-slate-800">
                            [{c.label}] {c.document_title}
                          </span>
                          {c.section && (
                            <span className="text-[11px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                              {c.section}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-700 italic border-l-2 border-slate-300 pl-2 mt-1">
                          "{c.quote}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400">Chọn một hồ sơ để xem chi tiết</div>
          )}
        </div>
      </div>
    </div>
  );
}
