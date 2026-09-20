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
      setError(caught instanceof Error ? caught.message : "Không thể tải audit.");
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
        eyebrow="Audit trail"
        title="Every action, accounted for."
        description="Append-only events expose who did what, why, with which evidence and model."
        actions={<button className="secondary-button" onClick={load}>Refresh timeline</button>}
      />
      {error && <div className="error-banner">{error}</div>}
      <section className="panel audit-panel">
        <div className="audit-tools">
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter event, actor, entity or reason…" />
          <span>{visible.length} events</span>
        </div>
        <div className="timeline">
          {visible.map((event) => (
            <article className="timeline-event" key={event.id}>
              <div className="timeline-rail"><span /></div>
              <div className="timeline-body">
                <button className="timeline-summary" onClick={() => setExpanded(expanded === event.id ? null : event.id)}>
                  <div>
                    <RouteBadge value={event.event_type} />
                    <strong>{event.entity_type} · {event.entity_id}</strong>
                  </div>
                  <div className="timeline-meta">
                    <span>{event.actor_id ?? "system"}</span>
                    <time>{new Date(event.created_at).toLocaleString("vi-VN")}</time>
                  </div>
                </button>
                {expanded === event.id && (
                  <div className="audit-detail">
                    <div><span>Reason</span><code>{event.reason_code ?? "—"}</code></div>
                    <div><span>Model</span><code>{event.model_name ?? "—"}</code></div>
                    <div><span>Duration</span><code>{event.duration_ms == null ? "—" : `${event.duration_ms} ms`}</code></div>
                    <div><span>Request</span><code>{event.request_id ?? "—"}</code></div>
                    <section><span>Input</span><pre>{JSON.stringify(event.input_snapshot, null, 2)}</pre></section>
                    <section><span>Output</span><pre>{JSON.stringify(event.output_snapshot, null, 2)}</pre></section>
                    {!!event.evidence_ids.length && <section><span>Evidence IDs</span><pre>{event.evidence_ids.join("\n")}</pre></section>}
                  </div>
                )}
              </div>
            </article>
          ))}
          {!visible.length && <div className="queue-empty">No matching audit events.</div>}
        </div>
      </section>
    </div>
  );
}
