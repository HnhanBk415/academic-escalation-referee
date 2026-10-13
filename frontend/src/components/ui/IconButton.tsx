import React from "react";

export type IconButtonVariant = "standard" | "tonal" | "filled" | "outlined";
export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  icon: React.ReactNode;
  "aria-label": string;
}

export function IconButton({
  variant = "standard",
  size = "md",
  icon,
  className = "",
  disabled,
  ...props
}: IconButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center rounded-full transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-40 disabled:cursor-not-allowed";

  const sizeStyles: Record<IconButtonSize, string> = {
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-12 h-12 text-lg",
  };

  const variantStyles: Record<IconButtonVariant, string> = {
    standard:
      "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--on-surface)] active:bg-[#C8D1DC]",
    tonal:
      "bg-[var(--surface-container-high)] text-[var(--on-surface)] hover:bg-[#CFD8E1] active:bg-[#C2CCD6]",
    filled:
      "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[#0842A0] active:bg-[#073682]",
    outlined:
      "border border-[var(--outline)] text-[var(--on-surface)] hover:bg-[var(--surface-container)]",
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon}
    </button>
  );
}
