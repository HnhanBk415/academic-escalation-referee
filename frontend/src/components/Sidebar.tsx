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
            <p className="text-[10px] text-slate-400 mt-1 font-medium">aer-web.bks.vn</p>
          </div>
        </div>

        {/* Course Pill Selector */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono mt-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-bold text-white">CO3001</span>
          </div>
          <span className="text-slate-400 text-[11px] font-medium">HK261</span>
        </div>
      </div>

      {/* Role Switcher */}
      <div className="px-4 py-3 border-b border-slate-800/80">
        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-2 px-1">
          Chế độ
        </p>
        <div className="flex bg-slate-900/90 border border-slate-800 rounded-lg p-1 gap-1">
          <button
            type="button"
            onClick={() => onSelectRole("student")}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${
              role === "student"
                ? "bg-[#B91C1C] text-white shadow-sm"
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
                ? "bg-[#B91C1C] text-white shadow-sm"
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
              label="Hỏi đáp quy chế"
              active={activeTab === "submit"}
              onClick={() => onSelectTab("submit")}
            />
            <NavItem
              icon={<IconClipboard size={16} />}
              label="Hồ sơ của tôi"
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
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-amber-300 hover:bg-amber-950/20 transition-all border border-dashed border-slate-800 hover:border-amber-700/50 mt-2"
          >
            <span className={resetting ? "animate-spin text-amber-400" : "text-amber-400"}>
              <IconRotateCcw size={15} />
            </span>
            <span className="flex-1 text-left">{resetting ? "Đang reset..." : "Reset Data Demo"}</span>
          </button>
        </div>
      </nav>

      {/* Version footer */}
      <div className="px-4 py-2 text-[10px] text-slate-500 font-mono border-t border-slate-900/60">
        Phiên bản chuẩn mực v2.4
      </div>

      {/* User Footer */}
      <div className="px-3 py-3 border-t border-slate-800/80 bg-[#070A10]">
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
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all group ${
        active
          ? "bg-[#B91C1C] text-white shadow-sm"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
      }`}
    >
      <span className={active ? "text-white" : "text-slate-400 group-hover:text-slate-200"}>
        {icon}
      </span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span
          className={`min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center ${
            active ? "bg-white text-[#B91C1C]" : "bg-[#DC2626] text-white"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
