import React, { FormEvent, useState } from "react";
import { postJson } from "../api/client";
import {
  IconArrowUpRight,
  IconBookOpen,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconScale,
  IconSearch,
  IconShield,
  IconSparkle,
  IconTeacher,
  IconThumbDown,
  IconThumbUp,
  IconUser,
  IconWarning,
} from "../components/Icons";
import { StudentWorkflowTracker } from "../components/StudentWorkflowTracker";
import type { QuestionResponse } from "../types";

interface StudentSubmitViewProps {
  actorId?: string;
  defaultCourseId?: string;
  onSubmitted?: (questionId: string) => void;
  onViewHistory?: (questionId: string) => void;
}

const DEMO_ACTORS = [
  {
    id: "student-a1",
    name: "Nguyễn Văn An",
    studentCode: "2110482",
    courseId: "CO3001",
    courseName: "CO3001 · HK261",
    group: "Nhóm A",
  },
  {
    id: "student-b1",
    name: "Trần Thị Bình",
    studentCode: "2112483",
    courseId: "CO3001",
    courseName: "CO3001 · HK261",
    group: "Nhóm B",
  },
  {
    id: "student-dadn-a1",
    name: "Lê Văn Cường",
    studentCode: "2010892",
    courseId: "DADN-HK242",
    courseName: "DADN · HK242",
    group: "Nhóm DADN/A",
  },
];

const QUICK_CHIPS = [
  {
    label: "Hạn định hủy môn học",
    prompt:
      "Hạn chót để sinh viên được phép xin hủy môn học mà không bị ghi điểm F học phần CO3001 là khi nào?",
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
    prompt: "Một nhóm đồ án CO3001 được có bao nhiêu thành viên theo quy chế chuẩn?",
  },
  {
    label: "Tỷ lệ điểm đồ án",
    prompt: "Tỷ lệ điểm giữa kỳ, quá trình, báo cáo tổng kết và demo là bao nhiêu?",
  },
];

export function StudentSubmitView({
  actorId = "student-a1",
  defaultCourseId = "CO3001",
  onSubmitted,
  onViewHistory,
}: StudentSubmitViewProps) {
  const [selectedActor, setSelectedActor] = useState(
    DEMO_ACTORS.find((a) => a.id === actorId) || DEMO_ACTORS[0]
  );
  const [query, setQuery] = useState(QUICK_CHIPS[0].prompt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QuestionResponse | null>(null);
  const [clarificationText, setClarificationText] = useState("");
  const [clarifyingBusy, setClarifyingBusy] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  // Time tracking
  const [submitTime, setSubmitTime] = useState("14:20");
  const [processTime, setProcessTime] = useState("14:21");

  async function handleSubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setError("Vui lòng nhập nội dung thắc mắc quy chế.");
      return;
    }

    setBusy(true);
    setError("");
    setSelectedCitation(null);

    const now = new Date();
    const formattedSubmit = now.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setSubmitTime(formattedSubmit);

    try {
      const res = await postJson<QuestionResponse>("/api/questions", {
        actor_id: selectedActor.id,
        course_id: selectedActor.courseId,
        text: query.trim(),
      });

      const nowFinish = new Date();
      setProcessTime(
        nowFinish.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      );
      setResult(res);

      if (onSubmitted && res.question_id) {
        onSubmitted(res.question_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi câu hỏi. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendClarification(e: FormEvent) {
    e.preventDefault();
    if (!result || !clarificationText.trim()) return;

    setClarifyingBusy(true);
    try {
      const res = await postJson<QuestionResponse>(
        `/api/questions/${result.question_id}/clarifications`,
        { text: clarificationText.trim() }
      );
      setResult(res);
      setClarificationText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi phản hồi bổ sung.");
    } finally {
      setClarifyingBusy(false);
    }
  }

  function handleEscalateManually() {
    setQuery("Nhóm em có nguyện vọng xin đăng ký ngoại lệ 6 thành viên cho đồ án môn học CO3001");
    // Trigger submission for exception escalation
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
  }

  const caseDisplayId = result?.case_id
    ? result.case_id
    : result?.question_id
    ? result.question_id.replace(/^q_/, "CASE-").slice(0, 9).toUpperCase()
    : "REF-CO3001-0012";

  // Format bold highlight for answer text
  const renderFormattedAnswer = (text: string) => {
    // Highlight important phrases like dates, limits, percentages
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

        {/* Right Student Profile Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full transition-all shadow-xs">
            <div className="w-6 h-6 rounded-full bg-[#DC2626] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <IconUser size={13} />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-slate-800">{selectedActor.name}</span>
              <span className="font-mono text-slate-500">({selectedActor.studentCode})</span>
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-slate-700">{selectedActor.courseName}</span>
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
            <div className="text-xs text-slate-500 font-medium">
              Học kỳ 261 <span className="text-slate-300">•</span> Tiêu chuẩn 3-5 thành viên
            </div>
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
                onChange={(e) => setQuery(e.target.value)}
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
                onClick={() => setQuery(chip.prompt)}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 rounded-lg text-xs font-medium text-slate-600 transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── CARD 2: WORKFLOW TIẾN TRÌNH (CHO BIẾT AI HAY GIÁO VIÊN TRẢ LỜI) ── */}
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
            <div className="bg-gradient-to-r from-red-50/90 via-rose-50/70 to-orange-50/50 border-b border-red-100 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-red-900">
                <span className="w-5 h-5 rounded-full bg-red-100 text-[#DC2626] flex items-center justify-center flex-shrink-0">
                  <IconCheck size={12} />
                </span>
                <span>
                  {result.route === "ANSWER"
                    ? "ĐÃ ĐỐI CHIẾU THÀNH CÔNG • Trực tiếp từ quy chế hiện hành (AI Trả lời tự động)"
                    : result.final_decision
                    ? "GIẢNG VIÊN ĐÃ PHÊ DUYỆT • Ngoại lệ được ghi nhận vào hệ thống"
                    : result.route === "ESCALATE"
                    ? "ĐÃ CHUYỂN TIẾP CHO GIẢNG VIÊN • Vượt thẩm quyền AI (Chờ phê duyệt)"
                    : "CẦN BỔ SUNG THÔNG TIN • AI chưa đủ dữ kiện phán quyết"}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-500 font-medium flex items-center gap-1.5">
                <IconClock size={13} className="text-slate-400" />
                <span>Thời gian phản hồi: 0.18s</span>
              </div>
            </div>

            <div className="p-6 lg:p-7 space-y-6">
              {/* 1. Official Conclusion / Decision Block */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[#DC2626]">
                    {result.route === "ANSWER" ? (
                      <IconScale size={18} />
                    ) : (
                      <IconTeacher size={18} />
                    )}
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {result.route === "ANSWER"
                      ? "KẾT LUẬN QUY CHẾ CHÍNH THỨC"
                      : result.final_decision
                      ? "Ý KIẾN / QUYẾT ĐỊNH CHÍNH THỨC TỪ GIẢNG VIÊN"
                      : result.route === "ESCALATE"
                      ? "HỒ SƠ CHUYỂN TIẾP GIẢNG VIÊN PHỤ TRÁCH THỤ LÝ"
                      : "YÊU CẦU LÀM RÕ TỪ HỆ THỐNG"}
                  </h3>
                </div>

                {/* Answer box */}
                <div className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-xl">
                  {result.route === "ANSWER" && result.answer && (
                    <p className="text-sm text-slate-800 leading-relaxed font-medium">
                      {renderFormattedAnswer(result.answer)}
                    </p>
                  )}

                  {/* Escalate block */}
                  {result.route === "ESCALATE" && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-800 leading-relaxed">
                        Yêu cầu của bạn thuộc diện{" "}
                        <strong className="text-red-700">ngoại lệ quy chế hoặc vượt thẩm quyền tự động</strong>{" "}
                        của AI. Hệ thống đã lập hồ sơ chuyển tiếp đến Giảng viên phụ trách môn học.
                      </p>
                      <div className="p-3 bg-white border border-amber-200 rounded-lg text-xs space-y-1.5 text-amber-900">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Mã hồ sơ thẩm định:</span>
                          <span className="font-mono font-bold text-slate-800">#{caseDisplayId}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Giảng viên thụ lý:</span>
                          <span>TS. Trần Minh Tuấn (lecturer-01)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Lý do phân luồng:</span>
                          <span className="font-mono text-[11px] bg-amber-100 px-1.5 py-0.5 rounded text-amber-800">
                            {result.reason_code || "AUTHORITY_EXCEPTION_REQUIRED"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Clarify block */}
                  {result.route === "CLARIFY" && result.clarifying_question && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-800">
                        {result.clarifying_question}
                      </p>
                      <form onSubmit={handleSendClarification} className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={clarificationText}
                          onChange={(e) => setClarificationText(e.target.value)}
                          placeholder="Nhập bổ sung thông tin chi tiết..."
                          className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#DC2626]"
                        />
                        <button
                          type="submit"
                          disabled={clarifyingBusy || !clarificationText.trim()}
                          className="px-4 py-2 bg-[#B91C1C] text-white text-xs font-semibold rounded-lg hover:bg-[#991B1B] disabled:opacity-50"
                        >
                          {clarifyingBusy ? "Đang gửi…" : "Gửi bổ sung"}
                        </button>
                      </form>
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
                      Số trích dẫn: {result.citations.length}/5 tài liệu nguồn
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

              {/* 3. Red Escalation Suggestion Banner */}
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

                <div className="text-xs font-mono font-bold text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  <span>MÃ TRA CỨU: #{caseDisplayId}</span>
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
