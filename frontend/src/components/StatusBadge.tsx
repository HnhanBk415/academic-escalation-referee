import React from "react";

export type CaseStatus = "auto_replied" | "pending_lecturer" | "approved";
export type EscalationTag = "OUT_OF_POLICY" | "INSUFFICIENT_EVIDENCE" | string;

export function StatusBadge({ status }: { status: CaseStatus | string }) {
  if (status === "auto_replied" || status === "ANSWERED" || status === "ANSWER") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
        TỰ ĐỘNG PHẢN HỒI
      </span>
    );
  }
  if (status === "pending_lecturer" || status === "UNDER_REVIEW" || status === "ESCALATED" || status === "ESCALATE") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider font-mono bg-amber-50 text-amber-800 border border-amber-200">
        CHUYỂN TIẾP · CHỜ DUYỆT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider font-mono bg-sky-50 text-sky-700 border border-sky-200">
      GIẢNG VIÊN ĐÃ DUYỆT
    </span>
  );
}

export function EscalationTagBadge({ tag }: { tag: EscalationTag }) {
  const isOOP = tag === "OUT_OF_POLICY";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${
        isOOP
          ? "bg-rose-50 text-rose-700 border-rose-200"
          : "bg-amber-50 text-amber-700 border-amber-200"
      }`}
    >
      {tag}
    </span>
  );
}
