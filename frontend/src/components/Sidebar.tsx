import React, { useState } from "react";
import { api } from "../api/client";
import {
  IconChevronRight,
  IconClipboard,
  IconInbox,
  IconMessageSquare,
  IconRotateCcw,
  IconScale,
  IconScroll,
  IconShield,
} from "./Icons";

export type Role = "student" | "lecturer";
export type ActiveTab = "submit" | "history" | "inbox" | "exceptions" | "audit" | "verify";

interface SidebarProps {
  role: Role;
  onSelectRole: (role: Role) => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  pendingCount?: number;
  queueCount?: number;
  aiOnline?: boolean;
}

export function Sidebar({
  role,
  onSelectRole,
  activeTab,
  onSelectTab,
  pendingCount = 0,
  queueCount = 0,
  aiOnline = true,
}: SidebarProps) {
  const [resetting, setResetting] = useState(false);

  const handleResetDemo = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn reset toàn bộ câu hỏi và đưa dữ liệu demo về trạng thái ban đầu không?")) {
      return;
    }
    setResetting(true);
    try {
      await api("/api/demo/reset", { method: "POST" });
      alert("Đã reset dữ liệu thành công! Hệ thống sẽ tải lại dữ liệu sạch.");
      window.location.reload();
    } catch (err) {
      alert("Có lỗi xảy ra khi reset: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setResetting(false);
    }
  };
  return (
    <aside className="w-[260px] flex-shrink-0 h-screen flex flex-col bg-[#0B0F17] text-slate-300 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="px-5 pt-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3 mb-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#DC2626] flex items-center justify-center flex-shrink-0 shadow-md shadow-red-900/40">
            <span className="text-white font-extrabold text-sm tracking-wider font-mono">AER</span>
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-tight leading-none">AER System</p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Academic Escalation Referee</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            Referee Core · {aiOnline ? "Active" : "Offline"}
          </span>
        </div>
      </div>

      {/* Role Switcher */}
      <div className="px-4 py-3.5 border-b border-slate-800/80">
        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-2 px-1">
          Chế độ
        </p>
        <div className="flex bg-slate-900/90 border border-slate-800 rounded-lg p-1 gap-1">
          <button
            type="button"
            onClick={() => onSelectRole("student")}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${
              role === "student"
                ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Sinh viên
          </button>
          <button
            type="button"
            onClick={() => onSelectRole("lecturer")}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${
              role === "lecturer"
                ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Giảng viên
          </button>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {role === "student" ? (
          <>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-1 px-2.5">
              Sinh viên
            </p>
            <NavItem
              icon={<IconMessageSquare size={16} />}
              label="Gửi câu hỏi"
              active={activeTab === "submit"}
              onClick={() => onSelectTab("submit")}
            />
            <NavItem
              icon={<IconClipboard size={16} />}
              label="Câu hỏi của tôi"
              active={activeTab === "history"}
              onClick={() => onSelectTab("history")}
              badge={pendingCount > 0 ? pendingCount : undefined}
            />
          </>
        ) : (
          <>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-1 px-2.5">
              Giảng viên
            </p>
            <NavItem
              icon={<IconInbox size={16} />}
              label="Hàng chờ thẩm định"
              active={activeTab === "inbox"}
              onClick={() => onSelectTab("inbox")}
              badge={queueCount > 0 ? queueCount : undefined}
            />
            <NavItem
              icon={<IconScale size={16} />}
              label="Ngoại lệ quy chế"
              active={activeTab === "exceptions"}
              onClick={() => onSelectTab("exceptions")}
            />
          </>
        )}

        {/* Shared System Section */}
        <div className="pt-5 pb-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-1 px-2.5">
            Hệ thống
          </p>
          <NavItem
            icon={<IconScroll size={16} />}
            label="Audit Log"
            active={activeTab === "audit"}
            onClick={() => onSelectTab("audit")}
          />
          <NavItem
            icon={<IconShield size={16} />}
            label="Verify Harness"
            active={activeTab === "verify"}
            onClick={() => onSelectTab("verify")}
          />
          <button
            type="button"
            disabled={resetting}
            onClick={handleResetDemo}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-slate-400 hover:text-amber-300 hover:bg-amber-950/20 transition-all border border-dashed border-slate-800 hover:border-amber-700/50 mt-2"
          >
            <span className={resetting ? "animate-spin text-amber-400" : "text-amber-400"}>
              <IconRotateCcw size={15} />
            </span>
            <span className="flex-1 text-left">{resetting ? "Đang reset..." : "Reset Data Demo"}</span>
          </button>
        </div>
      </nav>

      {/* User Footer */}
      <div className="px-3 py-3.5 border-t border-slate-800/80 bg-[#070A10]">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-all cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white shadow-inner">
            {role === "student" ? "NV" : "TM"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-100 truncate">
              {role === "student" ? "Nguyễn Văn An" : "TS. Trần Minh Tuấn"}
            </p>
            <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
              {role === "student" ? "2110482" : "Giảng viên phụ trách"}
            </p>
          </div>
          <span className="text-slate-500 group-hover:text-slate-300 transition-colors">
            <IconChevronRight size={14} />
          </span>
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all group ${
        active
          ? "bg-slate-800/80 text-white font-semibold shadow-sm border border-slate-700/60"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
      }`}
    >
      <span className={active ? "text-[#DC2626]" : "text-slate-400 group-hover:text-slate-200"}>
        {icon}
      </span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span className="min-w-[18px] h-[18px] px-1.5 bg-[#DC2626] text-white rounded-full text-[10px] font-mono font-bold flex items-center justify-center shadow-sm">
          {badge}
        </span>
      )}
    </button>
  );
}
