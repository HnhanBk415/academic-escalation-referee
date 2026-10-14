import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { HelpCircle, BookOpen, Compass, RotateCcw, Play } from "lucide-react";
import { AccountSwitcher, type DemoAccount } from "./AccountSwitcher";
import { useTour } from "../tour/useTour";

interface AppHeaderProps {
  currentAccountId: string;
  currentRole: "student" | "lecturer";
  aiOnline: boolean;
  onSelectAccount: (account: DemoAccount) => void;
  activeGroupLabel?: string;
}

export function AppHeader({
  currentAccountId,
  currentRole,
  aiOnline,
  onSelectAccount,
  activeGroupLabel,
}: AppHeaderProps) {
  const location = useLocation();
  const pathname = location.pathname;

  const { startTour, startAppShellTour, resetAllTours } = useTour();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const helpMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (helpMenuRef.current && !helpMenuRef.current.contains(event.target as Node)) {
        setIsHelpOpen(false);
      }
    }
    if (isHelpOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isHelpOpen]);

  const defaultWorkspaceFeature = currentRole === "student" ? "ask" : "inbox";
  const workspacePath = `/workspace/${defaultWorkspaceFeature}`;

  const navItems = [
    { label: "Trang chủ", path: "/", exact: true },
    { label: "Không gian làm việc", path: workspacePath, prefix: "/workspace" },
    { label: "Audit Log", path: "/audit", prefix: "/audit" },
    { label: "Verify Harness", path: "/verify", prefix: "/verify" },
  ];

  const isItemActive = (item: (typeof navItems)[0]) => {
    if (item.exact) return pathname === "/";
    if (item.prefix) return pathname.startsWith(item.prefix);
    return false;
  };

  return (
    <header className="sticky top-0 z-40 h-16 px-4 sm:px-6 bg-[var(--surface-dim)] border-b border-[var(--outline)]/30 flex items-center justify-between shrink-0 select-none">
      {/* Left: Brand */}
      <div className="flex items-center gap-6">
        <Link to="/" data-tour="app-logo" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[#C51A1B] flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105">
            <span className="text-white font-mono font-semibold text-xs tracking-wider">AER</span>
          </div>
          <div>
            <span className="font-semibold text-base text-[var(--on-surface)] tracking-tight">
              AER System
            </span>
          </div>
        </Link>

        {/* Center-left: Navigation Pills */}
        <nav data-tour="main-nav" className="hidden md:flex items-center gap-1.5 ml-4">
          {navItems.map((item) => {
            const active = isItemActive(item);
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`h-9 px-4 rounded-[var(--radius-xl)] text-xs transition-colors flex items-center justify-center font-medium ${
                  active
                    ? "bg-[var(--primary-container)] text-[var(--primary)] font-semibold shadow-xs"
                    : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right: Help Button & Account Switcher */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Help Button with Dropdown Menu */}
        <div className="relative" ref={helpMenuRef}>
          <button
            type="button"
            data-tour="help-button"
            title="Hướng dẫn trang này"
            aria-label="Hướng dẫn trang này"
            aria-haspopup="true"
            aria-expanded={isHelpOpen}
            onClick={() => setIsHelpOpen((prev) => !prev)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--on-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] border border-[var(--outline)]/40 bg-[var(--surface-container)] cursor-pointer"
          >
            <HelpCircle size={18} />
          </button>

          {isHelpOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-2)] border border-[var(--outline)]/40 py-1.5 z-50 animate-fade-in select-none">
              <button
                type="button"
                onClick={() => {
                  setIsHelpOpen(false);
                  startTour();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-left font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container)] transition-colors cursor-pointer"
              >
                <BookOpen size={16} className="text-[var(--primary)] shrink-0" />
                <span>Hướng dẫn trang này</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsHelpOpen(false);
                  startAppShellTour();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-left font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container)] transition-colors cursor-pointer"
              >
                <Compass size={16} className="text-[var(--primary)] shrink-0" />
                <span>Giới thiệu giao diện chung</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsHelpOpen(false);
                  startTour("demo-scenario");
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-left font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container)] transition-colors cursor-pointer"
              >
                <Play size={16} className="text-[var(--primary)] shrink-0" />
                <span>Kịch bản test nhanh</span>
              </button>
              <div className="my-1 border-t border-[var(--outline)]/30" />
              <button
                type="button"
                onClick={() => {
                  setIsHelpOpen(false);
                  resetAllTours();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-left font-medium text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] transition-colors cursor-pointer"
              >
                <RotateCcw size={15} className="shrink-0" />
                <span>Đặt lại tất cả hướng dẫn</span>
              </button>
            </div>
          )}
        </div>

        <AccountSwitcher
          currentAccountId={currentAccountId}
          aiOnline={aiOnline}
          onSelectAccount={onSelectAccount}
          activeGroupLabel={activeGroupLabel}
          onOpenTour={() => startTour()}
        />
      </div>
    </header>
  );
}

