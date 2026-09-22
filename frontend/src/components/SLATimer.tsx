import { useEffect, useRef, useState } from "react";

interface SLATimerProps {
  /** Total seconds in the SLA window (default 172800 = 48h) */
  totalSeconds?: number;
  /** ISO timestamp the case was created at */
  createdAt?: string;
  className?: string;
}

function fmtHHMM(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Countdown timer showing SLA time remaining.
 *  If createdAt is supplied it calculates actual remaining time.
 *  Otherwise it counts down from totalSeconds for demo purposes.
 */
export function SLATimer({ totalSeconds = 172800, createdAt, className = "" }: SLATimerProps) {
  const getRemaining = () => {
    if (createdAt) {
      const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
      return Math.max(0, totalSeconds - elapsed);
    }
    return totalSeconds;
  };

  const [remaining, setRemaining] = useState(getRemaining);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRemaining(getRemaining());
    ref.current = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdAt, totalSeconds]);

  const pct = Math.round((remaining / totalSeconds) * 100);
  const urgent = pct < 20;

  return (
    <div className={`sla-card ${className}`} style={urgent ? { borderColor: "#ef4444", background: "#fef2f2" } : {}}>
      <div className="sla-label">⏱ Thời gian còn lại · SLA</div>
      <div className="sla-time" style={urgent ? { color: "#dc2626" } : {}}>
        {fmtHHMM(remaining)}
      </div>
      <div className="sla-sub">{pct}% · Xử lý trong 48 giờ làm việc</div>
    </div>
  );
}
