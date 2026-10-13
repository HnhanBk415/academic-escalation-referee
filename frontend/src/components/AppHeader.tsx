import React from "react";
import { Link, useLocation } from "react-router-dom";
import { AccountSwitcher, type DemoAccount } from "./AccountSwitcher";

interface AppHeaderProps {
  currentAccountId: string;
  currentRole: "student" | "lecturer";
  aiOnline: boolean;
  onSelectAccount: (account: DemoAccount) => void;
}

export function AppHeader({
  currentAccountId,
  currentRole,
  aiOnline,
  onSelectAccount,
}: AppHeaderProps) {
  const location = useLocation();
  const pathname = location.pathname;

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
    <header className="h-16 px-4 sm:px-6 bg-[var(--surface-dim)] border-b border-[var(--outline)]/30 flex items-center justify-between shrink-0 select-none z-40">
      {/* Left: Brand */}
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[#C51A1B] flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105">
            <span className="text-white font-mono font-bold text-xs tracking-wider">AER</span>
          </div>
          <div>
            <span className="font-semibold text-base text-[var(--on-surface)] tracking-tight">
              AER System
            </span>
          </div>
        </Link>

        {/* Center-left: Navigation Pills */}
        <nav className="hidden md:flex items-center gap-1.5 ml-4">
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

      {/* Right: Account Switcher */}
      <div className="flex items-center gap-3">
        <AccountSwitcher
          currentAccountId={currentAccountId}
          aiOnline={aiOnline}
          onSelectAccount={onSelectAccount}
        />
      </div>
    </header>
  );
}
