import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Send, XCircle } from "lucide-react";
import { api, postJson } from "../api/client";
import type { ServiceRequestResponse } from "../types";

const SERVICE_NAMES: Record<string, string> = {
  academic_affairs: "Phòng Đào tạo",
  faculty_cs: "Khoa Khoa học Máy tính / giảng viên",
  clinic: "Trạm Y tế",
  student_affairs: "Phòng Công tác Sinh viên",
  triage_desk: "Bộ phận điều phối",
};

const STATUS_NAMES: Record<string, string> = {
  WAITING_FOR_STAFF: "Chờ nhân viên xử lý",
  AWAITING_APPROVAL: "Chờ giảng viên phê duyệt",
  NEEDS_INFO: "Chờ người gửi bổ sung",
  COMPLETED: "Đã hoàn tất",
  FORWARDED: "Đã chuyển đầu mối",
  REJECTED: "Đã từ chối",
};

function getText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Thao tác chưa thành công.";
}

export function ServiceRequestsInboxView({ actorId, onUpdated }: { actorId: string; onUpdated: () => void }) {
  const [items, setItems] = useState<ServiceRequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [destinations, setDestinations] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api<ServiceRequestResponse[]>("/api/v1/service-requests?limit=100"));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [actorId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const applyResult = (updated: ServiceRequestResponse) => {
    setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
    onUpdated();
  };

  const runAction = async (item: ServiceRequestResponse, action: "approve" | "reject" | "wait" | "resolve" | "handoff") => {
    setBusyId(item.id);
    setError(null);
    const message = (notes[item.id] ?? "").trim();
    try {
      let updated: ServiceRequestResponse;
      if (action === "approve" || action === "reject") {
        updated = await postJson<ServiceRequestResponse>(`/api/v1/service-requests/${item.id}/decision`, {
          approved: action === "approve",
          reason: message || (action === "approve" ? "Đồng ý theo điều kiện đã kiểm tra." : "Không phê duyệt yêu cầu."),
        });
      } else if (action === "handoff") {
        updated = await postJson<ServiceRequestResponse>(`/api/v1/service-requests/${item.id}/handoff`, {
          destination_name: (destinations[item.id] ?? "").trim(),
          note: message,
        });
      } else {
        updated = await postJson<ServiceRequestResponse>(`/api/v1/service-requests/${item.id}/review`, {
          message: message || (action === "resolve" ? "Đã xử lý theo thẩm quyền của đơn vị." : "Đã tiếp nhận và đang kiểm tra yêu cầu."),
          outcome: action,
        });
      }
      applyResult(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const activeItems = items.filter((item) => ["WAITING_FOR_STAFF", "AWAITING_APPROVAL", "NEEDS_INFO"].includes(item.status));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-sm">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Nhân viên · xử lý theo phân quyền backend</p><h1 className="mt-2 text-2xl font-bold">Hộp thư yêu cầu dịch vụ</h1><p className="mt-2 text-sm text-slate-200">Đăng nhập demo: {actorId}</p></div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""} />Làm mới hàng đợi</button>
      </header>

      {error && <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle size={16} />{error}</p>}
      {loading && items.length === 0 && <p className="flex items-center gap-2 rounded-xl bg-white p-5 text-sm text-stone-500"><Loader2 size={16} className="animate-spin" />Đang tải hàng đợi…</p>}
      {!loading && activeItems.length === 0 && <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">Hàng đợi hiện không có yêu cầu cần xử lý.</p>}

      {activeItems.map((item) => {
        const note = notes[item.id] ?? "";
        const triage = item.service_id === "triage_desk";
        const facultyApproval = item.service_id === "faculty_cs" && item.intent === "add_group_member" && item.status === "AWAITING_APPROVAL";
        const disabled = busyId === item.id;
        return (
          <article key={item.id} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-bold text-stone-900">{SERVICE_NAMES[item.service_id] ?? item.service_id} · {item.intent}</h2><p className="mt-1 text-xs text-stone-500">{item.request_id} · Người gửi: {item.actor_id} · {new Date(item.created_at).toLocaleString("vi-VN")}</p></div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">{STATUS_NAMES[item.status] ?? item.status}</span>
            </div>
            <div className="rounded-xl bg-stone-50 p-4 text-sm text-stone-800">
              <p><span className="font-semibold">Nội dung đã tiếp nhận:</span> {item.result.message ? getText(item.result.message) : "Yêu cầu đang chờ nhân viên xem xét."}</p>
              {typeof item.result.next_step === "string" && <p className="mt-2 text-stone-600">{item.result.next_step}</p>}
              {item.reason_code && <p className="mt-2 text-xs text-stone-500">Lý do: <code>{item.reason_code}</code></p>}
            </div>

            {facultyApproval && (
              <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-950">Sinh viên đã xác nhận preview. Phê duyệt sẽ chạy kiểm tra lại và ghi connector mock.</p>
                <textarea value={note} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} rows={2} placeholder="Lý do / ghi chú phê duyệt" className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={disabled} onClick={() => void runAction(item, "approve")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"><CheckCircle2 size={15} />Duyệt và thực hiện</button>
                  <button type="button" disabled={disabled} onClick={() => void runAction(item, "reject")} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"><XCircle size={15} />Từ chối</button>
                </div>
              </div>
            )}

            {item.status === "WAITING_FOR_STAFF" && !triage && (
              <div className="space-y-3 rounded-xl border border-stone-200 p-4">
                <label className="block text-xs font-semibold text-stone-700" htmlFor={`review-${item.id}`}>Ghi chú xử lý</label>
                <textarea id={`review-${item.id}`} value={note} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} rows={2} placeholder="Ghi kết quả kiểm tra hoặc nội dung cần phản hồi" className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-rose-400" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={disabled} onClick={() => void runAction(item, "wait")} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"><Send size={15} />Ghi nhận đang xử lý</button>
                  <button type="button" disabled={disabled} onClick={() => void runAction(item, "resolve")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"><CheckCircle2 size={15} />Đánh dấu đã xử lý</button>
                </div>
              </div>
            )}

            {triage && item.status === "WAITING_FOR_STAFF" && (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-950">Điều phối thủ công đến đúng đầu mối tiếp nhận.</p>
                <input value={destinations[item.id] ?? ""} onChange={(event) => setDestinations((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Tên đơn vị / đầu mối nhận (ít nhất 3 ký tự)" className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500" />
                <textarea value={note} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} rows={2} placeholder="Ghi chú bàn giao (ít nhất 3 ký tự)" className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500" />
                <button type="button" disabled={disabled || (destinations[item.id] ?? "").trim().length < 3 || note.trim().length < 3} onClick={() => void runAction(item, "handoff")} className="inline-flex items-center gap-2 rounded-xl bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50"><Send size={15} />Chuyển đầu mối</button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
