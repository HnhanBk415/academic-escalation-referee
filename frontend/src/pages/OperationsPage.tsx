import { useEffect, useState } from "react";

import { api } from "../api/client";
import { IconBookOpen, IconClock, IconScale, IconScroll, IconShield } from "../components/Icons";
import type { OperationsOverview } from "../types";

const metrics = [
  ["open_cases", "Hồ sơ đang mở", IconScale, "bg-blue-50 text-blue-700"],
  ["overdue_cases", "Quá SLA", IconClock, "bg-rose-50 text-rose-700"],
  ["active_exceptions", "Ngoại lệ hiệu lực", IconShield, "bg-amber-50 text-amber-700"],
  ["active_documents", "Tài liệu hiệu lực", IconBookOpen, "bg-emerald-50 text-emerald-700"],
] as const;

export function OperationsPage({ onOpenAudit }: { onOpenAudit: () => void }) {
  const [overview, setOverview] = useState<OperationsOverview | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      setOverview(await api<OperationsOverview>("/api/v1/operations/overview"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải số liệu vận hành.");
    }
  }

  useEffect(() => { void load(); }, []);

  if (error) {
    return <div className="m-8 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-8 py-5 backdrop-blur">
        <div>
          <h1 className="text-[22px] font-normal text-slate-900">Trung tâm vận hành học vụ</h1>
          <p className="mt-1 text-sm text-slate-500">Theo dõi luồng hồ sơ, SLA, ngoại lệ và căn cứ kiểm toán.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-[#DC2626] hover:text-[#B91C1C]">
          Làm mới
        </button>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 p-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(([key, label, Icon, tone]) => (
            <article key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className={`inline-flex rounded-xl p-2.5 ${tone}`}><Icon size={19} /></div>
              <p className="mt-5 text-3xl font-semibold text-slate-900">{overview?.[key] ?? "—"}</p>
              <p className="mt-1 text-sm font-medium text-slate-600">{label}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <article className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-medium text-red-300">Khối lượng toàn hệ thống</p>
            <p className="mt-3 text-4xl font-semibold">{overview?.total_questions ?? "—"}</p>
            <p className="mt-1 text-sm text-slate-300">yêu cầu học vụ đã được ghi nhận</p>
            <div className="mt-6 border-t border-white/10 pt-5">
              <button type="button" onClick={onOpenAudit} className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-red-200 hover:text-white">
                <IconScroll size={15} /> Mở Audit Trail
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2"><IconScroll size={18} className="text-[#C81E1E]" /><h2 className="font-semibold text-slate-900">Hoạt động gần đây</h2></div>
            <div className="mt-4 divide-y divide-slate-100">
              {overview?.recent_activity.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 py-3">
                  <div><p className="text-sm font-bold text-slate-800">{item.event_type}</p><p className="mt-0.5 text-xs text-slate-500">{item.entity_type} · {item.entity_id} · {item.actor_id ?? "system"}</p></div>
                  <time className="shrink-0 text-xs text-slate-400">{new Date(item.created_at).toLocaleString("vi-VN")}</time>
                </div>
              ))}
              {overview && !overview.recent_activity.length && <p className="py-8 text-center text-sm text-slate-500">Chưa có hoạt động được ghi nhận.</p>}
              {!overview && <p className="py-8 text-center text-sm text-slate-500">Đang tải số liệu...</p>}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
