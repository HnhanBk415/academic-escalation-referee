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
    answer: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    clarify: "bg-amber-50 text-amber-800 border border-amber-200",
    escalate: "bg-rose-50 text-ruby-800 border border-rose-200",
    reject: "bg-red-50 text-red-800 border border-red-200",
    neutral: "bg-stone-100 text-stone-700 border border-stone-200",
    info: "bg-rose-100 text-ruby-800 border border-rose-200",
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
