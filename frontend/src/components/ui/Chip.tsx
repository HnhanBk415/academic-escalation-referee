import React from "react";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: React.ReactNode;
  onDelete?: () => void;
}

export function Chip({
  selected = false,
  icon,
  onDelete,
  children,
  className = "",
  disabled,
  ...props
}: ChipProps) {
  return (
    <button
      className={`inline-flex items-center gap-2 h-8 px-3 rounded-[var(--radius-sm)] text-xs font-medium border transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
        selected
          ? "bg-[var(--primary-container)] border-[var(--primary)] text-[var(--primary)] font-semibold"
          : "bg-[var(--surface)] border-[var(--outline)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {onDelete && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-1 p-0.5 rounded-full hover:bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]"
          aria-label="Remove"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </span>
      )}
    </button>
  );
}
