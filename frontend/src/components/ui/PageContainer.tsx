import React from "react";

export type PageContainerVariant = "wide" | "reading";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: PageContainerVariant;
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({
  variant = "wide",
  className = "",
  children,
  ...props
}: PageContainerProps) {
  const variantStyles: Record<PageContainerVariant, string> = {
    wide: "max-w-[112rem]",
    reading: "max-w-[72rem]",
  };

  return (
    <div
      className={`w-full mx-auto px-[clamp(1rem,3vw,3rem)] ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
