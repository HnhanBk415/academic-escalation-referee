import React from "react";
import { Check } from "lucide-react";
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

  const progressPercent = isAllComplete
    ? 100
    : steps.length > 1
    ? (activeStep / (steps.length - 1)) * 100
    : 0;

  return (
    <div className="relative w-full py-1">
      {/* Continuous connecting line positioned behind nodes */}
      <div className="absolute top-3.5 left-6 right-6 sm:left-10 sm:right-10 h-[2px] bg-rose-100 -z-0">
        <div
          className="h-full bg-ruby-700 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Grid of step nodes preventing any text overlapping */}
      <div
        className={`relative z-10 grid gap-1 sm:gap-2 text-center ${
          steps.length === 4 ? "grid-cols-4" : "grid-cols-3"
        }`}
      >
        {steps.map((step, i) => {
          const isComplete = isAllComplete || i < activeStep;
          const isActive = !isAllComplete && i === activeStep;

          return (
            <div key={i} className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-2xs ring-4 ring-white ${
                  isComplete
                    ? "bg-ruby-700 text-white"
                    : isActive
                    ? "bg-white border-2 border-ruby-700 text-ruby-800"
                    : "border border-stone-200 bg-stone-50 text-stone-400"
                }`}
              >
                {isComplete ? <Check size={13} strokeWidth={2.5} /> : i + 1}
              </div>
              <span
                className={`text-[11px] sm:text-xs text-center mt-1.5 leading-tight px-0.5 max-w-[5.5rem] break-words ${
                  isComplete || isActive
                    ? "text-stone-900 font-semibold"
                    : "text-stone-400 font-medium"
                }`}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
