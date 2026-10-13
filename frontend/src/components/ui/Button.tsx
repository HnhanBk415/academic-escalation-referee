import React from "react";

export type ButtonVariant = "filled" | "tonal" | "outlined" | "text" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  loading?: boolean;
}

export function Button({
  variant = "filled",
  size = "md",
  icon,
  iconPosition = "left",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none whitespace-nowrap [&_svg]:shrink-0 [&_svg]:inline-block";

  const sizeStyles: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-xs gap-1.5 rounded-[var(--radius-xl)]",
    md: "h-10 px-5 text-sm gap-2 rounded-[var(--radius-xl)]",
    lg: "h-12 px-6 text-base gap-2.5 rounded-[var(--radius-xl)]",
  };

  const variantStyles: Record<ButtonVariant, string> = {
    filled:
      "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[#0842A0] active:bg-[#073682]",
    tonal:
      "bg-[var(--surface-container-high)] text-[var(--on-surface)] hover:bg-[#CFD8E1] active:bg-[#C2CCD6]",
    outlined:
      "border border-[var(--outline)] text-[var(--primary)] hover:bg-[var(--surface-container)] active:bg-[var(--surface-container-high)]",
    text:
      "text-[var(--primary)] hover:bg-[var(--surface-container)] active:bg-[var(--surface-container-high)]",
    danger:
      "bg-[var(--error)] text-white hover:bg-[#961F18] active:bg-[#7D1913]",
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin -ml-0.5 mr-1.5 h-4 w-4 text-current shrink-0 inline-block"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : icon && iconPosition === "left" ? (
        <span className="shrink-0 inline-flex items-center">{icon}</span>
      ) : null}
      <span className="inline-flex items-center gap-2 whitespace-nowrap">{children}</span>
      {!loading && icon && iconPosition === "right" ? (
        <span className="shrink-0 inline-flex items-center">{icon}</span>
      ) : null}
    </button>
  );
}
