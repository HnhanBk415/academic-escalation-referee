import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { RouteBadge } from "../components/RouteBadge";
import type { AuditEvent } from "../types";

export function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setEvents(await api<AuditEvent[]>("/api/v1/audit?limit=300"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải dữ liệu nhật ký kiểm toán.");
    }
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return events;
    return events.filter((event) =>
      [event.event_type, event.entity_type, event.entity_id, event.actor_id, event.reason_code]
        .some((value) => value?.toLowerCase().includes(query))
    );
  }, [events, filter]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Nhật ký hệ thống"
        title="Audit Trail & Traceability"
        description="Mọi quyết định, routing AI, trích xuất căn cứ và can thiệp thủ công đều được ghi nhận bất biến (append-only)."
        actions={
          <button className="secondary-button" onClick={load}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Làm mới nhật ký
          </button>
        }
      />
      {error && <div className="error-banner">{error}</div>}
      <section className="panel audit-panel">
        <div className="audit-tools">
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Lọc sự kiện, mã đối tượng, người thực hiện hoặc lý do…"
          />
          <span className="badge badge-neutral">{visible.length} sự kiện</span>
        </div>
        <div className="timeline">
          {visible.map((event) => (
            <article className="timeline-event" key={event.id}>
              <div className="timeline-rail"><span /></div>
              <div className="timeline-body">
                <button
                  className="timeline-summary"
                  onClick={() => setExpanded(expanded === event.id ? null : event.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <RouteBadge value={event.event_type} />
                    <strong>{event.entity_type} · {event.entity_id}</strong>
                  </div>
                  <div className="timeline-meta">
                    <span className="badge badge-neutral" style={{ fontSize: "0.75rem" }}>
                      {event.actor_id ?? "system"}
                    </span>
                    <time>{new Date(event.created_at).toLocaleString("vi-VN")}</time>
                  </div>
                </button>
                {expanded === event.id && (
                  <div className="audit-detail">
                    <div><span>Mã lý do</span><code>{event.reason_code ?? "—"}</code></div>
                    <div><span>Mô hình AI</span><code>{event.model_name ?? "—"}</code></div>
                    <div><span>Thời gian xử lý</span><code>{event.duration_ms == null ? "—" : `${event.duration_ms} ms`}</code></div>
                    <div><span>Request ID</span><code>{event.request_id ?? "—"}</code></div>
                    <section><span>Đầu vào (Input Snapshot)</span><pre>{JSON.stringify(event.input_snapshot, null, 2)}</pre></section>
                    <section><span>Kết quả (Output Snapshot)</span><pre>{JSON.stringify(event.output_snapshot, null, 2)}</pre></section>
                    {!!event.evidence_ids.length && (
                      <section><span>Căn cứ trích dẫn (Evidence IDs)</span><pre>{event.evidence_ids.join("\n")}</pre></section>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
          {!visible.length && (
            <div className="queue-empty">Không tìm thấy sự kiện kiểm toán nào phù hợp.</div>
          )}
        </div>
      </section>
    </div>
  );
}
