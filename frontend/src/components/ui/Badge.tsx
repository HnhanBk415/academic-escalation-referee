import React from "react";

export type BadgeTone = "answer" | "clarify" | "escalate" | "reject" | "neutral" | "info";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  route?: string;
}

export function Badge({ tone, route, children, className = "", ...props }: BadgeProps) {
  let resolvedTone: BadgeTone = tone || "neutral";

  if (route) {
    const upper = route.toUpperCase();
    if (upper.includes("ANSWER")) resolvedTone = "answer";
    else if (upper.includes("CLARIFY")) resolvedTone = "clarify";
    else if (upper.includes("ESCALATE")) resolvedTone = "escalate";
    else if (upper.includes("REJECT")) resolvedTone = "reject";
  }

  const toneStyles: Record<BadgeTone, string> = {
    answer: "bg-[#E8F5E9] text-[#146C2E] border border-[#C8E6C9]",
    clarify: "bg-[#E3F2FD] text-[#0B57D0] border border-[#BBDEFB]",
    escalate: "bg-[#FFF8E1] text-[#8C5000] border border-[#FFE082]",
    reject: "bg-[#FFEBEE] text-[#B3261E] border border-[#FFCDD2]",
    neutral: "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] border border-[var(--outline)]/40",
    info: "bg-[var(--primary-container)] text-[var(--primary)] border border-[var(--primary)]/30",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium tracking-normal select-none ${toneStyles[resolvedTone]} ${className}`}
      {...props}
    >
      {children || route}
    </span>
  );
}
