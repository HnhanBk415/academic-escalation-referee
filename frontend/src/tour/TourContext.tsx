import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { driver, type Driver, type DriveStep } from "driver.js";
import {
  TOUR_STEPS,
  mapPathnameToTourKey,
  type PageTourKey,
} from "./tourSteps";
import { CheckCircle2 } from "lucide-react";

const STORAGE_PREFIX = "aer_tour_seen:";

export function getTourKey(role: string, pageKey: string): string {
  return `${STORAGE_PREFIX}${role}:${pageKey}`;
}

export function hasSeenTourKey(role: string, pageKey: string): boolean {
  try {
    return localStorage.getItem(getTourKey(role, pageKey)) === "true";
  } catch {
    return false;
  }
}

export function markTourSeen(role: string, pageKey: string): void {
  try {
    localStorage.setItem(getTourKey(role, pageKey), "true");
  } catch {
    // ignore
  }
}

export function resetAllTourKeys(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export function hasAnyTourSeen(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export interface TourContextValue {
  startTour: (keyOverride?: PageTourKey) => void;
  startAppShellTour: () => void;
  resetAllTours: () => void;
  hasSeen: (key?: PageTourKey) => boolean;
  pageKey: PageTourKey;
  isTourActive: boolean;
}

export const TourContext = createContext<TourContextValue | null>(null);

export interface TourProviderProps {
  currentRole: "student" | "lecturer";
  children?: React.ReactNode;
}

export function TourProvider({ currentRole, children }: TourProviderProps) {
  const location = useLocation();
  const pageKey = mapPathnameToTourKey(location.pathname);

  const driverRef = useRef<Driver | null>(null);
  const chainTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRunIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSchedulingOrRunningRef = useRef(false);
  const currentRouteKeyRef = useRef<string>("");
  const currentPageKeyRef = useRef<PageTourKey>(pageKey);
  currentPageKeyRef.current = pageKey;

  const [isTourActive, setIsTourActive] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getDriverInstance = useCallback((): Driver => {
    if (!driverRef.current) {
      driverRef.current = driver();
    }
    return driverRef.current;
  }, []);

  const runTour = useCallback(
    (
      tourKey: PageTourKey,
      options?: { onComplete?: () => void; recordSeen?: boolean }
    ) => {
      const driverInstance = getDriverInstance();

      // Clean up previous active driver if any
      if (driverInstance.isActive()) {
        driverInstance.destroy();
      }

      // Clear any pending chain timeout if a new tour starts
      if (chainTimeoutRef.current) {
        clearTimeout(chainTimeoutRef.current);
        chainTimeoutRef.current = null;
      }

      const steps = TOUR_STEPS[tourKey] || [];
      // Filter out steps with elements not present in DOM to prevent breaking
      const validSteps = steps.filter((step) => {
        try {
          const el = document.querySelector(step.element);
          return el !== null;
        } catch {
          return false;
        }
      });

      if (validSteps.length === 0) {
        if (options?.recordSeen !== false) {
          markTourSeen(currentRole, tourKey);
        }
        options?.onComplete?.();
        return;
      }

      const prefersReducedMotion =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const totalValid = validSteps.length;
      const driveSteps: DriveStep[] = validSteps.map((s, index) => {
        const isFirst = index === 0;
        const isLast = index === totalValid - 1;
        const showButtons: ("next" | "previous" | "close")[] = isFirst
          ? ["next", "close"]
          : ["next", "previous", "close"];

        return {
          element: s.element,
          popover: {
            title: s.title,
            description: s.description,
            side: s.side || "bottom",
            align: s.align || "center",
            showButtons,
          },
          onHighlightStarted: isLast
            ? () => {
                if (options?.recordSeen !== false) {
                  markTourSeen(currentRole, tourKey);
                }
              }
            : undefined,
        };
      });

      driverInstance.setConfig({
        showProgress: true,
        progressText: "{{current}} / {{total}}",
        nextBtnText: "Tiếp",
        prevBtnText: "Quay lại",
        doneBtnText: "Đã hiểu",
        allowClose: true,
        overlayOpacity: 0.45,
        stagePadding: 6,
        stageRadius: 12,
        smoothScroll: true,
        animate: !prefersReducedMotion,
        popoverClass: "aer-tour-popover",
        allowKeyboardControl: true,
        onDestroyStarted: (_el, _step, { driver: d }) => {
          setIsTourActive(false);
          if (options?.recordSeen !== false) {
            markTourSeen(currentRole, tourKey);
          }
          d.destroy();
          if (options?.onComplete) {
            if (chainTimeoutRef.current) {
              clearTimeout(chainTimeoutRef.current);
            }
            chainTimeoutRef.current = setTimeout(() => {
              chainTimeoutRef.current = null;
              options.onComplete!();
            }, 250);
          }
        },
      });

      driverInstance.setSteps(driveSteps);
      setIsTourActive(true);
      driverInstance.drive();
    },
    [currentRole, getDriverInstance]
  );

  // Teardown driver and timers on unmount
  useEffect(() => {
    return () => {
      if (chainTimeoutRef.current) {
        clearTimeout(chainTimeoutRef.current);
        chainTimeoutRef.current = null;
      }
      if (autoRunIntervalRef.current) {
        clearInterval(autoRunIntervalRef.current);
        autoRunIntervalRef.current = null;
      }
      if (driverRef.current?.isActive()) {
        driverRef.current.destroy();
      }
    };
  }, []);

  // Auto-run logic with single-schedule guard per route change
  useEffect(() => {
    // 1. Clear any active interval from previous run
    if (autoRunIntervalRef.current) {
      clearInterval(autoRunIntervalRef.current);
      autoRunIntervalRef.current = null;
    }

    const currentRouteKey = `${currentRole}:${location.pathname}`;
    // If route has changed, reset the scheduling flag for the new route
    if (currentRouteKeyRef.current !== currentRouteKey) {
      currentRouteKeyRef.current = currentRouteKey;
      isSchedulingOrRunningRef.current = false;
    }

    // Ensure at most one runTour is scheduled or running per route
    if (isSchedulingOrRunningRef.current) {
      return;
    }

    // Do not run if active tour is already running
    if (driverRef.current?.isActive()) {
      return;
    }

    // 2. Mobile screen check: skip auto-run for screens < 768px
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return;
    }

    // 3. Reading mode check (?read=1)
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("read") === "1") {
      return;
    }

    // 4. Modal open check
    if (document.querySelector('[role="dialog"]')) {
      return;
    }

    // 5. Check if first time ever opening app or app-shell not seen
    const anySeen = hasAnyTourSeen();
    const appShellSeen = hasSeenTourKey(currentRole, "app-shell");
    const shouldRunAppShellFirst = !anySeen || !appShellSeen;

    const targetKey: PageTourKey = shouldRunAppShellFirst ? "app-shell" : pageKey;

    // If target tour already marked as seen, do not auto-run
    if (hasSeenTourKey(currentRole, targetKey)) {
      return;
    }

    const steps = TOUR_STEPS[targetKey] || [];
    const firstSelector = steps[0]?.element;
    if (!firstSelector) return;

    // Mark as scheduling for this route
    isSchedulingOrRunningRef.current = true;

    const startTime = Date.now();
    const minDelay = 600;
    const maxTimeout = 3000;

    autoRunIntervalRef.current = setInterval(() => {
      // Abort if a modal dialog opened
      if (document.querySelector('[role="dialog"]')) {
        if (autoRunIntervalRef.current) {
          clearInterval(autoRunIntervalRef.current);
          autoRunIntervalRef.current = null;
        }
        isSchedulingOrRunningRef.current = false;
        return;
      }

      const elapsed = Date.now() - startTime;
      const firstElExists = Boolean(document.querySelector(firstSelector));

      if ((elapsed >= minDelay && firstElExists) || elapsed >= maxTimeout) {
        if (autoRunIntervalRef.current) {
          clearInterval(autoRunIntervalRef.current);
          autoRunIntervalRef.current = null;
        }

        if (driverRef.current?.isActive()) {
          isSchedulingOrRunningRef.current = false;
          return;
        }

        if (shouldRunAppShellFirst) {
          runTour("app-shell", {
            onComplete: () => {
              isSchedulingOrRunningRef.current = false;
              const curKey = currentPageKeyRef.current;
              // After app-shell finishes, chain to current page tour if not yet seen
              if (!hasSeenTourKey(currentRole, curKey)) {
                if (
                  !document.querySelector('[role="dialog"]') &&
                  !driverRef.current?.isActive()
                ) {
                  runTour(curKey);
                }
              }
            },
          });
        } else {
          runTour(pageKey);
          isSchedulingOrRunningRef.current = false;
        }
      }
    }, 50);

    return () => {
      if (autoRunIntervalRef.current) {
        clearInterval(autoRunIntervalRef.current);
        autoRunIntervalRef.current = null;
      }
    };
  }, [location.pathname, location.search, currentRole, pageKey, runTour]);

  const startTour = useCallback(
    (keyOverride?: PageTourKey) => {
      runTour(keyOverride || pageKey);
    },
    [pageKey, runTour]
  );

  const startAppShellTour = useCallback(() => {
    runTour("app-shell");
  }, [runTour]);

  const resetAllTours = useCallback(() => {
    resetAllTourKeys();
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
    }
    setNotice("Hướng dẫn sẽ hiện lại khi bạn mở từng trang");
    noticeTimeoutRef.current = setTimeout(() => {
      setNotice(null);
    }, 3500);
  }, []);

  const hasSeen = useCallback(
    (key?: PageTourKey) => {
      return hasSeenTourKey(currentRole, key || pageKey);
    },
    [currentRole, pageKey]
  );

  const contextValue: TourContextValue = {
    startTour,
    startAppShellTour,
    resetAllTours,
    hasSeen,
    pageKey,
    isTourActive,
  };

  return (
    <TourContext.Provider value={contextValue}>
      {children}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-[var(--surface)] text-[var(--on-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-3)] border border-[var(--outline)]/40 text-xs font-medium animate-fade-in select-none"
        >
          <CheckCircle2 size={16} className="text-[var(--success)] shrink-0" />
          <span>{notice}</span>
        </div>
      )}
    </TourContext.Provider>
  );
}
