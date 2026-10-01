import React from "react";
import { IconCheck, IconSparkle, IconTeacher } from "./Icons";
import type { QuestionResponse } from "../types";

interface StudentWorkflowTrackerProps {
  busy?: boolean;
  result?: QuestionResponse | null;
  submitTime?: string;
  processTime?: string;
}

export function StudentWorkflowTracker({
  busy = false,
  result = null,
  submitTime = "14:20",
  processTime = "14:21",
}: StudentWorkflowTrackerProps) {
  // Determine route and step states
  const hasResult = !!result;
  const isAnswer = result?.route === "ANSWER";
  const isEscalate = result?.route === "ESCALATE";
  const isClarify = result?.route === "CLARIFY";
  const isApproved = !!result?.final_decision;

  const caseDisplayId = result?.case_id
    ? result.case_id
    : result?.question_id
    ? result.question_id.replace(/^q_/, "CASE-").slice(0, 9).toUpperCase()
    : "CASE-001";

  // Citation text for step 3 subtitle
  const citationSnippet =
    result?.citations && result.citations.length > 0
      ? `${result.citations[0].document_title} ${result.citations[0].heading ? `· ${result.citations[0].heading}` : ""}`
      : "Trích xuất quy định CO3001 Mục 3.1";

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs relative overflow-hidden transition-all">
      {/* Background Accent glow */}
      <div className="absolute top-0 right-0 w-80 h-32 bg-gradient-to-l from-red-50/50 to-transparent pointer-events-none" />

      {/* Header bar of the tracker with badge */}
      <div className="flex items-center justify-between pb-5 mb-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] animate-pulse"></span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Tiến trình Thẩm định & Phân luồng Học vụ
          </span>
        </div>

        {/* Dynamic Badge showing who resolves the question */}
        <div>
          {busy ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              Đang đối soát & phân luồng…
            </span>
          ) : isAnswer ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              🤖 Trả lời tự động bởi AI Referee
            </span>
          ) : isApproved ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
              <span className="w-2 h-2 rounded-full bg-purple-600"></span>
              ✓ Giảng viên đã phê duyệt / phản hồi
            </span>
          ) : isEscalate ? (
            result?.escalation_target === "POLICY_VIOLATION" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-300">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
                🛑 Cảnh báo vi phạm quy chế · Hồ sơ chuyển xác minh
              </span>
            ) : result?.escalation_target === "ACADEMIC_AFFAIRS" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                🏢 Chuyển tiếp Phòng Đào tạo / Khoa thẩm định
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-[#DC2626] border border-red-200">
                <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-ping"></span>
                👨‍🏫 Chuyển tiếp Giảng viên phụ trách xem xét
              </span>
            )
          ) : isClarify ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              ❓ AI yêu cầu làm rõ dữ kiện
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
              Sẵn sàng tra cứu
            </span>
          )}
        </div>
      </div>

      {/* Horizontal Pipeline Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {/* Connecting Line between Step 1 and Step 2 */}
        <div className="hidden md:block absolute top-5 left-[16%] right-[50%] h-[2px] bg-[#DC2626] z-0" />
        {/* Connecting Line between Step 2 and Step 3 */}
        <div
          className={`hidden md:block absolute top-5 left-[50%] right-[16%] h-[2px] z-0 transition-colors ${
            hasResult ? "bg-[#DC2626]" : "bg-slate-200"
          }`}
        />

        {/* ── MILESTONE 1: GỬI CÂU HỎI ── */}
        <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-full bg-[#DC2626] text-white flex items-center justify-center font-bold shadow-sm shadow-red-500/20">
              <IconCheck size={18} />
            </div>
            <span className="md:hidden text-xs font-mono font-medium text-slate-400">
              {submitTime}
            </span>
          </div>

          <div className="mt-1">
            <div className="flex items-center justify-center md:justify-start gap-1.5">
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">Gửi câu hỏi</h4>
              <span className="hidden md:inline-block text-[11px] font-mono text-slate-400">
                {submitTime}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">Sinh viên gửi đề xuất học vụ</p>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              Đã tiếp nhận vào hệ thống
            </p>
          </div>
        </div>

        {/* ── MILESTONE 2: KIỂM TRA & PHÂN LUỒNG ── */}
        <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                busy
                  ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                  : hasResult
                  ? "bg-[#DC2626] text-white shadow-sm shadow-red-500/20"
                  : "bg-slate-100 text-slate-400 border border-slate-300"
              }`}
            >
              {busy ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : hasResult ? (
                <IconCheck size={18} />
              ) : (
                <span className="text-xs font-bold">2</span>
              )}
            </div>
            <span className="md:hidden text-xs font-mono font-medium text-slate-400">
              {processTime}
            </span>
          </div>

          <div className="mt-1">
            <div className="flex items-center justify-center md:justify-start gap-1.5">
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                Kiểm tra & Phân luồng
              </h4>
              <span className="hidden md:inline-block text-[11px] font-mono text-slate-400">
                {processTime}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">RAG đối chiếu quy chế định mức</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              {busy ? (
                <span className="text-amber-600 animate-pulse">Đang rà soát điều khoản…</span>
              ) : isAnswer ? (
                <span className="text-emerald-700">Phát hiện: Quy chuẩn hợp lệ (Đủ thẩm quyền AI)</span>
              ) : isEscalate ? (
                result?.escalation_target === "POLICY_VIOLATION" ? (
                  <span className="text-rose-700 font-semibold">
                    Phát hiện: Dấu hiệu vi phạm quy chế / Nghi vấn bảo mật
                  </span>
                ) : result?.escalation_target === "ACADEMIC_AFFAIRS" ? (
                  <span className="text-indigo-700 font-semibold">
                    Phát hiện: Vượt thẩm quyền giảng viên (Chuyển Phòng Đào tạo)
                  </span>
                ) : (
                  <span className="text-red-700 font-semibold">
                    Phát hiện: Ngoại lệ thẩm quyền Giảng viên môn học
                  </span>
                )
              ) : isClarify ? (
                <span className="text-sky-700">Phát hiện: Thiếu dữ kiện tình huống cụ thể</span>
              ) : (
                "Chờ tiếp nhận & phân luồng"
              )}
            </p>
          </div>
        </div>

        {/* ── MILESTONE 3: AI TRẢ LỜI hoặc GIẢNG VIÊN THỤ LÝ ── */}
        <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                isApproved
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                  : isAnswer
                  ? "bg-[#DC2626] text-white shadow-sm shadow-red-500/20"
                  : isEscalate
                  ? result?.escalation_target === "POLICY_VIOLATION"
                    ? "bg-rose-700 text-white shadow-sm shadow-rose-700/30 animate-pulse"
                    : result?.escalation_target === "ACADEMIC_AFFAIRS"
                    ? "bg-indigo-700 text-white shadow-sm shadow-indigo-700/30 animate-pulse"
                    : "bg-[#B91C1C] text-white shadow-sm shadow-red-700/30 animate-pulse"
                  : isClarify
                  ? "bg-sky-600 text-white shadow-sm shadow-sky-600/30"
                  : "bg-slate-100 text-slate-400 border border-slate-300"
              }`}
            >
              {isApproved ? (
                <IconCheck size={18} />
              ) : isAnswer ? (
                <IconSparkle size={18} />
              ) : isEscalate ? (
                <IconTeacher size={18} />
              ) : isClarify ? (
                <span className="text-sm font-bold">?</span>
              ) : (
                <span className="text-xs font-bold">3</span>
              )}
            </div>
            <span className="md:hidden text-xs font-mono font-medium text-slate-400">
              {isAnswer ? processTime : isEscalate ? "Chờ duyệt" : ""}
            </span>
          </div>

          <div className="mt-1">
            <div className="flex items-center justify-center md:justify-start gap-1.5">
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                {isApproved
                  ? "Cán bộ/Giảng viên đã phản hồi"
                  : isAnswer
                  ? "AI Trả lời & Trích dẫn"
                  : isEscalate
                  ? result?.escalation_target === "POLICY_VIOLATION"
                    ? "Kiểm tra vi phạm & Lập biên bản"
                    : result?.escalation_target === "ACADEMIC_AFFAIRS"
                    ? "Phòng Đào tạo thẩm định"
                    : "Giảng viên thụ lý & Duyệt"
                  : isClarify
                  ? "AI Yêu cầu làm rõ"
                  : "Thẩm định & Trả lời"}
              </h4>
              <span className="hidden md:inline-block text-[11px] font-mono text-slate-400">
                {isAnswer ? processTime : isEscalate ? "SLA 48h" : ""}
              </span>
            </div>

            <p className="text-xs text-slate-600 mt-0.5 truncate max-w-[280px]">
              {isApproved
                ? "Quyết định chính thức đã ban hành"
                : isAnswer
                ? citationSnippet
                : isEscalate
                ? result?.escalation_target === "POLICY_VIOLATION"
                  ? `Hồ sơ #${caseDisplayId} chuyển Thanh tra / PĐT`
                  : result?.escalation_target === "ACADEMIC_AFFAIRS"
                  ? `Hồ sơ #${caseDisplayId} chuyển Phòng Đào tạo`
                  : `Hồ sơ #${caseDisplayId} chuyển tiếp Thầy/Cô`
                : isClarify
                ? "Chưa đủ dữ kiện đối chiếu quy chế"
                : "Phản hồi chính thức"}
            </p>

            <p className="text-[11px] mt-0.5 font-semibold">
              {isApproved ? (
                <span className="text-purple-700">✓ Đã được phê duyệt & ghi nhận ngoại lệ</span>
              ) : isAnswer ? (
                <span className="text-emerald-700">✓ Đầy đủ căn cứ pháp lý · Trả lời tự động</span>
              ) : isEscalate ? (
                result?.escalation_target === "POLICY_VIOLATION" ? (
                  <span className="text-rose-700">🛑 Ghi nhận nhật ký kiểm toán bất biến & chuyển xử lý</span>
                ) : result?.escalation_target === "ACADEMIC_AFFAIRS" ? (
                  <span className="text-indigo-700">⏳ Phòng Đào tạo xem xét & trả lời theo quy chế</span>
                ) : (
                  <span className="text-red-700">⏳ Giảng viên phụ trách xem xét & quyết định</span>
                )
              ) : isClarify ? (
                <span className="text-sky-700">❓ Chờ sinh viên bổ sung tình huống cụ thể</span>
              ) : (
                <span className="text-slate-400">Tự động đối soát bởi AI hoặc Giảng viên</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
