import React from "react";

export type CardVariant = "elevated" | "filled" | "outlined";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export function Card({
  variant = "filled",
  children,
  className = "",
  ...props
}: CardProps) {
  const variantStyles: Record<CardVariant, string> = {
    filled: "bg-[var(--surface-container)] border border-[var(--outline)]/40",
    elevated: "bg-[var(--surface)] shadow-[var(--shadow-1)] border border-[var(--outline)]/20",
    outlined: "bg-[var(--surface)] border border-[var(--outline)]",
  };

  return (
    <div
      className={`rounded-[var(--radius-lg)] p-5 transition-all ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
