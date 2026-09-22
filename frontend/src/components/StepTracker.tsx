import { type ReactNode } from "react";

interface StepTrackerProps {
  steps: {
    label: string;
    time?: string;
    desc?: string;
    icon?: ReactNode;
  }[];
  currentStep: number; // 0-based index of the currently active step
}

/** Renders an animated 3-step progress tracker.
 *  Steps before currentStep are "done", currentStep is "active", rest are "pending".
 */
export function StepTracker({ steps, currentStep }: StepTrackerProps) {
  return (
    <div className="step-tracker" role="list" aria-label="Tiến trình xử lý">
      {steps.map((step, i) => {
        const state =
          i < currentStep ? "done"
          : i === currentStep ? "active"
          : "pending";
        return (
          <div key={i} className={`step-item ${state}`} role="listitem">
            <div className="step-circle">
              {state === "done" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}
                  style={{ width: 16, height: 16 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                step.icon ?? <span>{i + 1}</span>
              )}
            </div>
            <div className="step-label">{step.label}</div>
            {step.time && <div className="step-time">{step.time}</div>}
            {step.desc && <div className="step-desc">{step.desc}</div>}
          </div>
        );
      })}
    </div>
  );
}
