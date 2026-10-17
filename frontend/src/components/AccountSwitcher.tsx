import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, RotateCcw, HelpCircle } from "lucide-react";
import { Modal, Button } from "./ui";
import { api } from "../api/client";

export interface DemoAccount {
  id: string;
  role: "student" | "lecturer";
  name: string;
  roleLabel: string;
  groupLabel?: string;
  groupId?: string;
  courseId: string;
  initials: string;
  avatarBg: string;
  serviceStaff?: boolean;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "demo-student-01",
    role: "student",
    name: "Sinh viên demo DADN",
    roleLabel: "Sinh viên · nhóm DADN",
    groupId: "dadn-group-a",
    courseId: "DADN-HK242",
    initials: "SV",
    avatarBg: "#0369a1",
  },
  {
    id: "student-a1",
    role: "student",
    name: "User (Sinh viên)",
    roleLabel: "User",
    groupId: "group-a",
    courseId: "CO3001",
    initials: "U",
    avatarBg: "#be123c",
  },
  {
    id: "lecturer-01",
    role: "lecturer",
    name: "TS. Trần Minh Tuấn",
    roleLabel: "Giảng viên",
    courseId: "CO3001",
    initials: "GV",
    avatarBg: "#881337",
  },
  {
    id: "academic-affairs-01",
    role: "lecturer",
    name: "Nhân viên Phòng Đào tạo",
    roleLabel: "Hộp thư · Phòng Đào tạo",
    courseId: "CO3001",
    initials: "ĐT",
    avatarBg: "#7c3aed",
    serviceStaff: true,
  },
  {
    id: "clinic-staff-01",
    role: "lecturer",
    name: "Nhân viên Trạm Y tế",
    roleLabel: "Hộp thư · Trạm Y tế",
    courseId: "CO3001",
    initials: "YT",
    avatarBg: "#059669",
    serviceStaff: true,
  },
  {
    id: "student-affairs-01",
    role: "lecturer",
    name: "Nhân viên PCTSV",
    roleLabel: "Hộp thư · PCTSV",
    courseId: "CO3001",
    initials: "CT",
    avatarBg: "#d97706",
    serviceStaff: true,
  },
];

interface AccountSwitcherProps {
  currentAccountId: string;
  aiOnline: boolean;
  onSelectAccount: (account: DemoAccount) => void;
  activeGroupLabel?: string;
  onOpenTour?: () => void;
}

export function AccountSwitcher({
  currentAccountId,
  aiOnline,
  onSelectAccount,
  activeGroupLabel,
  onOpenTour,
}: AccountSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentAccount =
    DEMO_ACCOUNTS.find((acc) => acc.id === currentAccountId) || DEMO_ACCOUNTS[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleResetConfirm = async () => {
    setIsResetting(true);
    setResetError(null);
    try {
      await api("/api/demo/reset", { method: "POST" });
      setShowResetModal(false);
      window.location.reload();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="relative" ref={menuRef} data-tour="account-switcher">
      {/* Account Switcher Chip */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 h-11 px-3 rounded-[var(--radius-xl)] bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] transition-colors border border-[var(--outline)]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {/* Avatar with AI dot */}
        <div className="relative">
          <div
            className="w-7 h-7 rounded-full text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-sm"
            style={{ backgroundColor: currentAccount.avatarBg }}
          >
            {currentAccount.initials}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--surface-dim)] ${
              aiOnline ? "bg-[var(--success)]" : "bg-neutral-400"
            }`}
            title={aiOnline ? "AI Online" : "AI Offline"}
          />
        </div>

        {/* Name and Role */}
        <div className="text-left hidden sm:block">
          <p className="text-xs font-medium text-[var(--on-surface)] leading-tight truncate max-w-[8.125rem]">
            {currentAccount.name}
          </p>
          <p className="text-xs text-[var(--on-surface-variant)] leading-none mt-0.5 truncate">
            {currentAccount.roleLabel}
          </p>
        </div>

        <ChevronDown
          size={16}
          className={`text-[var(--on-surface-variant)] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-2)] border border-[var(--outline)]/40 py-2 z-50 animate-fade-in">
          <div className="px-4 py-2 border-b border-[var(--outline)]/30">
            <p className="text-xs font-medium text-[var(--on-surface-variant)]">
              Chọn tài khoản demo
            </p>
          </div>

          <div className="py-1">
            {DEMO_ACCOUNTS.map((acc) => {
              const isSelected = acc.id === currentAccount.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => {
                    onSelectAccount(acc);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--surface-container)] ${
                    isSelected ? "bg-[var(--primary-container)]/40" : ""
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-sm"
                    style={{ backgroundColor: acc.avatarBg }}
                  >
                    {acc.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs truncate ${
                        isSelected
                          ? "font-semibold text-[var(--primary)]"
                          : "font-medium text-[var(--on-surface)]"
                      }`}
                    >
                      {acc.name}
                    </p>
                    <p className="text-xs text-[var(--on-surface-variant)] truncate">
                      {acc.roleLabel}
                    </p>
                  </div>
                  {isSelected && (
                    <Check size={16} className="text-[var(--primary)] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-1 pt-1 border-t border-[var(--outline)]/30 px-2">
            <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
              Công cụ demo
            </p>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenTour?.();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-sm)] text-xs font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container)] transition-colors"
            >
              <HelpCircle size={15} className="text-[var(--primary)]" />
              <span>Xem hướng dẫn sử dụng</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setShowResetModal(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-sm)] text-xs font-medium text-[var(--error)] hover:bg-[#FFEBEE] transition-colors mt-0.5"
            >
              <RotateCcw size={15} />
              <span>Reset dữ liệu demo</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Reset Demo */}
      <Modal
        isOpen={showResetModal}
        onClose={() => !isResetting && setShowResetModal(false)}
        title="Xác nhận reset dữ liệu demo"
        footer={
          <>
            <Button
              variant="tonal"
              size="sm"
              disabled={isResetting}
              onClick={() => setShowResetModal(false)}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={isResetting}
              onClick={handleResetConfirm}
            >
              Reset dữ liệu
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--on-surface-variant)] leading-relaxed">
          Bạn có chắc chắn muốn reset toàn bộ câu hỏi và đưa dữ liệu demo về trạng thái ban đầu không?
          Hành động này sẽ làm sạch các câu hỏi đã hỏi và phục hồi lại dữ liệu mẫu gốc.
        </p>
        {resetError && (
          <div className="mt-3 p-3 bg-[#FFEBEE] border border-[#FFCDD2] rounded-[var(--radius-sm)] text-xs text-[var(--error)]">
            {resetError}
          </div>
        )}
      </Modal>
    </div>
  );
}
