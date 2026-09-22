import React from "react";
import { IconCheck } from "./Icons";
import type { CaseStatus } from "./StatusBadge";

export function Stepper({ status }: { status: CaseStatus | string }) {
  const steps = ["Gửi câu hỏi", "AI Đối soát Quy chế", "Chờ Thẩm định", "Hoàn tất"];
  
  // Determine active step based on status
  let activeStep = 1;
  if (status === "auto_replied" || status === "ANSWERED") {
    activeStep = 3; // Step 4 is complete
  } else if (status === "pending_lecturer" || status === "UNDER_REVIEW" || status === "ESCALATED") {
    activeStep = 2; // Step 3 is waiting
  } else if (status === "approved" || status === "DECIDED") {
    activeStep = 3; // Completed
  }

  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((step, i) => {
        const isComplete = i < activeStep || (activeStep === 3 && i === 3);
        const isActive = i === activeStep && activeStep !== 3;
        const isLast = i === steps.length - 1;

        return (
          <div key={i} className="flex items-center gap-0 flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold border transition-all ${
                  isComplete
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : isActive
                    ? "bg-red-50 border-red-600 text-red-600 font-bold"
                    : "bg-slate-100 border-slate-300 text-slate-400"
                }`}
              >
                {isComplete ? <IconCheck size={11} /> : i + 1}
              </div>
              <span
                className={`text-[11px] text-center leading-tight whitespace-nowrap ${
                  isComplete || isActive ? "text-slate-800 font-medium" : "text-slate-400"
                }`}
              >
                {step}
              </span>
            </div>
            {!isLast && (
              <div
                className={`h-0.5 flex-1 mx-2 mb-4 transition-all ${
                  i < activeStep ? "bg-emerald-500" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
