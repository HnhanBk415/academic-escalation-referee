import React, { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, ChevronDown, ChevronUp, FileCode, History, AlertCircle } from "lucide-react";
import { api } from "../api/client";
import { Badge, Button, Chip, PageHeader } from "../components/ui";
import { auditEventLabel, auditEventTone } from "../utils/labels";
import type { AuditEvent } from "../types";

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

  const AUDIT_EVENT_FILTERS = [
    { key: "ALL", label: "Tất cả" },
    { key: "ANSWER_RETURNED", label: "Trả lời sinh viên" },
    { key: "CASE_ESCALATED", label: "Chuyển tiếp giảng viên" },
    { key: "CLARIFICATION_REQUESTED", label: "Yêu cầu làm rõ" },
    { key: "REQUEST_REJECTED", label: "Từ chối yêu cầu" },
  ] as const;

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PageHeader
        title="Nhật ký kiểm toán"
        description="Truy vết toàn bộ phân luồng AI, quyết định ca duyệt và thay đổi quy định (append-only)"
        actions={
          <Button
            variant="tonal"
            size="sm"
            onClick={() => void loadAuditEvents()}
            disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />}
          >
            Làm mới
          </Button>
        }
      />

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--error)]/30 bg-[var(--error)]/10 p-4 text-sm text-[var(--error)] flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Event Type Filter Chips */}
      <div className="flex flex-col gap-3 bg-[var(--surface)] p-4 rounded-[var(--radius-lg)] border border-[var(--outline)]/30 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div data-tour="audit-search" className="relative flex-1">
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

        <div data-tour="audit-filters" className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--outline)]/15">
          <span className="text-xs font-medium text-[var(--on-surface-variant)] mr-1">
            Loại sự kiện:
          </span>
          {AUDIT_EVENT_FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              selected={selectedEventType === f.key}
              onClick={() => setSelectedEventType(f.key)}
            />
          ))}
        </div>
      </div>

      {/* Material Data Table */}
      <div data-tour="audit-table" className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--outline)]/30 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-[3.25rem] bg-[var(--surface-container-low)] rounded animate-pulse w-full"
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
                  <th className="px-4 py-3 text-xs font-medium text-[var(--on-surface-variant)] whitespace-nowrap">
                    Thời gian
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--on-surface-variant)] whitespace-nowrap">
                    Loại sự kiện
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--on-surface-variant)] whitespace-nowrap">
                    Thực thể
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--on-surface-variant)] whitespace-nowrap">
                    Tác nhân
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--on-surface-variant)] whitespace-nowrap">
                    Xử lý
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--on-surface-variant)] text-right whitespace-nowrap">
                    Chi tiết
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event, idx) => {
                  const isExpanded = expandedId === event.id;
                  const label = auditEventLabel(event.event_type);
                  const tone = auditEventTone(event.event_type);

                  return (
                    <React.Fragment key={event.id}>
                      <tr
                        onClick={() => toggleExpand(event.id)}
                        className={`h-[3.25rem] border-b border-[var(--outline)]/15 cursor-pointer transition-colors ${
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
                          <Badge tone={tone}>{label}</Badge>
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
                            data-tour={idx === 0 ? "audit-expand" : undefined}
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
                                  <code className="text-[var(--on-surface)] font-mono text-xs truncate block">
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
                                  <pre className="p-3 bg-[var(--surface-container-lowest)] rounded border border-[var(--outline)]/20 overflow-x-auto text-xs font-mono leading-relaxed text-[var(--on-surface)] max-h-60">
                                    {JSON.stringify(event.input_snapshot, null, 2)}
                                  </pre>
                                </div>

                                <div>
                                  <div className="flex items-center gap-1.5 mb-1.5 font-medium text-[var(--on-surface)]">
                                    <FileCode className="w-3.5 h-3.5 text-[var(--primary)]" />
                                    <span>Kết quả (Output Snapshot)</span>
                                  </div>
                                  <pre className="p-3 bg-[var(--surface-container-lowest)] rounded border border-[var(--outline)]/20 overflow-x-auto text-xs font-mono leading-relaxed text-[var(--on-surface)] max-h-60">
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
                                        className="px-2 py-0.5 bg-[var(--surface-container-high)] rounded text-xs font-mono text-[var(--on-surface)]"
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
