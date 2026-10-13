import React, { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, ChevronDown, ChevronUp, FileCode, History, AlertCircle } from "lucide-react";
import { api } from "../api/client";
import { Badge, Button, Chip } from "../components/ui";
import type { AuditEvent } from "../types";

const EVENT_TYPE_LABELS: Record<string, { label: string; tone: "info" | "answer" | "escalate" | "clarify" | "reject" | "neutral" }> = {
  QUESTION_ROUTED: { label: "Phân luồng", tone: "info" },
  CASE_DECIDED: { label: "Quyết định", tone: "answer" },
  EXCEPTION_CREATED: { label: "Tạo ngoại lệ", tone: "escalate" },
  POLICY_UPDATE_PUBLISHED: { label: "Ban hành", tone: "clarify" },
  POLICY_DRAFT_DISCARDED: { label: "Hủy nháp", tone: "reject" },
};

export function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEventType, setSelectedEventType] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadAuditEvents() {
    setLoading(true);
    setError("");
    try {
      const data = await api<AuditEvent[]>("/api/v1/audit?limit=300");
      setEvents(Array.isArray(data) ? data : []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể tải dữ liệu nhật ký kiểm toán."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAuditEvents();
  }, []);

  // Filter events
  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((event) => {
      if (selectedEventType !== "ALL" && event.event_type !== selectedEventType) {
        return false;
      }
      if (!q) return true;
      return [
        event.event_type,
        event.entity_type,
        event.entity_id,
        event.actor_id,
        event.reason_code,
        event.model_name,
        event.request_id,
      ].some((val) => val?.toLowerCase().includes(q));
    });
  }, [events, searchQuery, selectedEventType]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-normal text-[var(--on-surface)]">
            Nhật ký kiểm toán
          </h1>
          <p className="text-[13px] text-[var(--on-surface-variant)] mt-0.5">
            Truy vết toàn bộ phân luồng AI, quyết định ca duyệt và thay đổi quy định (append-only)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="tonal"
            size="sm"
            onClick={() => void loadAuditEvents()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--error)]/30 bg-[var(--error)]/10 p-4 text-sm text-[var(--error)] flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Event Type Filter Chips */}
      <div className="flex flex-col gap-3 bg-[var(--surface)] p-4 rounded-[var(--radius-lg)] border border-[var(--outline)]/30 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo loại sự kiện, mã đối tượng, người thực hiện, lý do..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface-container-low)] rounded-full border border-transparent focus:border-[var(--primary)] focus:bg-[var(--surface)] text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)]/60 focus:outline-none transition-colors"
            />
          </div>
          <span className="text-xs text-[var(--on-surface-variant)] whitespace-nowrap self-end sm:self-center font-medium">
            {filteredEvents.length} / {events.length} sự kiện
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--outline)]/15">
          <span className="text-[12px] font-medium text-[var(--on-surface-variant)] mr-1">
            Loại sự kiện:
          </span>
          <Chip
            label="Tất cả"
            selected={selectedEventType === "ALL"}
            onClick={() => setSelectedEventType("ALL")}
          />
          {Object.entries(EVENT_TYPE_LABELS).map(([type, meta]) => (
            <Chip
              key={type}
              label={meta.label}
              selected={selectedEventType === type}
              onClick={() => setSelectedEventType(type)}
            />
          ))}
        </div>
      </div>

      {/* Material Data Table */}
      <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--outline)]/30 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-[52px] bg-[var(--surface-container-low)] rounded animate-pulse w-full"
              />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[var(--surface-container-high)] flex items-center justify-center text-[var(--on-surface-variant)] mb-3">
              <History className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-[var(--on-surface)]">
              Không tìm thấy sự kiện kiểm toán nào
            </p>
            <p className="text-xs text-[var(--on-surface-variant)] mt-1">
              Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc loại sự kiện.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--outline)]/20 bg-[var(--surface-container-low)]">
                  <th className="px-4 py-3 text-[12px] font-medium text-[var(--on-surface-variant)] whitespace-nowrap">
                    Thời gian
                  </th>
                  <th className="px-4 py-3 text-[12px] font-medium text-[var(--on-surface-variant)] whitespace-nowrap">
                    Loại sự kiện
                  </th>
                  <th className="px-4 py-3 text-[12px] font-medium text-[var(--on-surface-variant)] whitespace-nowrap">
                    Thực thể
                  </th>
                  <th className="px-4 py-3 text-[12px] font-medium text-[var(--on-surface-variant)] whitespace-nowrap">
                    Tác nhân
                  </th>
                  <th className="px-4 py-3 text-[12px] font-medium text-[var(--on-surface-variant)] whitespace-nowrap">
                    Xử lý
                  </th>
                  <th className="px-4 py-3 text-[12px] font-medium text-[var(--on-surface-variant)] text-right whitespace-nowrap">
                    Chi tiết
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => {
                  const isExpanded = expandedId === event.id;
                  const typeMeta = EVENT_TYPE_LABELS[event.event_type] || {
                    label: event.event_type,
                    tone: "neutral",
                  };

                  return (
                    <React.Fragment key={event.id}>
                      <tr
                        onClick={() => toggleExpand(event.id)}
                        className={`h-[52px] border-b border-[var(--outline)]/15 cursor-pointer transition-colors ${
                          isExpanded
                            ? "bg-[var(--surface-container)]"
                            : "hover:bg-[var(--surface-container-low)]/60"
                        }`}
                      >
                        {/* Timestamp */}
                        <td className="px-4 py-2.5 text-xs text-[var(--on-surface-variant)] font-mono whitespace-nowrap">
                          {new Date(event.created_at).toLocaleString("vi-VN")}
                        </td>

                        {/* Event Type */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <Badge tone={typeMeta.tone}>{typeMeta.label}</Badge>
                        </td>

                        {/* Entity */}
                        <td className="px-4 py-2.5 text-sm whitespace-nowrap">
                          <span className="font-medium text-[var(--on-surface)]">
                            {event.entity_type}
                          </span>
                          <span className="text-xs text-[var(--on-surface-variant)] ml-1.5 font-mono">
                            · {event.entity_id}
                          </span>
                        </td>

                        {/* Actor */}
                        <td className="px-4 py-2.5 text-xs text-[var(--on-surface)] whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] font-mono">
                            {event.actor_id ?? "system"}
                          </span>
                        </td>

                        {/* Duration */}
                        <td className="px-4 py-2.5 text-xs text-[var(--on-surface-variant)] font-mono whitespace-nowrap">
                          {event.duration_ms == null ? "—" : `${event.duration_ms} ms`}
                        </td>

                        {/* Toggle button */}
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            aria-label={isExpanded ? "Thu gọn" : "Xem chi tiết"}
                            className="p-1 rounded text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] transition-colors inline-flex items-center"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="border-b border-[var(--outline)]/20 bg-[var(--surface-container-low)]">
                          <td colSpan={6} className="p-4 sm:p-6">
                            <div className="grid gap-4 bg-[var(--surface)] p-4 rounded-[var(--radius-md)] border border-[var(--outline)]/30 text-xs">
                              {/* Metadata Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-[var(--outline)]/15 pb-3">
                                <div>
                                  <span className="text-[var(--on-surface-variant)] block mb-0.5">Mã lý do</span>
                                  <code className="text-[var(--on-surface)] font-semibold">
                                    {event.reason_code ?? "—"}
                                  </code>
                                </div>
                                <div>
                                  <span className="text-[var(--on-surface-variant)] block mb-0.5">Mô hình AI</span>
                                  <code className="text-[var(--on-surface)] font-semibold">
                                    {event.model_name ?? "—"}
                                  </code>
                                </div>
                                <div>
                                  <span className="text-[var(--on-surface-variant)] block mb-0.5">Prompt Version</span>
                                  <code className="text-[var(--on-surface)] font-semibold">
                                    {event.prompt_version ?? "—"}
                                  </code>
                                </div>
                                <div>
                                  <span className="text-[var(--on-surface-variant)] block mb-0.5">Request ID</span>
                                  <code className="text-[var(--on-surface)] font-mono text-[11px] truncate block">
                                    {event.request_id ?? "—"}
                                  </code>
                                </div>
                              </div>

                              {/* Snapshots */}
                              <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                  <div className="flex items-center gap-1.5 mb-1.5 font-medium text-[var(--on-surface)]">
                                    <FileCode className="w-3.5 h-3.5 text-[var(--primary)]" />
                                    <span>Đầu vào (Input Snapshot)</span>
                                  </div>
                                  <pre className="p-3 bg-[var(--surface-container-lowest)] rounded border border-[var(--outline)]/20 overflow-x-auto text-[11px] font-mono leading-relaxed text-[var(--on-surface)] max-h-60">
                                    {JSON.stringify(event.input_snapshot, null, 2)}
                                  </pre>
                                </div>

                                <div>
                                  <div className="flex items-center gap-1.5 mb-1.5 font-medium text-[var(--on-surface)]">
                                    <FileCode className="w-3.5 h-3.5 text-[var(--primary)]" />
                                    <span>Kết quả (Output Snapshot)</span>
                                  </div>
                                  <pre className="p-3 bg-[var(--surface-container-lowest)] rounded border border-[var(--outline)]/20 overflow-x-auto text-[11px] font-mono leading-relaxed text-[var(--on-surface)] max-h-60">
                                    {JSON.stringify(event.output_snapshot, null, 2)}
                                  </pre>
                                </div>
                              </div>

                              {/* Evidence IDs */}
                              {event.evidence_ids && event.evidence_ids.length > 0 && (
                                <div className="pt-2 border-t border-[var(--outline)]/15">
                                  <span className="font-medium text-[var(--on-surface)] block mb-1">
                                    Căn cứ trích dẫn ({event.evidence_ids.length})
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {event.evidence_ids.map((id) => (
                                      <span
                                        key={id}
                                        className="px-2 py-0.5 bg-[var(--surface-container-high)] rounded text-[11px] font-mono text-[var(--on-surface)]"
                                      >
                                        {id}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
