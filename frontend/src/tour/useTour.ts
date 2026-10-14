import { useContext, useCallback } from "react";
import { TourContext } from "./TourContext";
import type { PageTourKey } from "./tourSteps";

export interface UseTourReturn {
  startTour: (keyOverride?: PageTourKey) => void;
  hasSeen: boolean;
  startAppShellTour: () => void;
  resetAllTours: () => void;
  pageKey: PageTourKey;
  isTourActive: boolean;
}

export function useTour(pageKey?: PageTourKey): UseTourReturn {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }

  const effectiveKey = pageKey || context.pageKey;

  const startTour = useCallback(
    (keyOverride?: PageTourKey) => {
      context.startTour(keyOverride || effectiveKey);
    },
    [context, effectiveKey]
  );

  return {
    startTour,
    hasSeen: context.hasSeen(effectiveKey),
    startAppShellTour: context.startAppShellTour,
    resetAllTours: context.resetAllTours,
    pageKey: effectiveKey,
    isTourActive: context.isTourActive,
  };
}
