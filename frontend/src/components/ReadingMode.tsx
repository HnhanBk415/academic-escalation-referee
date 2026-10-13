import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Minimize2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export type FontSizeLevel = "sm" | "md" | "lg";

export const READING_MODE_STORAGE_KEY = "aer_reading_mode";
export const READING_FONT_SIZE_STORAGE_KEY = "aer_reading_font_size";

export interface UseReadingModeProps {
  currentCaseId?: string;
  filteredIds?: string[];
  basePath?: string; // e.g. "/workspace/history" or "/workspace/inbox"
}

export function useReadingMode({
  currentCaseId,
  filteredIds = [],
  basePath = "/workspace/history",
}: UseReadingModeProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read query parameter: ?read=1
  const isReadingMode = searchParams.get("read") === "1";

  // Font size state initialized from localStorage
  const [fontSize, setFontSizeState] = useState<FontSizeLevel>(() => {
    try {
      const saved = localStorage.getItem(READING_FONT_SIZE_STORAGE_KEY);
      if (saved === "sm" || saved === "md" || saved === "lg") {
        return saved;
      }
    } catch {
      // ignore
    }
    return "md";
  });

  const setFontSize = useCallback((level: FontSizeLevel) => {
    setFontSizeState(level);
    try {
      localStorage.setItem(READING_FONT_SIZE_STORAGE_KEY, level);
    } catch {
      // ignore
    }
  }, []);

  const enterReadingMode = useCallback(() => {
    try {
      localStorage.setItem(READING_MODE_STORAGE_KEY, "true");
    } catch {
      // ignore
    }
    const newParams = new URLSearchParams(searchParams);
    newParams.set("read", "1");
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const exitReadingMode = useCallback(() => {
    try {
      localStorage.setItem(READING_MODE_STORAGE_KEY, "false");
    } catch {
      // ignore
    }
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("read");
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const toggleReadingMode = useCallback(() => {
    if (isReadingMode) {
      exitReadingMode();
    } else {
      enterReadingMode();
    }
  }, [isReadingMode, exitReadingMode, enterReadingMode]);

  // Navigate back to list view
  const handleBackToList = useCallback(() => {
    navigate(basePath);
  }, [navigate, basePath]);

  // Current index in filtered list
  const currentIndex = currentCaseId
    ? filteredIds.findIndex((id) => id === currentCaseId)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredIds.length - 1;

  const handlePrevCase = useCallback(() => {
    if (currentIndex > 0) {
      const prevId = filteredIds[currentIndex - 1];
      const query = isReadingMode ? "?read=1" : "";
      navigate(`${basePath}/${prevId}${query}`);
    }
  }, [currentIndex, filteredIds, isReadingMode, basePath, navigate]);

  const handleNextCase = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < filteredIds.length - 1) {
      const nextId = filteredIds[currentIndex + 1];
      const query = isReadingMode ? "?read=1" : "";
      navigate(`${basePath}/${nextId}${query}`);
    }
  }, [currentIndex, filteredIds, isReadingMode, basePath, navigate]);

  // Unified keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger if typing in form fields
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Escape") {
        if (isReadingMode) {
          e.preventDefault();
          exitReadingMode();
        } else if (currentCaseId) {
          e.preventDefault();
          handleBackToList();
        }
        return;
      }

      if (filteredIds.length === 0) return;

      if (e.key === "j") {
        e.preventDefault();
        if (currentCaseId) {
          const nextIndex =
            currentIndex < filteredIds.length - 1 ? currentIndex + 1 : 0;
          const nextId = filteredIds[nextIndex];
          const query = isReadingMode ? "?read=1" : "";
          navigate(`${basePath}/${nextId}${query}`);
        }
      } else if (e.key === "k") {
        e.preventDefault();
        if (currentCaseId) {
          const prevIndex =
            currentIndex > 0 ? currentIndex - 1 : filteredIds.length - 1;
          const prevId = filteredIds[prevIndex];
          const query = isReadingMode ? "?read=1" : "";
          navigate(`${basePath}/${prevId}${query}`);
        }
      } else if (e.key === "Enter" && !currentCaseId && filteredIds.length > 0) {
        e.preventDefault();
        navigate(`${basePath}/${filteredIds[0]}`);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentCaseId,
    filteredIds,
    currentIndex,
    isReadingMode,
    exitReadingMode,
    handleBackToList,
    basePath,
    navigate,
  ]);

  return {
    isReadingMode,
    fontSize,
    setFontSize,
    enterReadingMode,
    exitReadingMode,
    toggleReadingMode,
    handleBackToList,
    handlePrevCase,
    handleNextCase,
    displayIndex: currentIndex >= 0 ? currentIndex + 1 : 0,
    totalCount: filteredIds.length,
    hasPrev,
    hasNext,
  };
}

export interface ReadingToolbarProps {
  onBackToList: () => void;
  onExitReadingMode: () => void;
  fontSize: FontSizeLevel;
  onFontSizeChange: (level: FontSizeLevel) => void;
  displayIndex?: number;
  totalCount?: number;
  onPrevCase?: () => void;
  onNextCase?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  className?: string;
}

export function ReadingToolbar({
  onBackToList,
  onExitReadingMode,
  fontSize,
  onFontSizeChange,
  displayIndex,
  totalCount,
  onPrevCase,
  onNextCase,
  hasPrev,
  hasNext,
  className = "",
}: ReadingToolbarProps) {
  return (
    <div
      className={`sticky top-0 z-30 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--outline)]/30 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shadow-xs reading-transition ${className}`}
    >
      {/* Left actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBackToList}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-xl)] bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-xs font-medium text-[var(--on-surface)] transition-colors cursor-pointer"
          title="Quay lại danh sách"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Quay lại danh sách</span>
          <span className="sm:hidden">Danh sách</span>
        </button>

        <button
          type="button"
          onClick={onExitReadingMode}
          className="hidden md:inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-xl)] bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-xs font-medium text-[var(--on-surface)] transition-colors cursor-pointer"
          title="Thoát chế độ đọc (Esc)"
        >
          <Minimize2 size={14} />
          <span>Thoát chế độ đọc</span>
        </button>
      </div>

      {/* Middle: Sequence navigation (j / k) */}
      {totalCount !== undefined && totalCount > 0 && (
        <div className="flex items-center gap-1 bg-[var(--surface-container)] rounded-[var(--radius-xl)] px-2 py-1 text-xs">
          <button
            type="button"
            onClick={onPrevCase}
            disabled={!hasPrev}
            className="p-1 rounded-[var(--radius-sm)] hover:bg-[var(--surface-container-high)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer text-[var(--on-surface)]"
            title="Câu trước (k)"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="font-mono text-xs px-1 text-[var(--on-surface-variant)] select-none">
            {displayIndex} / {totalCount}
          </span>
          <button
            type="button"
            onClick={onNextCase}
            disabled={!hasNext}
            className="p-1 rounded-[var(--radius-sm)] hover:bg-[var(--surface-container-high)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer text-[var(--on-surface)]"
            title="Câu sau (j)"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Right: Font size segmented control */}
      <div className="flex items-center bg-[var(--surface-container)] rounded-[var(--radius-xl)] p-0.5 border border-[var(--outline)]/30 text-xs">
        <button
          type="button"
          onClick={() => onFontSizeChange("sm")}
          className={`px-2.5 py-1 rounded-[var(--radius-xl)] transition-all cursor-pointer font-medium ${
            fontSize === "sm"
              ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-xs"
              : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
          }`}
          title="Cỡ chữ nhỏ (A−: 1rem)"
        >
          A−
        </button>
        <button
          type="button"
          onClick={() => onFontSizeChange("md")}
          className={`px-2.5 py-1 rounded-[var(--radius-xl)] transition-all cursor-pointer font-medium ${
            fontSize === "md"
              ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-xs"
              : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
          }`}
          title="Cỡ chữ vừa (A: 1.125rem - Mặc định)"
        >
          A
        </button>
        <button
          type="button"
          onClick={() => onFontSizeChange("lg")}
          className={`px-2.5 py-1 rounded-[var(--radius-xl)] transition-all cursor-pointer font-medium ${
            fontSize === "lg"
              ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-xs"
              : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
          }`}
          title="Cỡ chữ lớn (A+: 1.25rem)"
        >
          A+
        </button>
      </div>
    </div>
  );
}

export function ReadingModeTriggerButton({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-xl)] bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-xs font-medium text-[var(--on-surface)] transition-colors cursor-pointer ${className}`}
      title="Chế độ đọc tập trung (Esc để thoát)"
    >
      <BookOpen size={14} />
      <span>Chế độ đọc</span>
    </button>
  );
}

export interface ReadingContainerProps {
  isReadingMode: boolean;
  fontSize: FontSizeLevel;
  className?: string;
  children: React.ReactNode;
}

export function ReadingContainer({
  isReadingMode,
  fontSize,
  className = "",
  children,
}: ReadingContainerProps) {
  if (!isReadingMode) {
    return (
      <div className={`w-full max-w-3xl space-y-6 flex-1 ${className}`}>
        {children}
      </div>
    );
  }

  const fontSizeVal =
    fontSize === "sm" ? "1rem" : fontSize === "lg" ? "1.25rem" : "1.125rem";

  return (
    <div
      data-font-size={fontSize}
      style={
        {
          "--reading-font-size": fontSizeVal,
          "--reading-line-height": "1.75",
        } as React.CSSProperties
      }
      className={`reading-mode-container w-full max-w-4xl mx-auto space-y-8 flex-1 py-4 pb-16 reading-transition ${className}`}
    >
      {children}
    </div>
  );
}
