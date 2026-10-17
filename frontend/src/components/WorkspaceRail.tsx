import React from "react";
import { Link, useParams } from "react-router-dom";
import {
  MessageSquare,
  ClipboardList,
  Inbox,
  Scale,
  FileText,
  PanelLeftClose,
} from "lucide-react";

export interface WorkspaceRailProps {
  role: "student" | "lecturer";
  pendingCount?: number;
  queueCount?: number;
  onToggleCollapse?: () => void;
  serviceStaff?: boolean;
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
  onToggleCollapse,
  serviceStaff = false,
}: WorkspaceRailProps) {
  const { feature: currentFeature } = useParams<{ feature: string }>();

  const studentItems: RailItem[] = [
    {
      feature: "ask",
      label: "Hỏi đáp",
      icon: MessageSquare,
    },
    {
      feature: "history",
      label: "Lịch sử xử lý yêu cầu",
      icon: ClipboardList,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
  ];

  const lecturerItems: RailItem[] = serviceStaff
    ? [
        { feature: "service-requests", label: "Hộp thư dịch vụ", icon: Inbox },
      ]
    : [
        {
          feature: "inbox",
          label: "Câu hỏi cần duyệt",
          icon: Inbox,
          badge: queueCount > 0 ? queueCount : undefined,
        },
        { feature: "service-requests", label: "Yêu cầu dịch vụ", icon: ClipboardList },
        { feature: "exceptions", label: "Ngoại lệ đã duyệt", icon: Scale },
        { feature: "documents", label: "Tải quy chế", icon: FileText },
      ];

  const items = role === "student" ? studentItems : lecturerItems;

  return (
    <aside data-tour="workspace-rail" className="w-full lg:w-60 shrink-0">
      <div className="bg-white/90 border border-rose-100 rounded-2xl p-2.5 shadow-sm space-y-1 sticky top-20 backdrop-blur-md">
        {/* Rail Header with collapse toggle button */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-rose-100/60 mb-1">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
            Danh mục
          </span>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 rounded-lg text-stone-400 hover:text-ruby-700 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Thu gọn thanh danh mục"
            >
              <PanelLeftClose size={15} />
            </button>
          )}
        </div>

        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentFeature === item.feature;
          return (
            <Link
              key={item.feature}
              to={`/workspace/${item.feature}`}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-2xs ${
                isActive
                  ? "bg-rose-100 text-ruby-900 border border-rose-200"
                  : "text-stone-600 hover:text-stone-900 hover:bg-rose-50/60"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  size={17}
                  className={isActive ? "text-ruby-700" : "text-stone-400"}
                />
                <span className="truncate tracking-tight">{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-2 py-0.5 rounded-full bg-ruby-700 text-white font-bold text-xs tracking-tight shadow-sm shrink-0 ml-1.5">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
