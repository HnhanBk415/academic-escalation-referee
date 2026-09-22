import React, { useEffect, useState } from "react";
import { IconClock } from "./Icons";

interface SlaTimerProps {
  remaining?: string;
  totalSeconds?: number;
  createdAt?: string;
  className?: string;
}

function fmtHHMM(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SlaTimer({ remaining, totalSeconds = 172800, createdAt, className = "" }: SlaTimerProps) {
  const computeInitial = (): string => {
    if (remaining) return remaining;
    if (createdAt) {
      const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
      const rem = Math.max(0, totalSeconds - elapsed);
      return fmtHHMM(rem);
    }
    return "47:54:40";
  };

  const [time, setTime] = useState<string>(computeInitial);

  useEffect(() => {
    setTime(computeInitial());
    const tick = () => {
      setTime((prev) => {
        const parts = prev.split(":").map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) return "47:54:40";
        const [h, m, s] = parts;
        let total = h * 3600 + m * 60 + s - 1;
        if (total < 0) total = 0;
        const nh = Math.floor(total / 3600);
        const nm = Math.floor((total % 3600) / 60);
        const ns = total % 60;
        return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}:${String(ns).padStart(2, "0")}`;
      });
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [remaining, createdAt, totalSeconds]);

  const [h] = time.split(":").map(Number);
  const isUrgent = !isNaN(h) && h < 12;

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
        isUrgent
          ? "bg-rose-50 border-rose-200"
          : "bg-amber-50 border-amber-200"
      } ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <div className={isUrgent ? "text-rose-600" : "text-amber-600"}>
          <IconClock size={16} />
        </div>
        <div>
          <p className={`text-xs font-semibold ${isUrgent ? "text-rose-800" : "text-amber-800"}`}>
            Thời gian SLA 48h còn lại
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Hệ thống tự động leo thang nếu hết hạn
          </p>
        </div>
      </div>
      <span
        className={`font-mono text-lg font-semibold tabular-nums ${
          isUrgent ? "text-rose-600 sla-blink" : "text-amber-700"
        }`}
      >
        {time}
      </span>
    </div>
  );
}

export const SLATimer = SlaTimer;
