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
  }, [actorId, selectedCourseId, selectedGroupId]);

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

  // Empty state when database has 0 items
  if (!loading && cases.length === 0) {
    return (
      <div className="flex-1 w-full bg-[var(--surface-dim)] flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--surface-container)] border border-[var(--outline)]/40 flex items-center justify-center text-[var(--on-surface-variant)] mb-4">
          <HelpCircle size={32} />
        </div>
        <h2 className="text-lg font-medium text-[var(--on-surface)] mb-1">
          Bạn chưa gửi câu hỏi nào
        </h2>
        <p className="text-xs text-[var(--on-surface-variant)] max-w-sm mb-6 leading-relaxed">
          Mọi thắc mắc về quy định, thời hạn hoặc xin ngoại lệ sẽ được lưu lại trong hồ sơ để theo dõi tiến độ.
        </p>
        <button
          type="button"
          onClick={() => navigate("/workspace/ask")}
          className="h-10 px-5 rounded-[var(--radius-xl)] bg-[var(--primary)] text-white hover:bg-[#0842A0] text-sm font-medium transition-colors shadow-xs"
        >
          Đặt câu hỏi đầu tiên
        </button>
      </div>
    );
  }

  // ── Render List Item Component ──
  const renderListItem = (c: StudentCaseItem, isCompact: boolean) => {
    const isSelected = selectedCase?.rawId === c.rawId;

    if (isCompact) {
      // 2-row layout in compact left column
      return (
        <button
          key={c.rawId}
          type="button"
          onClick={() => navigate(`/workspace/history/${c.rawId}`)}
          className={`w-full text-left p-3.5 rounded-[var(--radius-md)] border transition-all ${
            isSelected
              ? "bg-[var(--primary-container)]/50 border-[var(--primary)] shadow-xs"
              : "bg-[var(--surface)] border-[var(--outline)]/30 hover:bg-[var(--surface-container-high)]"
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <Badge tone={studentCaseStatusTone(c.status)} className="text-xs py-0.5 px-2">
              {studentCaseStatusLabel(c.status)}
            </Badge>
            <span className="text-xs text-[var(--on-surface-variant)] font-mono">
              {formatGmailDate(c.rawCreatedAt || c.timestamp)}
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
          <div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--on-surface-variant)]">
            <span className="truncate">{c.topic}</span>
          </div>
        </button>
      );
    }

    // Single-line Gmail email style row (Mockup 3)
    return (
      <div
        key={c.rawId}
        onClick={() => navigate(`/workspace/history/${c.rawId}`)}
        className="flex items-center h-14 px-4 border-b border-[var(--outline)]/20 hover:bg-[var(--surface-container-high)] transition-colors cursor-pointer select-none group"
      >
        <div className="shrink-0 w-36">
          <Badge tone={studentCaseStatusTone(c.status)} className="text-xs py-0.5 px-2">
            {studentCaseStatusLabel(c.status)}
          </Badge>
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-sm font-medium text-[var(--on-surface)] truncate group-hover:text-[var(--primary)] transition-colors">
            {c.title}
          </p>
        </div>
        <div className="hidden sm:block shrink-0 w-44 text-xs text-[var(--on-surface-variant)] truncate text-right pr-6" title={c.topic}>
          {c.topic}
        </div>
        <div className="shrink-0 text-xs font-mono text-[var(--on-surface-variant)] text-right w-16">
          {formatGmailDate(c.rawCreatedAt || c.timestamp)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 w-full bg-[var(--surface-dim)] flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── TOP TOOLBAR (SEARCH + FILTER CHIPS) ── */}
      {!isReadingMode && (
        <div className="px-4 sm:px-6 py-3.5 bg-[var(--surface)] border-b border-[var(--outline)]/30 shrink-0 space-y-3">
          <PageHeader
            title="Hồ sơ câu hỏi"
            description="Lịch sử các câu hỏi, kết quả đối soát quy chế và tiến độ giải quyết"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search bar like Gmail */}
            <div className="relative flex-1 max-w-lg">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--on-surface-variant)]">
                <Search size={16} />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm nội dung thắc mắc, mã hồ sơ..."
                className="w-full h-10 pl-10 pr-4 rounded-[var(--radius-xl)] bg-[var(--surface-container)] border border-[var(--outline)]/30 text-xs text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/60 focus:outline-none focus:border-[var(--primary)] focus:bg-[var(--surface)] transition-all"
              />
            </div>

            <div className="text-sm text-[var(--on-surface-variant)]">
              {filteredCases.length} / {cases.length} hồ sơ
            </div>
          </div>

          {/* Status Filter Chips with Counts */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {filterTabs.map((tab) => {
              const count = filterCounts[tab.key] || 0;
              const isSelected = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={`h-7 px-3 rounded-[var(--radius-sm)] text-xs font-medium border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-[var(--primary-container)] border-[var(--primary)] text-[var(--primary)] font-semibold shadow-xs"
                      : "bg-[var(--surface)] border-[var(--outline)]/40 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-xs px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]"
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

      {/* ── MAIN WORKSPACE AREA ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* CASE 1: No question selected → Full-width Gmail email list (Mockup 3) */}
        {!selectedCase && (
          <div className="flex-1 overflow-y-auto bg-[var(--surface)]">
            {filteredCases.length === 0 ? (
              <div className="text-center py-20 text-xs text-[var(--on-surface-variant)]">
                Không tìm thấy câu hỏi phù hợp với bộ lọc
              </div>
            ) : (
              <div>{filteredCases.map((c) => renderListItem(c, false))}</div>
            )}
          </div>
        )}

        {/* CASE 2: Question selected → 2-column layout or Reading Mode */}
        {selectedCase && (
          <>
            {/* Left compact list column (~380px), hidden when isReadingMode */}
            {!isReadingMode && (
              <div className="hidden md:flex w-[23.75rem] shrink-0 border-r border-[var(--outline)]/30 flex-col bg-[var(--surface-dim)] overflow-y-auto p-3 space-y-2">
                {filteredCases.map((c) => renderListItem(c, true))}
              </div>
            )}

            {/* Right detail panel */}
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
                  {/* Detail Top Action Bar */}
                  {!isReadingMode && (
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--outline)]/30">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => navigate("/workspace/history")}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-xl)] bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-xs font-medium text-[var(--on-surface)] transition-colors cursor-pointer"
                          title="Quay lại danh sách"
                        >
                          <ArrowLeft size={14} />
                          <span>Quay lại</span>
                        </button>

                        <ReadingModeTriggerButton onClick={enterReadingMode} />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleRefreshCurrentCase}
                          disabled={refreshing}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-xl)] bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-xs font-medium text-[var(--on-surface)] transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          <RotateCcw size={13} className={refreshing ? "animate-spin" : ""} />
                          <span>{refreshing ? "Đang làm mới..." : "Làm mới kết quả"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Case Title & Short ID with Copy Button */}
                  <div className={isReadingMode ? "max-w-[68ch] mx-auto w-full space-y-2" : "space-y-2"}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone={studentCaseStatusTone(selectedCase.status)}>
                        {studentCaseStatusLabel(selectedCase.status)}
                      </Badge>
                      <span className="font-mono text-xs font-semibold text-[var(--on-surface-variant)]">
                        #{selectedCase.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyId(selectedCase.rawId)}
                        className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline ml-1 cursor-pointer"
                        title="Sao chép mã câu hỏi đầy đủ"
                      >
                        {copiedId === selectedCase.rawId ? (
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
                          : "text-lg leading-snug"
                      }`}
                    >
                      {selectedCase.question}
                    </h2>
                  </div>

                  {/* Stepper Progress */}
                  <div className={`bg-[var(--surface)] border border-[var(--outline)]/40 rounded-[var(--radius-lg)] p-5 shadow-xs ${isReadingMode ? "max-w-[64rem] mx-auto w-full" : ""}`}>
                    <Stepper status={selectedCase.status} route={selectedCase.route} />
                  </div>

                  {/* 4 Metadata Cards */}
                  <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${isReadingMode ? "max-w-[64rem] mx-auto w-full" : ""}`}>
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
                      className="bg-[var(--surface-container)] rounded-[var(--radius-md)] p-3 border border-[var(--outline)]/30"
                    >
                      <p className="text-xs text-[var(--on-surface-variant)] mb-0.5">
                        {item.label}
                      </p>
                      <p
                        className={`text-xs text-[var(--on-surface)] font-medium truncate ${
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
                  <div className={`p-4 bg-[#E8F5E9] border border-[#C8E6C9] rounded-[var(--radius-md)] flex items-start gap-3 ${isReadingMode ? "max-w-[68ch] mx-auto w-full" : ""}`}>
                    <Sparkles size={18} className="text-[var(--success)] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-[#146C2E]">
                        Đã tự động áp dụng ngoại lệ #{selectedCase.appliedExceptionId}
                      </p>
                      <p className={`text-[#146C2E]/90 mt-0.5 ${isReadingMode ? "text-[length:var(--reading-font-size)] leading-[1.75]" : "text-xs leading-relaxed"}`}>
                        Hồ sơ này thỏa mãn điều kiện ngoại lệ quy chế đã được Giảng viên phê duyệt trước đó cho môn học.
                      </p>
                    </div>
                  </div>
                )}

                {/* Processing Status Block */}
                <div className={`space-y-3 ${isReadingMode ? "max-w-[68ch] mx-auto w-full" : ""}`}>
                  <h3 className="text-xs font-medium text-[var(--on-surface-variant)]">
                    Nội dung phản hồi & Trạng thái xử lý
                  </h3>

                  {selectedCase.status === "auto_replied" && (
                    <div className="p-4 rounded-[var(--radius-md)] bg-[#E8F5E9] border border-[#C8E6C9] space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#146C2E]">
                        <CheckCircle2 size={16} />
                        <span>AI phản hồi trực tiếp từ quy chế</span>
                      </div>
                      <p className={isReadingMode ? "text-[#146C2E] text-[length:var(--reading-font-size)] leading-[1.75]" : "text-sm text-[#146C2E] leading-relaxed"}>
                        {selectedCase.aiResponse}
                      </p>
                      {selectedCase.policyRef && (
                        <p className="text-xs text-[#146C2E]/80 pt-1 flex items-center gap-1.5 border-t border-[#C8E6C9]">
                          <BookOpen size={13} />
                          <span>{selectedCase.policyRef}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {selectedCase.status === "pending_lecturer" && (
                    <div className="p-4 rounded-[var(--radius-md)] bg-[#FFF8E1] border border-[#FFE082] space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#8C5000]">
                        <Clock size={16} />
                        <span>Hồ sơ đang chờ Giảng viên thẩm định</span>
                      </div>
                      <p className={isReadingMode ? "text-[#8C5000] text-[length:var(--reading-font-size)] leading-[1.75]" : "text-sm text-[#8C5000] leading-relaxed"}>
                        {selectedCase.escalationNote ||
                          "Yêu cầu vượt thẩm quyền tự động của AI. Hồ sơ đã được chuyển tiếp đến Giảng viên phụ trách để xem xét giải quyết."}
                      </p>
                      <p className="text-xs text-[#8C5000]/80">
                        Thời gian phản hồi dự kiến: Trong vòng 48 giờ làm việc.
                      </p>
                    </div>
                  )}

                  {selectedCase.status === "approved" && selectedCase.lecturerDecision && (
                    <div className="p-4 rounded-[var(--radius-md)] bg-[#E3F2FD] border border-[#BBDEFB] space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-[#0B57D0]">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} />
                          <span>Quyết định chính thức của Giảng viên</span>
                        </div>
                        <span className="font-mono text-xs">
                          {selectedCase.lecturerDecision.date}
                        </span>
                      </div>
                      <p className={isReadingMode ? "font-semibold text-[#0B57D0] text-[length:var(--reading-font-size)]" : "text-sm font-semibold text-[#0B57D0]"}>
                        {selectedCase.lecturerDecision.decision}
                      </p>
                      <p className={isReadingMode ? "text-[var(--on-surface)] text-[length:var(--reading-font-size)] leading-[1.75]" : "text-sm text-[var(--on-surface)] leading-relaxed"}>
                        {selectedCase.lecturerDecision.reason}
                      </p>
                      <p className="text-xs text-[var(--on-surface-variant)] pt-1 border-t border-[#BBDEFB]">
                        Ký duyệt bởi: {selectedCase.lecturerDecision.reviewer}
                      </p>
                    </div>
                  )}

                  {selectedCase.status === "rejected" && (
                    <div className="p-4 rounded-[var(--radius-md)] bg-[#FFEBEE] border border-[#FFCDD2] space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#B3261E]">
                        <XCircle size={16} />
                        <span>Yêu cầu bị từ chối</span>
                      </div>
                      <p className={isReadingMode ? "text-[#B3261E] text-[length:var(--reading-font-size)] leading-[1.75]" : "text-sm text-[#B3261E] leading-relaxed"}>
                        {selectedCase.finalDecisionReason ||
                          selectedCase.aiResponse ||
                          "Yêu cầu không được chấp thuận theo quy chế hiện hành hoặc giảng viên đã từ chối."}
                      </p>
                    </div>
                  )}

                  {selectedCase.status === "clarify" && (
                    <div className="p-4 rounded-[var(--radius-md)] bg-[var(--surface-container)] border border-[var(--outline)]/40 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--primary)]">
                        <AlertTriangle size={16} />
                        <span>Cần bổ sung thông tin</span>
                      </div>
                      <p className={isReadingMode ? "text-[var(--on-surface)] text-[length:var(--reading-font-size)] leading-[1.75]" : "text-sm text-[var(--on-surface)] leading-relaxed"}>
                        Hệ thống đã gửi câu hỏi làm rõ đối với thắc mắc này. Bạn có thể quay lại trang Hỏi đáp để tiếp tục hội thoại.
                      </p>
                    </div>
                  )}

                  {selectedCase.status === "out_of_scope" && (
                    <div className="p-4 rounded-[var(--radius-md)] bg-[var(--surface-container)] border border-[var(--outline)]/40 space-y-2">
                      <p className="text-xs font-semibold text-[var(--on-surface-variant)]">
                        Ngoài phạm vi quy chế môn học
                      </p>
                      <p className={isReadingMode ? "text-[var(--on-surface-variant)] text-[length:var(--reading-font-size)] leading-[1.75]" : "text-sm text-[var(--on-surface-variant)] leading-relaxed"}>
                        Câu hỏi không thuộc phạm vi quy chế học vụ môn học được cấu hình.
                      </p>
                    </div>
                  )}
                </div>

                {/* Citations List if available */}
                {selectedCase.citations && selectedCase.citations.length > 0 && (
                  <div className={`space-y-3 pt-2 ${isReadingMode ? "max-w-[68ch] mx-auto w-full" : ""}`}>
                    <h3 className="text-xs font-medium text-[var(--on-surface-variant)]">
                      Căn cứ pháp lý & Trích dẫn quy chế ({selectedCase.citations.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedCase.citations.map((c, idx) => (
                        <div
                          key={idx}
                          className={`p-3 bg-[var(--surface-container)] ${
                            isReadingMode
                              ? "border-l-4 border-l-[var(--outline)]/60 rounded-none border-y-0 border-r-0"
                              : "rounded-[var(--radius-sm)] border border-[var(--outline)]/30"
                          } text-xs space-y-1`}
                        >
                          <div className="flex items-center justify-between text-[var(--on-surface)] font-medium">
                            <span>
                              [{c.label}] {c.document_title}
                            </span>
                            {c.section && (
                              <span className="font-mono text-xs text-[var(--on-surface-variant)]">
                                {c.section}
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
                )}
              </ReadingContainer>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
