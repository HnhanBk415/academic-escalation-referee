import React from "react";
import { IconCheck } from "./Icons";
import type { CaseStatus } from "./StatusBadge";

interface StepperProps {
  status: CaseStatus | string;
  route?: string | null;
}

export function Stepper({ status, route }: StepperProps) {
  const isEscalate =
    route === "ESCALATE" ||
    status === "pending_lecturer" ||
    status === "UNDER_REVIEW" ||
    status === "ESCALATED";

  const steps = isEscalate
    ? ["Gửi câu hỏi", "AI đối soát quy chế", "Giảng viên thẩm định", "Hoàn tất"]
    : ["Gửi câu hỏi", "AI đối soát quy chế", "Hoàn tất"];

  let activeStep = 0;
  let isAllComplete = false;

  if (isEscalate) {
    if (status === "pending_lecturer" || status === "UNDER_REVIEW" || status === "ESCALATED") {
      activeStep = 2; // Giảng viên thẩm định đang chờ
      isAllComplete = false;
    } else if (status === "clarify" || status === "CLARIFICATION_REQUIRED") {
      activeStep = 2;
      isAllComplete = false;
    } else if (status === "approved" || status === "DECIDED" || status === "rejected") {
      activeStep = 3;
      isAllComplete = true;
    } else {
      activeStep = 2;
    }
  } else {
    // ANSWER hoặc luồng tự động
    activeStep = 2;
    isAllComplete = true;
  }

  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((step, i) => {
        const isComplete = isAllComplete || i < activeStep;
        const isActive = !isAllComplete && i === activeStep;
        const isLast = i === steps.length - 1;

        return (
          <div key={i} className="flex items-center gap-0 flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-all ${
                  isComplete
                    ? "bg-[var(--primary)] border-[var(--primary)] text-white shadow-xs"
                    : isActive
                    ? "bg-[var(--surface)] border-2 border-[var(--primary)] text-[var(--primary)] font-semibold"
                    : "bg-[var(--surface-container)] border border-[var(--outline)]/40 text-[var(--on-surface-variant)]"
                }`}
              >
                {isComplete ? <IconCheck size={13} /> : i + 1}
              </div>
              <span
                className={`text-xs text-center leading-tight whitespace-nowrap ${
                  isComplete || isActive ? "text-[var(--on-surface)] font-medium" : "text-[var(--on-surface-variant)]"
                }`}
              >
                {step}
              </span>
            </div>
            {!isLast && (
              <div
                className={`h-0.5 flex-1 mx-2 mb-4 transition-all ${
                  isComplete ? "bg-[var(--primary)]" : "bg-[var(--outline)]/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
