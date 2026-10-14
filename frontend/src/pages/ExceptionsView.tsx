import React, { useEffect, useState } from "react";
import { ShieldAlert, RefreshCw, AlertCircle, FileText } from "lucide-react";
import { api, postJson } from "../api/client";
import { Badge, Button, Chip, Modal, PageHeader } from "../components/ui";
import { policyTopicLabel, groupLabel } from "../utils/labels";
import type { CourseExceptionOverview, PolicyException } from "../types";

interface FlattenedException extends PolicyException {
  courseCode: string;
  courseName: string;
  groupName?: string;
}

interface ExceptionsViewProps {
  actorId?: string;
}

export function ExceptionsView({ actorId = "lecturer-01" }: ExceptionsViewProps) {
  const [courses, setCourses] = useState<CourseExceptionOverview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [scopeFilter, setScopeFilter] = useState<"ALL" | "COURSE" | "GROUP" | "STUDENT">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "REVOKED">("ALL");

  // Revoke modal state
  const [revokingItem, setRevokingItem] = useState<FlattenedException | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState("");

  async function loadExceptions() {
    setLoading(true);
    setError("");
    try {
      const data = await api<CourseExceptionOverview[]>("/api/v1/exceptions/overview");
      setCourses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải ngoại lệ.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExceptions();
  }, []);

  // Flatten all exceptions across courses
  const allExceptions: FlattenedException[] = [];
  courses.forEach((c) => {
    c.course_exceptions.forEach((e) => {
      allExceptions.push({ ...e, courseCode: c.course_code, courseName: c.course_name });
    });
    c.groups.forEach((g) => {
      g.exceptions.forEach((e) => {
        allExceptions.push({
          ...e,
          courseCode: c.course_code,
          courseName: c.course_name,
          groupName: g.group_name,
        });
      });
    });
    c.student_exceptions.forEach((e) => {
      allExceptions.push({ ...e, courseCode: c.course_code, courseName: c.course_name });
    });
  });

  const filteredExceptions = allExceptions.filter((item) => {
    if (scopeFilter !== "ALL" && item.scope_type !== scopeFilter) return false;
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    return true;
  });

  function handleOpenRevoke(item: FlattenedException) {
    setRevokingItem(item);
    setRevokeReason("");
    setRevokeError("");
  }

  async function handleConfirmRevoke() {
    if (!revokingItem || !revokeReason.trim()) return;
    setIsRevoking(true);
    setRevokeError("");
    try {
      await postJson(`/api/v1/exceptions/${revokingItem.id}/revoke`, {
        actor_id: actorId,
        reason: revokeReason.trim(),
      });
      setRevokingItem(null);
      await loadExceptions();
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : "Không thể thu hồi ngoại lệ.");
    } finally {
      setIsRevoking(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Ngoại lệ quy chế"
        description="Theo dõi và quản lý ngoại lệ quy chế đã cấp theo môn học và nhóm lớp"
        actions={
          <Button
            variant="tonal"
            size="sm"
            onClick={() => void loadExceptions()}
            disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />}
          >
            Làm mới
          </Button>
        }
      />

      {/* Filter Chips Bar */}
      <div data-tour="exceptions-filters" className="flex flex-wrap items-center gap-2 bg-[var(--surface)] p-3 rounded-[var(--radius-lg)] border border-[var(--outline)]/30 shadow-xs">
        <span className="text-xs font-medium text-[var(--on-surface-variant)] mr-1">Phạm vi:</span>
        <Chip
          label="Tất cả"
          selected={scopeFilter === "ALL"}
          onClick={() => setScopeFilter("ALL")}
        />
        <Chip
          label="Toàn môn"
          selected={scopeFilter === "COURSE"}
          onClick={() => setScopeFilter("COURSE")}
        />
        <Chip
          label="Theo nhóm"
          selected={scopeFilter === "GROUP"}
          onClick={() => setScopeFilter("GROUP")}
        />
        <Chip
          label="Cá nhân"
          selected={scopeFilter === "STUDENT"}
          onClick={() => setScopeFilter("STUDENT")}
        />

        <div className="h-4 w-px bg-[var(--outline)]/30 mx-1 hidden sm:block" />

        <span className="text-xs font-medium text-[var(--on-surface-variant)] mr-1">Trạng thái:</span>
        <Chip
          label="Tất cả"
          selected={statusFilter === "ALL"}
          onClick={() => setStatusFilter("ALL")}
        />
        <Chip
          label="Đang hiệu lực"
          selected={statusFilter === "ACTIVE"}
          onClick={() => setStatusFilter("ACTIVE")}
        />
        <Chip
          label="Đã thu hồi"
          selected={statusFilter === "REVOKED"}
          onClick={() => setStatusFilter("REVOKED")}
        />
      </div>

      {/* Main Content / Table */}
      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--error)]/30 bg-[var(--error)]/10 p-4 text-sm text-[var(--error)] flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div data-tour="exceptions-table" className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--outline)]/30 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-[3.25rem] bg-[var(--surface-container-low)] rounded animate-pulse w-full"
              />
            ))}
          </div>
        ) : filteredExceptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[var(--surface-container-high)] flex items-center justify-center text-[var(--on-surface-variant)] mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-[var(--on-surface)]">
              Không có ngoại lệ quy chế nào
            </p>
            <p className="text-xs text-[var(--on-surface-variant)] mt-1">
              {allExceptions.length > 0
                ? "Không tìm thấy kết quả phù hợp với bộ lọc hiện tại."
                : "Chưa có ngoại lệ nào được ban hành cho các môn học."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--outline)]/20 bg-[var(--surface-container-low)]">
                  <th className="px-4 py-3 text-xs font-medium text-[var(--on-surface-variant)] whitespace-nowrap">
                    Môn học · Phạm vi
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--on-surface-variant)] whitespace-nowrap">
                    Chủ đề quy chế
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--on-surface-variant)]">
                    Nội dung ngoại lệ
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--on-surface-variant)] whitespace-nowrap">
                    Thời hạn hiệu lực
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--on-surface-variant)] whitespace-nowrap">
                    Trạng thái
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--on-surface-variant)] text-right whitespace-nowrap">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const firstActiveIndex = filteredExceptions.findIndex((item) => item.status === "ACTIVE");
                  return filteredExceptions.map((item, idx) => {
                    const isEffective = item.is_effective && item.status === "ACTIVE";
                    const isRevoked = item.status === "REVOKED";

                    return (
                      <tr
                        key={item.id}
                        className="h-[3.25rem] border-b border-[var(--outline)]/15 hover:bg-[var(--surface-container-low)]/50 transition-colors"
                      >
                        {/* Course / Scope */}
                        <td className="px-4 py-2.5 text-sm">
                          <div className="font-medium text-[var(--on-surface)]">
                            {item.courseCode}
                          </div>
                          <div className="text-xs text-[var(--on-surface-variant)]">
                            {item.scope_type === "COURSE" && "Toàn môn"}
                            {item.scope_type === "GROUP" && (item.groupName || groupLabel(item.scope_id))}
                            {item.scope_type === "STUDENT" && `SV: ${item.scope_id}`}
                          </div>
                        </td>

                        {/* Topic */}
                        <td className="px-4 py-2.5 text-xs">
                          <span className="font-medium text-[var(--primary)] bg-[var(--primary-container)] px-2 py-0.5 rounded-[var(--radius-sm)]">
                            {policyTopicLabel(item.policy_topic)}
                          </span>
                        </td>

                        {/* Content */}
                        <td className="px-4 py-2.5 text-sm text-[var(--on-surface)] max-w-md">
                          <p className="line-clamp-2 leading-snug">{item.content}</p>
                        </td>

                        {/* Validity */}
                        <td className="px-4 py-2.5 text-xs text-[var(--on-surface-variant)] whitespace-nowrap font-mono">
                          {item.valid_from} → {item.valid_until}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {isRevoked ? (
                            <Badge tone="neutral">Đã thu hồi</Badge>
                          ) : isEffective ? (
                            <Badge tone="answer">Đang hiệu lực</Badge>
                          ) : (
                            <Badge tone="neutral">{item.effective_status || "Hết hạn"}</Badge>
                          )}
                        </td>

                        {/* Action */}
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {item.status === "ACTIVE" ? (
                            <button
                              type="button"
                              data-tour={idx === firstActiveIndex ? "exceptions-revoke" : undefined}
                              onClick={() => handleOpenRevoke(item)}
                              className="text-sm font-medium text-[var(--error)] hover:underline hover:bg-[var(--error)]/10 px-2.5 py-1 rounded-[var(--radius-sm)] transition-colors"
                            >
                              Thu hồi
                            </button>
                          ) : (
                            <span className="text-xs text-[var(--on-surface-variant)]/60">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revoke Modal */}
      <Modal
        isOpen={Boolean(revokingItem)}
        onClose={() => !isRevoking && setRevokingItem(null)}
        title="Thu hồi ngoại lệ quy chế"
        size="md"
        footer={
          <>
            <Button
              variant="text"
              onClick={() => setRevokingItem(null)}
              disabled={isRevoking}
            >
              Hủy
            </Button>
            <Button
              variant="filled"
              className="bg-[var(--error)] hover:bg-[var(--error)]/90 text-white"
              onClick={() => void handleConfirmRevoke()}
              disabled={!revokeReason.trim() || isRevoking}
            >
              {isRevoking ? "Đang xử lý..." : "Xác nhận thu hồi"}
            </Button>
          </>
        }
      >
        {revokingItem && (
          <div className="space-y-4">
            <div className="p-3 bg-[var(--surface-container)] rounded-[var(--radius-md)] border border-[var(--outline)]/20 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-[var(--on-surface-variant)]">
                <span>
                  {revokingItem.courseCode} ·{" "}
                  {revokingItem.scope_type === "COURSE"
                    ? "Toàn môn"
                    : revokingItem.groupName || groupLabel(revokingItem.scope_id)}
                </span>
                <span className="font-medium text-[var(--primary)] bg-[var(--primary-container)] px-2 py-0.5 rounded-[var(--radius-sm)]">
                  {policyTopicLabel(revokingItem.policy_topic)}
                </span>
              </div>
              <p className="text-sm font-medium text-[var(--on-surface)] leading-relaxed">
                {revokingItem.content}
              </p>
            </div>

            {revokeError && (
              <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--error)]/10 text-[var(--error)] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{revokeError}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="revoke-reason"
                className="block text-xs font-medium text-[var(--on-surface)] mb-1.5"
              >
                Lý do thu hồi <span className="text-[var(--error)]">*</span>
              </label>
              <textarea
                id="revoke-reason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Nhập lý do thu hồi ngoại lệ này (bắt buộc)..."
                rows={3}
                className="w-full rounded-[var(--radius-md)] border border-[var(--outline)]/40 bg-[var(--surface)] px-3 py-2 text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)]/50 focus:border-[var(--primary)] focus:outline-none"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
