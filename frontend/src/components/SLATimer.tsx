import React, { useEffect, useState } from "react";
import { IconClock } from "./Icons";

interface SlaTimerProps {
  remaining?: string;
  totalSeconds?: number;
  createdAt?: string;
  dueAt?: string;
  isOverdue?: boolean;
  className?: string;
}

function fmtHHMM(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SlaTimer({
  remaining,
  totalSeconds = 172800,
  createdAt,
  dueAt,
  isOverdue = false,
  className = "",
}: SlaTimerProps) {
  const computeInitial = (): string => {
    if (dueAt) {
      const rem = Math.floor((new Date(dueAt).getTime() - Date.now()) / 1000);
      if (rem <= 0) return "00:00:00";
      return fmtHHMM(rem);
    }
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
    if (isOverdue) return;
    const tick = () => {
      setTime((prev) => {
        const parts = prev.split(":").map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) return "00:00:00";
        const [h, m, s] = parts;
        let total = h * 3600 + m * 60 + s - 1;
        if (total <= 0) return "00:00:00";
        const nh = Math.floor(total / 3600);
        const nm = Math.floor((total % 3600) / 60);
        const ns = total % 60;
        return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}:${String(ns).padStart(2, "0")}`;
      });
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [remaining, createdAt, dueAt, totalSeconds, isOverdue]);

  if (isOverdue) {
    return (
      <div
        className={`flex items-center justify-between p-4 rounded-xl border bg-rose-50 border-rose-300 text-rose-950 transition-all ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="text-rose-600">
            <IconClock size={18} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-rose-800">
              ⚠️ Đã quá hạn SLA 48 giờ
            </p>
            <p className="text-[11px] text-rose-700 mt-0.5">
              SLA chỉ là thông tin theo dõi, hệ thống không tự chuyển hồ sơ.
            </p>
          </div>
        </div>
        <span className="font-mono text-xs font-bold px-3 py-1 bg-rose-200 text-rose-900 rounded-lg">
          QUÁ HẠN
        </span>
      </div>
    );
  }

  const [h] = time.split(":").map(Number);
  const isUrgent = !isNaN(h) && h < 12;

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
        isUrgent ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"
      } ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <div className={isUrgent ? "text-rose-600" : "text-amber-600"}>
          <IconClock size={16} />
        </div>
        <div>
          <p className={`text-xs font-semibold ${isUrgent ? "text-rose-800" : "text-amber-800"}`}>
            Thời gian theo dõi SLA 48h
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            SLA chỉ là thông tin theo dõi, không tự chuyển hồ sơ
          </p>
        </div>
      </div>
      <div className="text-right">
        <span
          className={`font-mono text-lg font-semibold tabular-nums ${
            isUrgent ? "text-rose-600 sla-blink" : "text-amber-700"
          }`}
        >
          {time}
        </span>
        {dueAt && (
          <p className="text-[10px] text-slate-400 font-mono">
            Hạn: {new Date(dueAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} {new Date(dueAt).toLocaleDateString("vi-VN")}
          </p>
        )}
      </div>
    </div>
  );
}

export const SLATimer = SlaTimer;
