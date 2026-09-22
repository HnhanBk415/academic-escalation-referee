import { FormEvent, useCallback, useEffect, useState } from "react";

import { api, postJson }  from "../api/client";
import { CitationList }   from "../components/CitationList";
import { PageHeader }     from "../components/PageHeader";
import { RouteBadge }     from "../components/RouteBadge";
import { SLATimer }       from "../components/SLATimer";
import { StepTracker }    from "../components/StepTracker";
import type { CaseDetail, CaseSummary, PolicyException } from "../types";

type Decision = "APPROVED" | "REJECTED" | "NEED_MORE_INFO" | "FORWARDED";

const DECISION_LABELS: Record<Decision, string> = {
  APPROVED:       "Phê duyệt",
  REJECTED:       "Từ chối",
  NEED_MORE_INFO: "Cần thêm thông tin",
  FORWARDED:      "Chuyển tiếp",
};

const CASE_STEPS = [
  { label: "Gửi câu hỏi",         desc: "Sinh viên gửi yêu cầu học vụ" },
  { label: "Kiểm tra & Phát hiện", desc: "AI phát hiện vấn đề vượt thẩm quyền" },
  { label: "Thẩm định & Quyết định", desc: "Giảng viên phê duyệt ngoại lệ" },
];

export function LecturerPage() {
  const [cases, setCases]                 = useState<CaseSummary[]>([]);
  const [selected, setSelected]           = useState<CaseDetail | null>(null);
  const [exceptions, setExceptions]       = useState<PolicyException[]>([]);
  const [decision, setDecision]           = useState<Decision>("APPROVED");
  const [reason, setReason]               = useState("");
  const [exceptionContent, setExceptionContent] = useState("Nhóm được phép có tối đa 6 thành viên.");
  const [createException, setCreateException]   = useState(true);
  const [validFrom, setValidFrom]         = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil]       = useState("2027-01-31");
  const [statusFilter, setStatusFilter]   = useState("");
  const [busy, setBusy]                   = useState(false);
  const [notice, setNotice]               = useState("");
  const [error, setError]                 = useState("");

  const loadData = useCallback(async () => {
    const suffix = statusFilter ? `?status=${statusFilter}` : "";
    const [caseItems, exItems] = await Promise.all([
      api<CaseSummary[]>(`/api/v1/cases${suffix}`),
      api<PolicyException[]>("/api/v1/exceptions"),
    ]);
    setCases(caseItems);
    setExceptions(exItems);
  }, [statusFilter]);

  useEffect(() => {
    loadData().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [loadData]);

  async function selectCase(caseId: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      setSelected(await api<CaseDetail>(`/api/v1/cases/${caseId}`));
      setReason(""); setCreateException(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể mở case.");
    } finally { setBusy(false); }
  }

  async function submitDecision(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    const createsException = decision === "APPROVED" && createException;
    try {
      await postJson(
        `/api/v1/cases/${selected.id}/decision`,
        {
          reviewer_id: "lecturer-01",
          decision,
          reason,
          create_exception: createsException,
          exception: createsException ? {
            scope_type: "GROUP",
            scope_id:   selected.group_id,
            course_id:  selected.course_id,
            content:    exceptionContent,
            valid_from: validFrom,
            valid_until: validUntil,
          } : null,
        },
        { "Idempotency-Key": `${selected.id}-${decision}-${Date.now()}` },
      );
      setNotice("✅ Đã lưu quyết định và cập nhật kết quả cho sinh viên.");
      await loadData();
      setSelected(await api<CaseDetail>(`/api/v1/cases/${selected.id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể ghi quyết định.");
    } finally { setBusy(false); }
  }

  async function cancelSelected() {
    if (!selected) return;
    const cancelReason = window.prompt("Lý do hủy case:", "Yêu cầu không còn cần xử lý.");
    if (!cancelReason) return;
    setBusy(true);
    try {
      await postJson(`/api/v1/cases/${selected.id}/cancel`, {
        actor_id: "lecturer-01",
        reason: cancelReason,
      });
      setNotice("Đã hủy case.");
      await loadData();
      setSelected(await api<CaseDetail>(`/api/v1/cases/${selected.id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể hủy case.");
    } finally { setBusy(false); }
  }

  async function revoke(item: PolicyException) {
    const revokeReason = window.prompt("Lý do revoke:", "Điều kiện ngoại lệ không còn tồn tại.");
    if (!revokeReason) return;
    setBusy(true);
    try {
      await postJson(`/api/v1/exceptions/${item.id}/revoke`, {
        actor_id: "lecturer-01",
        reason: revokeReason,
      });
      setNotice("✅ Đã revoke exception. Câu hỏi sau sẽ áp dụng policy chung.");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể revoke.");
    } finally { setBusy(false); }
  }

  const caseStep = selected
    ? (["DECIDED", "CANCELLED"].includes(selected.status) ? 2
       : selected.status === "UNDER_REVIEW" ? 1 : 0)
    : 0;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Chuyển tiếp cấp cao · AER Protocol · Định tuyến tự động"
        title="Hồ sơ học vụ giảng viên"
        description="Review câu hỏi, scope actor và policy evidence trước khi quyết định."
        actions={
          <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tất cả case</option>
            <option value="UNDER_REVIEW">Đang review</option>
            <option value="WAITING_FOR_STUDENT">Chờ sinh viên</option>
            <option value="FORWARDED">Đã chuyển tiếp</option>
            <option value="DECIDED">Đã quyết định</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        }
      />

      {error  && <div className="error-banner"   role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}

      {/* Step tracker – shows current case status */}
      {selected && <StepTracker steps={CASE_STEPS} currentStep={caseStep} />}

      <div className="lecturer-layout">
        {/* ── Case queue ── */}
        <section className="panel case-queue">
          <div className="panel-title">
            <span>Hàng chờ xử lý</span>
            <span className="badge-count">{cases.length}</span>
          </div>
          <div className="case-list">
            {cases.map((item) => (
              <button
                id={`case-row-${item.id}`}
                key={item.id}
                className={`case-row ${selected?.id === item.id ? "selected" : ""}`}
                onClick={() => selectCase(item.id)}
              >
                <div className="case-row-top">
                  <RouteBadge value={item.status} />
                  <time dateTime={item.created_at}>
                    {new Date(item.created_at).toLocaleDateString("vi-VN")}
                  </time>
                </div>
                <strong>{item.decision_question}</strong>
                <span>{item.reason_code}</span>
              </button>
            ))}
            {!cases.length && <div className="queue-empty">Không có case trong bộ lọc này.</div>}
          </div>
        </section>

        {/* ── Case detail ── */}
        <section className="panel case-detail">
          {!selected && (
            <div className="empty-state" style={{ minHeight: 440, display: "grid", placeContent: "center" }}>
              <div className="empty-orbit">📋</div>
              <h2>Chọn một hồ sơ</h2>
              <p>Evidence packet và phần quyết định sẽ xuất hiện tại đây.</p>
            </div>
          )}

          {selected && (
            <div className="case-detail-grid">
              {/* Left: detail content */}
              <div>
                {/* Header */}
                <div className="case-id-header">
                  <div>
                    <span className="case-id-tag">Hồ sơ học vụ #{selected.id.slice(0, 8).toUpperCase()}</span>
                    <h2>{selected.original_question}</h2>
                  </div>
                  <button
                    className="danger-button compact-button"
                    onClick={cancelSelected}
                    disabled={busy || ["DECIDED", "CANCELLED"].includes(selected.status)}
                  >
                    Hủy hồ sơ
                  </button>
                </div>

                {/* Context grid */}
                <div className="context-grid">
                  <div><span>Sinh viên</span><strong>{selected.actor_id}</strong></div>
                  <div><span>Nhóm</span><strong>{selected.group_id ?? "Chưa xác định"}</strong></div>
                  <div><span>Môn học</span><strong>{selected.course_id}</strong></div>
                  <div><span>Loại bất định</span><strong>{selected.uncertainty_type}</strong></div>
                </div>

                {/* Decision question */}
                <div className="decision-question">
                  <span className="dq-label">Câu hỏi quyết định của AER</span>
                  <h3>{selected.decision_question}</h3>
                  <p>{selected.ai_summary}</p>
                </div>

                {/* Citations */}
                <CitationList citations={selected.citations} />

                {/* Decision form */}
                {!["DECIDED", "CANCELLED"].includes(selected.status) && (
                  <form className="decision-form" onSubmit={submitDecision} id="decision-form">
                    <div className="section-label">Quyết định của giảng viên</div>
                    <div className="decision-tabs">
                      {(["APPROVED", "REJECTED", "NEED_MORE_INFO", "FORWARDED"] as Decision[]).map((val) => (
                        <button type="button" key={val}
                          className={decision === val ? "active" : ""}
                          onClick={() => setDecision(val)}
                        >
                          {DECISION_LABELS[val]}
                        </button>
                      ))}
                    </div>

                    <label>
                      Lý do <em>bắt buộc</em>
                      <textarea
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ghi lại căn cứ quyết định…"
                      />
                    </label>

                    {decision === "APPROVED" && (
                      <div className="exception-form">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={createException}
                            onChange={(e) => setCreateException(e.target.checked)}
                          />
                          Tạo ngoại lệ chính sách sau khi phê duyệt
                        </label>
                        {createException && (
                          <>
                            <div className="exception-scope">
                              <span>Phạm vi áp dụng</span>
                              <strong>GROUP · {selected.group_id}</strong>
                            </div>
                            <label>
                              Nội dung ngoại lệ
                              <textarea rows={2} value={exceptionContent} onChange={(e) => setExceptionContent(e.target.value)} />
                            </label>
                            <div className="field-row">
                              <label>Từ ngày<input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></label>
                              <label>Đến ngày<input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></label>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <button
                      id="submit-decision-btn"
                      className="primary-button"
                      disabled={busy || reason.trim().length < 3 || (decision === "APPROVED" && !selected.group_id)}
                    >
                      {busy ? "Đang lưu…" : "Xác nhận quyết định →"}
                    </button>
                  </form>
                )}

                {["DECIDED", "CANCELLED"].includes(selected.status) && (
                  <div className="success-banner" style={{ marginTop: 20 }}>
                    Hồ sơ đã được xử lý – trạng thái: <strong>{selected.status}</strong>
                  </div>
                )}
              </div>

              {/* Right: AER routing panel */}
              <div>
                <SLATimer createdAt={selected.created_at} />

                <div className="aer-routing-panel" style={{ marginTop: 14 }}>
                  <div className="panel-title" style={{ background: "var(--navy)", color: "#e2e8f0" }}>
                    ⚖ Phân luồng AER System
                  </div>
                  <div className="routing-body">
                    <div className="routing-rule">
                      <div className="rule-title">Lý do leo thang</div>
                      <strong>{selected.reason_code}</strong>
                    </div>
                    <div className="routing-rule">
                      <div className="rule-title">Loại bất định</div>
                      <strong>{selected.uncertainty_type}</strong>
                    </div>
                    <div className="reviewer-card">
                      <div className="reviewer-avatar">TS</div>
                      <div className="reviewer-info">
                        <strong>Giảng viên phụ trách</strong>
                        <span>lecturer-01 · CO3001</span>
                      </div>
                      <div className="online-badge">Online</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Exception register */}
      <section className="panel" style={{ marginTop: 20, overflow: "hidden" }}>
        <div className="panel-title">
          <span>Danh sách ngoại lệ chính sách</span>
          <span className="badge-count">{exceptions.length}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Trạng thái</th>
                <th>Phạm vi</th>
                <th>Nội dung ngoại lệ</th>
                <th>Thời hạn</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((item) => (
                <tr key={item.id}>
                  <td><RouteBadge value={item.status} /></td>
                  <td>
                    <strong>{item.scope_type}</strong>
                    <small>{item.scope_id}</small>
                  </td>
                  <td>{item.content}</td>
                  <td>
                    {item.valid_from}
                    <br />
                    {item.valid_until}
                  </td>
                  <td>
                    <button
                      className="text-button"
                      style={{ color: "var(--red)" }}
                      disabled={item.status !== "ACTIVE" || busy}
                      onClick={() => revoke(item)}
                    >
                      Thu hồi
                    </button>
                  </td>
                </tr>
              ))}
              {!exceptions.length && (
                <tr><td colSpan={5} className="table-empty">Chưa có ngoại lệ nào được tạo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
