import React from "react";
import { Check } from "lucide-react";
import { Badge } from "./ui/Badge";
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
  const hasResult = Boolean(result);
  const isSubmitted = busy || hasResult;
  const isAnswer = result?.route === "ANSWER";
  const isEscalate = result?.route === "ESCALATE";
  const isClarify = result?.route === "CLARIFY";
  const isOutOfScope = result?.route === "OUT_OF_SCOPE";
  const isRejected = result?.route === "REJECT";
  const isApproved = Boolean(result?.final_decision);

  // Citation text for step 3 subtitle
  const citationSnippet =
    result?.citations && result.citations.length > 0
      ? `${result.citations[0].document_title} ${
          result.citations[0].heading ? `· ${result.citations[0].heading}` : ""
        }`
      : "Trích xuất quy định quy chế hiện hành";

  // Step 1 status
  const step1Done = isSubmitted;

  // Step 2 status
  const step2Done = hasResult;
  const step2Active = busy;

  // Step 3 status
  const step3Done = hasResult && (isApproved || isAnswer || isOutOfScope || isRejected);
  const step3Active = hasResult && (isEscalate || isClarify);

  return (
    <div className="w-full bg-[var(--surface)] border border-[var(--outline)]/30 rounded-[var(--radius-lg)] p-5 shadow-xs transition-all">
      {/* Header bar of the tracker with Material 3 Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-[var(--outline)]/20">
        <span className="text-sm font-medium text-[var(--on-surface)]">
          Tiến trình thẩm định & phân luồng học vụ
        </span>

        {/* Dynamic Badge showing resolution status */}
        <div>
          {busy ? (
            <Badge tone="escalate">
              <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse inline-block" />
              Đang đối soát & phân luồng…
            </Badge>
          ) : result?.applied_exception_id ? (
            <Badge tone="answer">Đã áp dụng ngoại lệ #{result.applied_exception_id}</Badge>
          ) : isAnswer ? (
            <Badge tone="answer">AI trả lời tự động</Badge>
          ) : isApproved ? (
            <Badge tone="answer">Giảng viên đã phê duyệt</Badge>
          ) : isEscalate ? (
            <Badge tone="clarify">Chuyển giảng viên</Badge>
          ) : isOutOfScope ? (
            <Badge tone="neutral">Ngoài phạm vi môn học</Badge>
          ) : isRejected ? (
            <Badge tone="reject">Yêu cầu bị từ chối</Badge>
          ) : isClarify ? (
            <Badge tone="escalate">Cần bổ sung thông tin</Badge>
          ) : (
            <Badge tone="neutral">Sẵn sàng tra cứu</Badge>
          )}
        </div>
      </div>

      {/* Horizontal Pipeline Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {/* ── BƯỚC 1: GỬI CÂU HỎI ── */}
        <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center w-full mb-2.5">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-medium transition-all shrink-0 z-10 text-xs ${
                step1Done
                  ? "bg-[var(--primary)] text-white shadow-xs"
                  : "border border-[var(--outline)]/40 bg-[var(--surface-container)] text-[var(--on-surface-variant)]"
              }`}
            >
              {step1Done ? <Check size={16} strokeWidth={2.5} /> : "1"}
            </div>
            {/* Connecting line to Step 2 */}
            <div
              className={`hidden md:block flex-1 h-0.5 ml-3 -mr-6 z-0 transition-colors ${
                step1Done ? "bg-[var(--primary)]" : "bg-[var(--outline)]/20"
              }`}
            />
          </div>

          <div className="mt-1">
            <div className="flex items-center justify-center md:justify-start gap-1.5">
              <h4 className="text-sm font-medium text-[var(--on-surface)]">Gửi câu hỏi</h4>
              {isSubmitted && submitTime && (
                <span className="text-xs font-mono text-[var(--on-surface-variant)]">
                  {submitTime}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">Sinh viên gửi đề xuất học vụ</p>
            <p className="text-xs text-[var(--on-surface-variant)]/80 mt-0.5">
              {isSubmitted ? "Đã tiếp nhận vào hệ thống" : "Chờ gửi câu hỏi"}
            </p>
          </div>
        </div>

        {/* ── BƯỚC 2: KIỂM TRA & PHÂN LUỒNG ── */}
        <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center w-full mb-2.5">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-medium transition-all shrink-0 z-10 text-xs ${
                step2Done
                  ? "bg-[var(--primary)] text-white shadow-xs"
                  : step2Active
                  ? "border-2 border-[var(--primary)] bg-[var(--surface)] text-[var(--primary)] font-semibold"
                  : "border border-[var(--outline)]/40 bg-[var(--surface-container)] text-[var(--on-surface-variant)]"
              }`}
            >
              {step2Done ? (
                <Check size={16} strokeWidth={2.5} />
              ) : step2Active ? (
                <span className="w-3.5 h-3.5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              ) : (
                "2"
              )}
            </div>
            {/* Connecting line to Step 3 */}
            <div
              className={`hidden md:block flex-1 h-0.5 ml-3 -mr-6 z-0 transition-colors ${
                step2Done ? "bg-[var(--primary)]" : "bg-[var(--outline)]/20"
              }`}
            />
          </div>

          <div className="mt-1">
            <div className="flex items-center justify-center md:justify-start gap-1.5">
              <h4 className="text-sm font-medium text-[var(--on-surface)]">
                Kiểm tra & Phân luồng
              </h4>
              {hasResult && processTime && (
                <span className="text-xs font-mono text-[var(--on-surface-variant)]">
                  {processTime}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">RAG đối chiếu quy chế định mức</p>
            <p className="text-xs text-[var(--on-surface-variant)] mt-0.5 font-medium">
              {busy ? (
                <span className="text-[var(--primary)]">Đang rà soát điều khoản…</span>
              ) : isAnswer ? (
                <span className="text-[#146C2E]">Quy chuẩn hợp lệ (Đủ thẩm quyền AI)</span>
              ) : isEscalate ? (
                <span className="text-ruby-800">Ngoại lệ thẩm quyền Giảng viên môn học</span>
              ) : isOutOfScope ? (
                <span>Ngoài phạm vi giải quyết của môn học</span>
              ) : isRejected ? (
                <span className="text-[var(--error)]">Yêu cầu bị từ chối / Vi phạm quy chế</span>
              ) : isClarify ? (
                <span className="text-[#8C5000]">Thiếu dữ kiện tình huống cụ thể</span>
              ) : (
                "Chờ tiếp nhận & phân luồng"
              )}
            </p>
          </div>
        </div>

        {/* ── BƯỚC 3: THẨM ĐỊNH & TRẢ LỜI ── */}
        <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center w-full mb-2.5">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-medium transition-all shrink-0 z-10 text-xs ${
                step3Done
                  ? "bg-[var(--primary)] text-white shadow-xs"
                  : step3Active
                  ? "border-2 border-[var(--primary)] bg-[var(--surface)] text-[var(--primary)] font-semibold"
                  : "border border-[var(--outline)]/40 bg-[var(--surface-container)] text-[var(--on-surface-variant)]"
              }`}
            >
              {step3Done ? <Check size={16} strokeWidth={2.5} /> : "3"}
            </div>
          </div>

          <div className="mt-1">
            <div className="flex items-center justify-center md:justify-start gap-1.5">
              <h4 className="text-sm font-medium text-[var(--on-surface)]">
                {isApproved
                  ? "Giảng viên đã phản hồi"
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
              <span className="text-xs font-mono text-[var(--on-surface-variant)]">
                {isAnswer || isOutOfScope || isRejected
                  ? processTime
                  : isEscalate
                  ? "SLA 48h"
                  : ""}
              </span>
            </div>

            <p className="text-xs text-[var(--on-surface-variant)] mt-0.5 truncate max-w-[17.5rem]">
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

            <div className="text-xs mt-1">
              {isApproved ? (
                <span className="text-[#146C2E] font-medium">Đã được phê duyệt & ghi nhận ngoại lệ</span>
              ) : isAnswer ? (
                <span className="text-[#146C2E] font-medium">Đầy đủ căn cứ pháp lý · Trả lời tự động</span>
              ) : isEscalate ? (
                <span className="text-ruby-800 font-medium">Giảng viên phụ trách xem xét & quyết định</span>
              ) : isOutOfScope ? (
                <span className="text-[var(--on-surface-variant)] font-medium">Ngoài phạm vi — liên hệ đơn vị phụ trách</span>
              ) : isRejected ? (
                <span className="text-[var(--error)] font-medium">Yêu cầu bị từ chối</span>
              ) : isClarify ? (
                <span className="text-[#8C5000] font-medium">Chờ sinh viên bổ sung tình huống cụ thể</span>
              ) : (
                <span className="text-[var(--on-surface-variant)]/70">Tự động đối soát bởi AI hoặc Giảng viên</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
