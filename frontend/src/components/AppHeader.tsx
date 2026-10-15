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
    { label: "Verify Harness", path: "/verify", prefix: "/verify" },
  ];

  const isItemActive = (item: (typeof navItems)[0]) => {
    if (item.exact) return pathname === "/";
    if (item.prefix) return pathname.startsWith(item.prefix);
    return false;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-rose-100 shadow-[0_1px_8px_rgba(190,18,60,0.05)] select-none">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Navigation Links */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link to="/" className="flex items-center gap-3 group" data-tour="app-logo">
            <img
              src="/logo.png"
              alt="AER Logo"
              className="w-10 h-10 object-contain rounded-xl shadow-xs group-hover:scale-105 transition-transform"
            />
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg tracking-tight text-stone-900 group-hover:text-ruby-800 transition-colors leading-tight">
                AER <span className="text-ruby-700">System</span>
              </span>
              <span className="text-[10px] font-medium text-stone-500 tracking-tight hidden sm:block">
                Academic Escalation Referee
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav data-tour="main-nav" className="hidden md:flex items-center gap-1.5 text-sm font-semibold">
            {navItems.map((item) => {
              const active = isItemActive(item);
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm transition-all ${
                    active
                      ? "bg-rose-100/80 text-ruby-800 font-bold shadow-xs"
                      : "text-stone-600 hover:text-ruby-800 hover:bg-rose-50/70"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Quick Action (if student) + AI Status + Help Tour + Account Switcher */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Link
            to="/audit"
            className="hidden sm:inline-flex items-center gap-1.5 bg-ruby-700 hover:bg-ruby-800 text-white font-semibold text-xs px-3.5 py-1.5 rounded-full shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            <span>Audit Log</span>
          </Link>

          {/* AI Status Indicator Pill */}
          <div
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              aiOnline
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
            }`}
            title={aiOnline ? "Hệ thống AI đang hoạt động bình thường" : "AI đang kết nối"}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                aiOnline ? "bg-emerald-600 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span>{aiOnline ? "AI Sẵn sàng" : "Kiểm tra..."}</span>
          </div>

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
              className="w-9 h-9 rounded-full flex items-center justify-center text-stone-600 hover:text-ruby-800 hover:bg-rose-50 transition-colors border border-rose-200/80 bg-white shadow-xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ruby-700"
            >
              <HelpCircle size={17} />
            </button>

            {isHelpOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-rose-100 py-1.5 z-50 animate-fade-in select-none">
                <button
                  type="button"
                  onClick={() => {
                    setIsHelpOpen(false);
                    startTour();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-left font-medium text-stone-800 hover:bg-rose-50/70 transition-colors cursor-pointer"
                >
                  <BookOpen size={16} className="text-ruby-700 shrink-0" />
                  <span>Hướng dẫn trang này</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsHelpOpen(false);
                    startAppShellTour();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-left font-medium text-stone-800 hover:bg-rose-50/70 transition-colors cursor-pointer"
                >
                  <Compass size={16} className="text-ruby-700 shrink-0" />
                  <span>Giới thiệu giao diện chung</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsHelpOpen(false);
                    startTour("demo-scenario");
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-left font-medium text-stone-800 hover:bg-rose-50/70 transition-colors cursor-pointer"
                >
                  <Play size={16} className="text-ruby-700 shrink-0" />
                  <span>Kịch bản test nhanh</span>
                </button>
                <div className="my-1 border-t border-rose-100" />
                <button
                  type="button"
                  onClick={() => {
                    setIsHelpOpen(false);
                    resetAllTours();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-left font-medium text-stone-500 hover:bg-rose-50/70 hover:text-ruby-800 transition-colors cursor-pointer"
                >
                  <RotateCcw size={15} className="shrink-0" />
                  <span>Đặt lại tất cả hướng dẫn</span>
                </button>
              </div>
            )}
          </div>

          {/* Account Switcher */}
          <AccountSwitcher
            currentAccountId={currentAccountId}
            aiOnline={aiOnline}
            onSelectAccount={onSelectAccount}
            activeGroupLabel={activeGroupLabel}
            onOpenTour={() => startTour()}
          />
        </div>
      </div>
    </header>
  );
}
