import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Search,
  ArrowLeft,
  Maximize2,
  Minimize2,
  RotateCcw,
  Copy,
  Check,
  HelpCircle,
  Clock,
  BookOpen,
  Sparkles,
  Scroll,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Shield,
  ClipboardList,
} from "lucide-react";
import { api } from "../api/client";
import { Badge } from "../components/ui/Badge";
import { PageHeader } from "../components/ui";
import { Stepper } from "../components/Stepper";
import {
  ReadingToolbar,
  ReadingModeTriggerButton,
  ReadingContainer,
  useReadingMode,
} from "../components/ReadingMode";
import { studentCaseStatusLabel, studentCaseStatusTone, groupLabel, uncertaintyLabel } from "../utils/labels";
import type { DemoCatalog, QuestionResponse } from "../types";

export type CaseStatus =
  | "auto_replied"
  | "pending_lecturer"
  | "approved"
  | "clarify"
  | "out_of_scope"
  | "rejected";

export interface StudentCaseItem {
  id: string;
  rawId: string;
  title: string;
  topic: string;
  timestamp: string;
  rawCreatedAt?: string;
  status: CaseStatus;
  route?: string;
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

interface StudentHistoryViewProps {
  actorId?: string;
  catalog?: DemoCatalog | null;
  selectedCourseId?: string;
  selectedGroupId?: string;
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

export function StudentHistoryView({
  actorId,
  catalog,
  selectedCourseId,
  selectedGroupId,
}: StudentHistoryViewProps) {
  const navigate = useNavigate();
  const { questionId: currentQuestionId } = useParams<{ questionId?: string }>();

  const [cases, setCases] = useState<StudentCaseItem[]>([]);
  const [filter, setFilter] = useState<"all" | CaseStatus>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      // Use dynamic actor_id
      params.append("actor_id", actorId || "student-a1");
      if (selectedCourseId) params.append("course_id", selectedCourseId);
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
          } else if (
            q.route === "REJECT" ||
            q.status === "REJECTED" ||
            (q.status as string) === "REJECT"
          ) {
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
            ? q.text.length > 75
              ? q.text.slice(0, 75) + "..."
              : q.text
            : q.clarifying_question || q.answer?.slice(0, 65) || "Yêu cầu quy chế học vụ";

          const courseObj = catalog?.courses.find((c) => c.id === q.course_id);
          const groupObj = courseObj?.groups.find((g) => g.id === q.group_id);

          return {
            id: q.case_id || q.question_id.replace(/^q_/, "").slice(0, 6).toUpperCase(),
            rawId: q.question_id,
            title: displayTitle,
            topic: courseObj
              ? `${courseObj.code} · ${courseObj.name}`
              : q.course_id || "Môn học",
            timestamp: cleanDate,
            rawCreatedAt: q.created_at,
            status,
            route: q.route,
            question: q.text || "Yêu cầu học vụ từ sinh viên",
            group: groupObj?.name ? groupObj.name.split(" - ")[0] : groupLabel(q.group_id, catalog),
            aiResponse: q.answer || undefined,
            policyRef: q.citations?.[0]?.document_title || "Quy chế môn học",
            appliedExceptionId: q.applied_exception_id,
            exceptionId: q.exception_id,
            finalDecision: q.final_decision,
            finalDecisionReason: q.final_decision_reason,
            citations: q.citations,
            escalationReason: q.reason_code,
            escalationNote: q.uncertainty_type
              ? `Lý do chuyển tiếp: ${uncertaintyLabel(q.uncertainty_type)}. Hồ sơ đã chuyển tiếp lên Giảng viên phụ trách xem xét.`
              : undefined,
            lecturerDecision: q.final_decision
              ? {
                  decision:
                    q.final_decision === "APPROVED"
                      ? "Phê duyệt yêu cầu"
                      : "Từ chối yêu cầu",
                  reason:
                    q.final_decision_reason ||
                    "Đã được Giảng viên phụ trách thẩm định và phán quyết.",
                  policyRef: q.citations?.[0]?.document_title || "Quy chế học phần",
                  reviewer: "TS. Trần Minh Tuấn",
                  date: cleanDate,
                }
              : undefined,
          };
        });
        setCases(mapped);
      } else {
        setCases([]);
      }
    } catch (err) {
      console.warn("Could not load questions history", err);
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [actorId, selectedCourseId]);

  const handleRefreshCurrentCase = async () => {
    if (!currentQuestionId) return;
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyId = (idToCopy: string) => {
    void navigator.clipboard.writeText(idToCopy);
    setCopiedId(idToCopy);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchFilter = filter === "all" || c.status === filter;
      const matchSearch =
        !search.trim() ||
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.question.toLowerCase().includes(search.toLowerCase()) ||
        c.id.toLowerCase().includes(search.toLowerCase()) ||
        c.rawId.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [cases, filter, search]);

  const selectedCase = useMemo(() => {
    if (!currentQuestionId) return null;
    return (
      cases.find((c) => c.rawId === currentQuestionId || c.id === currentQuestionId) || null
    );
  }, [cases, currentQuestionId]);

  // Counts for filter chips
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: cases.length,
      auto_replied: 0,
      pending_lecturer: 0,
      approved: 0,
      out_of_scope: 0,
      rejected: 0,
      clarify: 0,
    };
    for (const c of cases) {
      if (counts[c.status] !== undefined) {
        counts[c.status]++;
      }
    }
    return counts;
  }, [cases]);

  const filteredIds = useMemo(
    () => filteredCases.map((c) => c.rawId),
    [filteredCases]
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
    currentCaseId: currentQuestionId,
    filteredIds,
    basePath: "/workspace/history",
  });

  const filterTabs: Array<{ key: "all" | CaseStatus; label: string }> = [
    { key: "all", label: "Tất cả" },
    { key: "auto_replied", label: studentCaseStatusLabel("auto_replied") },
    { key: "pending_lecturer", label: studentCaseStatusLabel("pending_lecturer") },
    { key: "approved", label: studentCaseStatusLabel("approved") },
    { key: "out_of_scope", label: studentCaseStatusLabel("out_of_scope") },
    { key: "rejected", label: studentCaseStatusLabel("rejected") },
    { key: "clarify", label: studentCaseStatusLabel("clarify") },
  ];

  // ── Render List Item Component ──
  const renderListItem = (c: StudentCaseItem, isCompact: boolean, isFirst = false) => {
    const isSelected = selectedCase?.rawId === c.rawId;

    if (isCompact) {
      // 2-row layout in compact left column
      return (
        <button
          key={c.rawId}
          type="button"
          data-tour={isFirst ? "history-first-row" : undefined}
          onClick={() => navigate(`/workspace/history/${c.rawId}`)}
          className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
            isSelected
              ? "bg-rose-100/70 border-ruby-700 shadow-xs"
              : "bg-white border-rose-100 hover:bg-rose-50/60"
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <Badge tone={studentCaseStatusTone(c.status)} className="text-xs py-0.5 px-2">
              {studentCaseStatusLabel(c.status)}
            </Badge>
            <span className="text-xs text-stone-500 font-mono">
              {formatGmailDate(c.rawCreatedAt || c.timestamp)}
            </span>
          </div>
          <p
            className={`text-xs leading-snug line-clamp-2 ${
              isSelected
                ? "font-semibold text-ruby-800"
                : "font-medium text-stone-800"
            }`}
          >
            {c.title}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-stone-500">
            <span className="truncate">{c.topic}</span>
          </div>
        </button>
      );
    }

    // Single-line Gmail email style row
    return (
      <div
        key={c.rawId}
        data-tour={isFirst ? "history-first-row" : undefined}
        onClick={() => navigate(`/workspace/history/${c.rawId}`)}
        className="flex items-center h-14 px-4 border-b border-rose-100 hover:bg-rose-50/50 transition-colors cursor-pointer select-none group"
      >
        <div className="shrink-0 w-36">
          <Badge tone={studentCaseStatusTone(c.status)} className="text-xs py-0.5 px-2">
            {studentCaseStatusLabel(c.status)}
          </Badge>
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-sm font-medium text-stone-900 truncate group-hover:text-ruby-700 transition-colors">
            {c.title}
          </p>
        </div>
        <div className="hidden sm:block shrink-0 w-44 text-xs text-stone-500 truncate text-right pr-6" title={c.topic}>
          {c.topic}
        </div>
        <div className="shrink-0 text-xs font-mono text-stone-500 text-right w-16">
          {formatGmailDate(c.rawCreatedAt || c.timestamp)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 w-full bg-white flex flex-col min-h-[calc(100vh-6rem)] rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
      {!loading && cases.length === 0 ? (
            <div className="flex-1 w-full bg-[#faf7f8] flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-ruby-700 mb-4">
                <HelpCircle size={32} />
              </div>
              <h2 className="text-lg font-bold text-stone-900 mb-1">
                Bạn chưa gửi câu hỏi nào
              </h2>
              <p className="text-xs text-stone-600 max-w-sm mb-6 leading-relaxed">
                Mọi thắc mắc về quy định, thời hạn hoặc xin ngoại lệ sẽ được lưu lại trong hồ sơ để theo dõi tiến độ.
              </p>
              <button
                type="button"
                onClick={() => navigate("/workspace/ask")}
                className="h-10 px-5 rounded-xl bg-ruby-700 text-white hover:bg-ruby-800 text-sm font-semibold transition-colors shadow-xs cursor-pointer"
              >
                Đặt câu hỏi đầu tiên
              </button>
            </div>
          ) : (
            <div className="flex-1 w-full bg-[#faf7f8] flex flex-col overflow-hidden">
              {/* TOP TOOLBAR (SEARCH + FILTER CHIPS) */}
              {!isReadingMode && (
                <div className="px-4 sm:px-6 py-3.5 bg-white border-b border-rose-100 shrink-0 space-y-3">
                  <PageHeader
                    title="Hồ sơ câu hỏi"
                    description="Lịch sử các câu hỏi, kết quả đối soát quy chế và tiến độ giải quyết"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Search bar */}
                    <div data-tour="history-search" className="relative flex-1 max-w-lg">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Search size={16} />
                      </div>
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Tìm kiếm nội dung thắc mắc, mã hồ sơ..."
                        className="w-full h-10 pl-10 pr-4 rounded-xl bg-rose-50/40 border border-rose-200/80 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-ruby-600 focus:bg-white transition-all"
                      />
                    </div>

                    <div className="text-sm text-stone-600 font-medium">
                      {filteredCases.length} / {cases.length} hồ sơ
                    </div>
                  </div>

                  {/* Status Filter Chips with Counts */}
                  <div data-tour="history-filters" className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {filterTabs.map((tab) => {
                      const count = filterCounts[tab.key] || 0;
                      const isSelected = filter === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setFilter(tab.key)}
                          className={`h-7 px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? "bg-rose-100 border-rose-300 text-ruby-800 shadow-xs"
                              : "bg-white border-stone-200 text-stone-600 hover:bg-rose-50/60"
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span
                            className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                              isSelected
                                ? "bg-ruby-700 text-white"
                                : "bg-stone-100 text-stone-600"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MAIN WORKSPACE AREA */}
              <div data-tour="history-list" className="flex-1 flex overflow-hidden">
                {/* CASE 1: No question selected */}
                {!selectedCase && (
                  <div className="flex-1 overflow-y-auto bg-white">
                    {filteredCases.length === 0 ? (
                      <div className="text-center py-20 text-xs text-stone-500">
                        Không tìm thấy câu hỏi phù hợp với bộ lọc
                      </div>
                    ) : (
                      <div>{filteredCases.map((c, idx) => renderListItem(c, false, idx === 0))}</div>
                    )}
                  </div>
                )}

                {/* CASE 2: Question selected */}
                {selectedCase && (
                  <>
                    {!isReadingMode && (
                      <div className="hidden md:flex w-[23.75rem] shrink-0 border-r border-rose-100 flex-col bg-stone-50/70 overflow-y-auto p-3 space-y-2">
                        {filteredCases.map((c, idx) => renderListItem(c, true, idx === 0))}
                      </div>
                    )}

                    <div className={`flex-1 overflow-y-auto bg-white ${isReadingMode ? "p-0" : "p-6 md:p-8"} flex flex-col`}>
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
                          {!isReadingMode && (
                            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => navigate("/workspace/history")}
                                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-stone-100 hover:bg-rose-50 text-xs font-semibold text-stone-700 transition-colors cursor-pointer"
                                  title="Quay lại danh sách"
                                >
                                  <ArrowLeft size={14} />
                                  <span>Quay lại</span>
                                </button>

                                <ReadingModeTriggerButton data-tour="history-reading-mode" onClick={enterReadingMode} />
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  data-tour="history-refresh"
                                  type="button"
                                  onClick={handleRefreshCurrentCase}
                                  disabled={refreshing}
                                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-stone-100 hover:bg-rose-50 text-xs font-semibold text-stone-700 transition-colors disabled:opacity-40 cursor-pointer"
                                >
                                  <RotateCcw size={13} className={refreshing ? "animate-spin" : ""} />
                                  <span>{refreshing ? "Đang làm mới..." : "Làm mới kết quả"}</span>
                                </button>
                              </div>
                            </div>
                          )}

                          <div className={isReadingMode ? "max-w-[68ch] mx-auto w-full space-y-2 mt-4" : "space-y-2 mt-4"}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge tone={studentCaseStatusTone(selectedCase.status)}>
                                {studentCaseStatusLabel(selectedCase.status)}
                              </Badge>
                              <span className="font-mono text-xs font-semibold text-stone-500">
                                #{selectedCase.id}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyId(selectedCase.rawId)}
                                className="inline-flex items-center gap-1 text-xs text-ruby-700 hover:underline ml-1 cursor-pointer font-medium"
                                title="Sao chép mã câu hỏi đầy đủ"
                              >
                                {copiedId === selectedCase.rawId ? (
                                  <>
                                    <Check size={12} className="text-emerald-600" />
                                    <span className="text-emerald-600 font-medium">Đã chép</span>
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
                              className={`font-semibold text-stone-900 ${
                                isReadingMode
                                  ? fontSize === "lg"
                                    ? "text-3xl sm:text-[2rem] leading-tight"
                                    : fontSize === "sm"
                                    ? "text-2xl leading-snug"
                                    : "text-2xl sm:text-[1.75rem] leading-snug"
                                  : "text-lg leading-snug"
                              }`}
                            >
                              {selectedCase.question}
                            </h2>
                          </div>

                          {/* Stepper Progress */}
                          <div className={`bg-white border border-rose-100 rounded-2xl p-5 shadow-xs my-4 ${isReadingMode ? "max-w-[64rem] mx-auto w-full" : ""}`}>
                            <Stepper status={selectedCase.status} route={selectedCase.route} />
                          </div>

                          {/* 4 Metadata Cards */}
                          <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 ${isReadingMode ? "max-w-[64rem] mx-auto w-full" : ""}`}>
                            {[
                              { label: "Mã Case", value: `#${selectedCase.id}`, mono: true },
                              { label: "Nhóm", value: groupLabel(selectedCase.group, catalog) },
                              { label: "Ngày gửi", value: selectedCase.timestamp },
                              {
                                label: "Trạng thái",
                                value: studentCaseStatusLabel(selectedCase.status),
                              },
                            ].map((item) => (
                              <div
                                key={item.label}
                                className="bg-rose-50/50 rounded-xl p-3 border border-rose-100/80"
                              >
                                <p className="text-xs text-stone-500 mb-0.5">
                                  {item.label}
                                </p>
                                <p
                                  className={`text-xs text-stone-900 font-medium truncate ${
                                    item.mono ? "font-mono font-semibold" : ""
                                  }`}
                                  title={item.value}
                                >
                                  {item.value}
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Applied Exception Banner if present */}
                          {selectedCase.appliedExceptionId && (
                            <div className={`p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 my-4 ${isReadingMode ? "max-w-[68ch] mx-auto w-full" : ""}`}>
                              <Sparkles size={18} className="text-emerald-700 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-semibold text-emerald-800">
                                  Đã tự động áp dụng ngoại lệ #{selectedCase.appliedExceptionId}
                                </p>
                                <p className={`text-emerald-700 mt-0.5 ${isReadingMode ? "text-[length:var(--reading-font-size)] leading-[1.75]" : "text-xs leading-relaxed"}`}>
                                  Hồ sơ này thỏa mãn điều kiện ngoại lệ quy chế đã được Giảng viên phê duyệt trước đó cho môn học.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Processing Status Block */}
                          <div className={`space-y-3 my-4 ${isReadingMode ? "max-w-[68ch] mx-auto w-full" : ""}`}>
                            <h3 className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                              Nội dung phản hồi & Trạng thái xử lý
                            </h3>

                            {selectedCase.status === "auto_replied" && (
                              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                                  <CheckCircle2 size={16} />
                                  <span>AI phản hồi trực tiếp từ quy chế</span>
                                </div>
                                <p className={isReadingMode ? "text-emerald-950 text-[length:var(--reading-font-size)] leading-[1.75]" : "text-sm text-emerald-950 leading-relaxed font-medium"}>
                                  {selectedCase.aiResponse}
                                </p>
                                {selectedCase.policyRef && (
                                  <p className="text-xs text-emerald-800/80 pt-1 flex items-center gap-1.5 border-t border-emerald-200">
                                    <BookOpen size={13} />
                                    <span>{selectedCase.policyRef}</span>
                                  </p>
                                )}
                              </div>
                            )}

                            {selectedCase.status === "pending_lecturer" && (
                              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                                <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                                  <Clock size={16} />
                                  <span>Hồ sơ đang chờ Giảng viên thẩm định</span>
                                </div>
                                <p className={isReadingMode ? "text-amber-950 text-[length:var(--reading-font-size)] leading-[1.75]" : "text-sm text-amber-950 leading-relaxed font-medium"}>
                                  {selectedCase.escalationNote ||
                                    "Yêu cầu vượt thẩm quyền tự động của AI. Hồ sơ đã được chuyển tiếp đến Giảng viên phụ trách để xem xét giải quyết."}
                                </p>
                              </div>
                            )}

                            {selectedCase.status === "approved" && selectedCase.lecturerDecision && (
                              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                                <div className="flex items-center justify-between text-xs font-semibold text-ruby-800">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} />
                                    <span>Quyết định chính thức của Giảng viên</span>
                                  </div>
                                  <span className="font-mono text-xs">
                                    {selectedCase.lecturerDecision.date}
                                  </span>
                                </div>
                                <p className={isReadingMode ? "font-semibold text-ruby-800 text-[length:var(--reading-font-size)]" : "text-sm font-semibold text-ruby-800"}>
                                  {selectedCase.lecturerDecision.decision}
                                </p>
                                <p className={isReadingMode ? "text-stone-800 text-[length:var(--reading-font-size)] leading-[1.75]" : "text-sm text-stone-800 leading-relaxed"}>
                                  {selectedCase.lecturerDecision.reason}
                                </p>
                                <p className="text-xs text-stone-500 pt-1 border-t border-rose-200">
                                  Ký duyệt bởi: {selectedCase.lecturerDecision.reviewer}
                                </p>
                              </div>
                            )}

                            {selectedCase.status === "rejected" && (
                              <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-2">
                                <div className="flex items-center gap-2 text-xs font-semibold text-red-800">
                                  <XCircle size={16} />
                                  <span>Yêu cầu bị từ chối</span>
                                </div>
                                <p className={isReadingMode ? "text-red-950 text-[length:var(--reading-font-size)] leading-[1.75]" : "text-sm text-red-950 leading-relaxed font-medium"}>
                                  {selectedCase.finalDecisionReason ||
                                    selectedCase.aiResponse ||
                                    "Yêu cầu không được chấp thuận theo quy chế hiện hành hoặc giảng viên đã từ chối."}
                                </p>
                              </div>
                            )}

                            {selectedCase.status === "clarify" && (
                              <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 space-y-2">
                                <div className="flex items-center gap-2 text-xs font-semibold text-ruby-800">
                                  <AlertTriangle size={16} />
                                  <span>Cần bổ sung thông tin</span>
                                </div>
                                <p className={isReadingMode ? "text-stone-800 text-[length:var(--reading-font-size)] leading-[1.75]" : "text-sm text-stone-800 leading-relaxed"}>
                                  Hệ thống đã gửi câu hỏi làm rõ đối với thắc mắc này. Bạn có thể quay lại trang Hỏi đáp để tiếp tục hội thoại.
                                </p>
                              </div>
                            )}

                            {selectedCase.status === "out_of_scope" && (
                              <div className="p-4 rounded-xl bg-stone-100 border border-stone-200 space-y-2">
                                <p className="text-xs font-semibold text-stone-700">
                                  Ngoài phạm vi quy chế môn học
                                </p>
                                <p className={isReadingMode ? "text-stone-600 text-[length:var(--reading-font-size)] leading-[1.75]" : "text-sm text-stone-600 leading-relaxed"}>
                                  Câu hỏi không thuộc phạm vi quy chế học vụ môn học được cấu hình.
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Citations List if available */}
                          {selectedCase.citations && selectedCase.citations.length > 0 && (
                            <div className={`space-y-3 pt-2 my-4 ${isReadingMode ? "max-w-[68ch] mx-auto w-full" : ""}`}>
                              <h3 className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                                Căn cứ pháp lý & Trích dẫn quy chế ({selectedCase.citations.length})
                              </h3>
                              <div className="space-y-2">
                                {selectedCase.citations.map((c, idx) => (
                                  <div
                                    key={idx}
                                    className="p-3.5 bg-rose-50/40 rounded-xl border border-rose-100 text-xs space-y-2"
                                  >
                                    <div className="flex items-center justify-between text-stone-900 font-semibold gap-2 flex-wrap">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-mono text-xs font-bold bg-rose-100 text-ruby-800 px-2 py-0.5 rounded border border-rose-200">
                                          [{c.label || `C${idx + 1}`}]
                                        </span>
                                        <span>{c.document_title}</span>
                                      </div>
                                      {c.section && (
                                        <span className="font-mono text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                                          § {c.section}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-stone-700 italic pl-3 border-l-2 border-ruby-600 whitespace-pre-line leading-relaxed">
                                      “{c.quote}”
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </ReadingContainer>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
    </div>
  );
}
