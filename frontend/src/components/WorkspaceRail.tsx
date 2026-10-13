import React, { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import {
  MessageSquare,
  ClipboardList,
  Inbox,
  Scale,
  FileText,
} from "lucide-react";

export interface WorkspaceRailProps {
  role: "student" | "lecturer";
  pendingCount?: number;
  queueCount?: number;
}

interface RailItem {
  feature: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
}

export function WorkspaceRail({
  role,
  pendingCount = 0,
  queueCount = 0,
}: WorkspaceRailProps) {
  const { feature: currentFeature } = useParams<{ feature: string }>();
  const [isExpanded, setIsExpanded] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const studentItems: RailItem[] = [
    {
      feature: "ask",
      label: "Hỏi đáp",
      icon: MessageSquare,
    },
    {
      feature: "history",
      label: "Xem các câu đã hỏi",
      icon: ClipboardList,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
  ];

  const lecturerItems: RailItem[] = [
    {
      feature: "inbox",
      label: "Câu hỏi cần duyệt",
      icon: Inbox,
      badge: queueCount > 0 ? queueCount : undefined,
    },
    {
      feature: "exceptions",
      label: "Ngoại lệ đã duyệt",
      icon: Scale,
    },
    {
      feature: "documents",
      label: "Tải quy chế",
      icon: FileText,
    },
  ];

  const items = role === "student" ? studentItems : lecturerItems;

  const triggerExpand = () => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    setIsExpanded(true);
  };

  const triggerCollapse = () => {
    if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    collapseTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 300);
  };

  // Mouse move listener: expand when cursor is within 96px from the left edge of screen
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerWidth < 768) return; // Desktop only
      if (e.clientX <= 96) {
        triggerExpand();
      } else if (!railRef.current?.contains(e.target as Node)) {
        // Outside the 96px trigger zone and outside the rail
        triggerCollapse();
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    };
  }, []);

  return (
    <>
      {/* Desktop Floating Rail */}
      <aside
        ref={railRef}
        aria-label="Thanh điều hướng tính năng"
        onMouseEnter={triggerExpand}
        onMouseLeave={triggerCollapse}
        onFocus={triggerExpand}
        onBlur={(e) => {
          if (!railRef.current?.contains(e.relatedTarget as Node)) {
            triggerCollapse();
          }
        }}
        className={`hidden md:flex fixed left-3 top-1/2 -translate-y-1/2 z-30 flex-col items-center bg-[var(--surface-container)] border border-[var(--outline)]/40 rounded-[28px] py-3 px-2 shadow-sm transition-[width,box-shadow] duration-200 ease-out select-none ${
          isExpanded
            ? "w-[210px] items-stretch shadow-[var(--shadow-2)] bg-[var(--surface-container-high)]"
            : "w-16"
        }`}
      >
        <div className="flex flex-col gap-2 w-full">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = currentFeature === item.feature;
            return (
              <Link
                key={item.feature}
                to={`/workspace/${item.feature}`}
                aria-label={item.label}
                title={item.label}
                className={`relative flex items-center h-12 rounded-[24px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                  isActive
                    ? "bg-[var(--primary-container)] text-[var(--primary)] font-semibold"
                    : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--on-surface)]"
                } ${isExpanded ? "px-3 gap-3" : "justify-center px-0"}`}
              >
                {/* 40px Icon Container */}
                <div className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                  <Icon size={20} className={isActive ? "text-[var(--primary)]" : "currentColor"} />
                  {/* Collapsed Badge */}
                  {!isExpanded && item.badge !== undefined && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--error)] text-white text-[10px] font-bold font-mono flex items-center justify-center shadow-xs">
                      {item.badge}
                    </span>
                  )}
                </div>

                {/* Expanded Label & Badge */}
                {isExpanded && (
                  <div className="flex-1 min-w-0 flex items-center justify-between overflow-hidden">
                    <span className="text-xs truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="ml-2 min-w-[18px] h-[18px] px-1.5 rounded-full bg-[var(--error)] text-white text-[10px] font-bold font-mono flex items-center justify-center shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (< 768px) */}
      <nav
        aria-label="Điều hướng tính năng di động"
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--surface-container)] border-t border-[var(--outline)]/40 flex items-center justify-around px-2 z-40 select-none shadow-[var(--shadow-1)]"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentFeature === item.feature;
          return (
            <Link
              key={item.feature}
              to={`/workspace/${item.feature}`}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors relative ${
                isActive
                  ? "text-[var(--primary)] font-semibold"
                  : "text-[var(--on-surface-variant)]"
              }`}
            >
              <div
                className={`w-12 h-8 rounded-full flex items-center justify-center transition-colors relative ${
                  isActive ? "bg-[var(--primary-container)]" : ""
                }`}
              >
                <Icon size={18} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--error)] text-white text-[9px] font-bold font-mono flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 truncate max-w-[80px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
