import React, { createContext } from "react";
import type { PageTourKey } from "./tourSteps";

const STORAGE_PREFIX = "aer_tour_seen:";

interface TourContextType {
  startTour: (keyOverride?: PageTourKey) => void;
  startAppShellTour: () => void;
  resetAllTours: () => void;
  hasSeen: (pageKey: PageTourKey) => boolean;
  pageKey: PageTourKey;
  isTourActive: boolean;
}

export const TourContext = createContext<TourContextType>({
  startTour: () => {},
  startAppShellTour: () => {},
  resetAllTours: () => {},
  hasSeen: () => true,
  pageKey: "home",
  isTourActive: false,
});

export interface TourProviderProps {
  children?: React.ReactNode;
  currentRole?: string;
}

export function TourProvider({ children }: TourProviderProps) {
  const value: TourContextType = {
    startTour: () => {},
    startAppShellTour: () => {},
    resetAllTours: () => {},
    hasSeen: () => true,
    pageKey: "home",
    isTourActive: false,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

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
    keysToRemove.forEach((key) => localStorage.removeItem(key));
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
