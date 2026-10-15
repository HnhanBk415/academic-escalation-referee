import React from "react";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: React.ReactNode;
  label?: React.ReactNode;
  onDelete?: () => void;
}

export function Chip({
  selected = false,
  icon,
  label,
  onDelete,
  children,
  className = "",
  disabled,
  ...props
}: ChipProps) {
  return (
    <button
      className={`inline-flex items-center gap-2 h-8 px-3 rounded-[var(--radius-sm)] text-xs font-medium border transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ${
        selected
          ? "bg-stone-800 border-stone-800 text-white font-semibold shadow-xs"
          : "bg-white border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label ?? children}</span>
      {onDelete && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={`ml-1 p-0.5 rounded-full ${
            selected
              ? "hover:bg-stone-700 text-stone-300"
              : "hover:bg-stone-100 text-stone-500"
          }`}
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
