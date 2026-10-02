import React from "react";
import { IconCheck, IconInfo, IconSparkle, IconTeacher, IconX } from "./Icons";
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
  submitTime = "",
  processTime = "",
}: StudentWorkflowTrackerProps) {
  // Determine route and step states
  const hasResult = !!result;
  const isSubmitted = busy || hasResult;
  const isAnswer = result?.route === "ANSWER";
  const isEscalate = result?.route === "ESCALATE";
  const isClarify = result?.route === "CLARIFY";
  const isOutOfScope = result?.route === "OUT_OF_SCOPE";
  const isRejected = result?.route === "REJECT";
  const isApproved = !!result?.final_decision;

  // Citation text for step 3 subtitle
  const citationSnippet =
    result?.citations && result.citations.length > 0
      ? `${result.citations[0].document_title} ${
          result.citations[0].heading ? `· ${result.citations[0].heading}` : ""
        }`
      : "Trích xuất quy định quy chế hiện hành";

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
          ) : result?.applied_exception_id ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              ⚡ Đã áp dụng ngoại lệ #{result.applied_exception_id}
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-[#DC2626] border border-red-200">
              <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-ping"></span>
              👨‍🏫 Chuyển Giảng viên
            </span>
          ) : isOutOfScope ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              <span className="w-2 h-2 rounded-full bg-purple-600"></span>
              🌐 Ngoài phạm vi — liên hệ đơn vị phụ trách
            </span>
          ) : isRejected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-600"></span>
              🛑 Yêu cầu bị từ chối
            </span>
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
        {/* ── MILESTONE 1: GỬI CÂU HỎI ── */}
        <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center w-full mb-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all flex-shrink-0 z-10 ${
                isSubmitted
                  ? "bg-[#DC2626] text-white shadow-sm shadow-red-500/20"
                  : "bg-slate-100 text-slate-500 border border-slate-300"
              }`}
            >
              {isSubmitted ? (
                <IconCheck size={18} />
              ) : (
                <span className="text-xs font-bold text-slate-500">1</span>
              )}
            </div>
            {/* Seamless connecting line to Step 2 */}
            <div
              className={`hidden md:block flex-1 h-[2px] ml-3 -mr-6 z-0 transition-colors ${
                isSubmitted ? "bg-[#DC2626]" : "bg-slate-200"
              }`}
            />
          </div>

          <div className="mt-1">
            <div className="flex items-center justify-center md:justify-start gap-1.5">
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">Gửi câu hỏi</h4>
              {isSubmitted && submitTime && (
                <span className="text-[11px] font-mono text-slate-400">
                  {submitTime}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">Sinh viên gửi đề xuất học vụ</p>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              {isSubmitted ? "Đã tiếp nhận vào hệ thống" : "Chờ gửi câu hỏi"}
            </p>
          </div>
        </div>

        {/* ── MILESTONE 2: KIỂM TRA & PHÂN LUỒNG ── */}
        <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center w-full mb-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all flex-shrink-0 z-10 ${
                busy
                  ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                  : hasResult
                  ? isRejected
                    ? "bg-rose-600 text-white shadow-sm shadow-rose-500/20"
                    : "bg-[#DC2626] text-white shadow-sm shadow-red-500/20"
                  : "bg-slate-100 text-slate-400 border border-slate-300"
              }`}
            >
              {busy ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : hasResult ? (
                <IconCheck size={18} />
              ) : (
                <span className="text-xs font-bold text-slate-500">2</span>
              )}
            </div>
            {/* Seamless connecting line to Step 3 */}
            <div
              className={`hidden md:block flex-1 h-[2px] ml-3 -mr-6 z-0 transition-colors ${
                hasResult ? "bg-[#DC2626]" : "bg-slate-200"
              }`}
            />
          </div>

          <div className="mt-1">
            <div className="flex items-center justify-center md:justify-start gap-1.5">
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                Kiểm tra & Phân luồng
              </h4>
              {hasResult && processTime && (
                <span className="text-[11px] font-mono text-slate-400">
                  {processTime}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">RAG đối chiếu quy chế định mức</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              {busy ? (
                <span className="text-amber-600 animate-pulse">Đang rà soát điều khoản…</span>
              ) : isAnswer ? (
                <span className="text-emerald-700">Phát hiện: Quy chuẩn hợp lệ (Đủ thẩm quyền AI)</span>
              ) : isEscalate ? (
                <span className="text-red-700 font-semibold">
                  Phát hiện: Ngoại lệ thẩm quyền Giảng viên môn học
                </span>
              ) : isOutOfScope ? (
                <span className="text-purple-700 font-semibold">
                  Phát hiện: Ngoài phạm vi giải quyết của môn học
                </span>
              ) : isRejected ? (
                <span className="text-rose-700 font-semibold">
                  Phát hiện: Yêu cầu bị từ chối / Vi phạm quy chế
                </span>
              ) : isClarify ? (
                <span className="text-sky-700">Phát hiện: Thiếu dữ kiện tình huống cụ thể</span>
              ) : (
                "Chờ tiếp nhận & phân luồng"
              )}
            </p>
          </div>
        </div>

        {/* ── MILESTONE 3: THẨM ĐỊNH & TRẢ LỜI ── */}
        <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center w-full mb-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all flex-shrink-0 z-10 ${
                isApproved
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                  : isAnswer
                  ? "bg-[#DC2626] text-white shadow-sm shadow-red-500/20"
                  : isEscalate
                  ? "bg-[#B91C1C] text-white shadow-sm shadow-red-700/30 animate-pulse"
                  : isOutOfScope
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                  : isRejected
                  ? "bg-rose-600 text-white shadow-sm shadow-rose-600/30"
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
              ) : isOutOfScope ? (
                <IconInfo size={18} />
              ) : isRejected ? (
                <IconX size={18} />
              ) : isClarify ? (
                <span className="text-sm font-bold">?</span>
              ) : (
                <span className="text-xs font-bold text-slate-500">3</span>
              )}
            </div>
          </div>

          <div className="mt-1">
            <div className="flex items-center justify-center md:justify-start gap-1.5">
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                {isApproved
                  ? "Cán bộ/Giảng viên đã phản hồi"
                  : isAnswer
                  ? "AI Trả lời & Trích dẫn"
                  : isEscalate
                  ? "Chuyển Giảng viên"
                  : isOutOfScope
                  ? "Ngoài phạm vi môn học"
                  : isRejected
                  ? "Yêu cầu bị từ chối"
                  : isClarify
                  ? "AI Yêu cầu làm rõ"
                  : "Thẩm định & Trả lời"}
              </h4>
              <span className="text-[11px] font-mono text-slate-400">
                {isAnswer || isOutOfScope || isRejected
                  ? processTime
                  : isEscalate
                  ? "SLA 48h"
                  : ""}
              </span>
            </div>

            <p className="text-xs text-slate-600 mt-0.5 truncate max-w-[280px]">
              {isApproved
                ? "Quyết định chính thức đã ban hành"
                : isAnswer
                ? citationSnippet
                : isEscalate
                ? result?.case_id
                  ? `Hồ sơ #${result.case_id} chuyển tiếp Thầy/Cô`
                  : "Chuyển tiếp Giảng viên phụ trách"
                : isOutOfScope
                ? "Liên hệ đơn vị phụ trách theo hướng dẫn"
                : isRejected
                ? "Yêu cầu không phù hợp quy định đào tạo"
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
                <span className="text-red-700">⏳ Giảng viên phụ trách xem xét & quyết định</span>
              ) : isOutOfScope ? (
                <span className="text-purple-700">🌐 Ngoài phạm vi — liên hệ đơn vị phụ trách</span>
              ) : isRejected ? (
                <span className="text-rose-700">🛑 Yêu cầu bị từ chối</span>
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
