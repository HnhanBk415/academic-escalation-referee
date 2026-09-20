import { FormEvent, useCallback, useEffect, useState } from "react";

import { api, postJson } from "../api/client";
import { CitationList } from "../components/CitationList";
import { PageHeader } from "../components/PageHeader";
import { RouteBadge } from "../components/RouteBadge";
import type { CaseDetail, CaseSummary, PolicyException } from "../types";

type Decision = "APPROVED" | "REJECTED" | "NEED_MORE_INFO" | "FORWARDED";

export function LecturerPage() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selected, setSelected] = useState<CaseDetail | null>(null);
  const [exceptions, setExceptions] = useState<PolicyException[]>([]);
  const [decision, setDecision] = useState<Decision>("APPROVED");
  const [reason, setReason] = useState("");
  const [exceptionContent, setExceptionContent] = useState("Nhóm được phép có tối đa 6 thành viên.");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("2027-01-31");
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    const suffix = statusFilter ? `?status=${statusFilter}` : "";
    const [caseItems, exceptionItems] = await Promise.all([
      api<CaseSummary[]>(`/api/v1/cases${suffix}`),
      api<PolicyException[]>("/api/v1/exceptions")
    ]);
    setCases(caseItems);
    setExceptions(exceptionItems);
  }, [statusFilter]);

  useEffect(() => {
    loadData().catch((caught) => setError(caught instanceof Error ? caught.message : "Load failed"));
  }, [loadData]);

  async function selectCase(caseId: string) {
    setBusy(true);
    setError("");
    try {
      setSelected(await api<CaseDetail>(`/api/v1/cases/${caseId}`));
      setReason("");
      setNotice("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở case.");
    } finally {
      setBusy(false);
    }
  }

  async function submitDecision(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    const createsException = decision === "APPROVED";
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
            scope_id: selected.group_id,
            course_id: selected.course_id,
            content: exceptionContent,
            valid_from: validFrom,
            valid_until: validUntil
          } : null
        },
        { "Idempotency-Key": `${selected.id}-${decision}-${Date.now()}` }
      );
      setNotice("Decision recorded and student result updated.");
      await loadData();
      setSelected(await api<CaseDetail>(`/api/v1/cases/${selected.id}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể ghi quyết định.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelSelected() {
    if (!selected) return;
    const cancelReason = window.prompt("Lý do hủy case:", "Yêu cầu không còn cần xử lý.");
    if (!cancelReason) return;
    setBusy(true);
    try {
      await postJson(`/api/v1/cases/${selected.id}/cancel`, {
        actor_id: "lecturer-01",
        reason: cancelReason
      });
      setNotice("Case cancelled.");
      await loadData();
      setSelected(await api<CaseDetail>(`/api/v1/cases/${selected.id}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể hủy case.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(item: PolicyException) {
    const revokeReason = window.prompt("Lý do revoke:", "Điều kiện ngoại lệ không còn tồn tại.");
    if (!revokeReason) return;
    setBusy(true);
    try {
      await postJson(`/api/v1/exceptions/${item.id}/revoke`, {
        actor_id: "lecturer-01",
        reason: revokeReason
      });
      setNotice("Exception revoked. Future questions return to general policy.");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể revoke.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Lecturer console"
        title="Decisions, with context."
        description="Review the exact question, actor scope and supporting policy before deciding."
        actions={
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All cases</option>
            <option value="UNDER_REVIEW">Under review</option>
            <option value="WAITING_FOR_STUDENT">Waiting for student</option>
            <option value="FORWARDED">Forwarded</option>
            <option value="DECIDED">Decided</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        }
      />

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}

      <div className="lecturer-layout">
        <section className="panel case-queue">
          <div className="panel-title">
            <span>Case queue</span>
            <strong>{cases.length}</strong>
          </div>
          <div className="case-list">
            {cases.map((item) => (
              <button
                key={item.id}
                className={`case-row ${selected?.id === item.id ? "selected" : ""}`}
                onClick={() => selectCase(item.id)}
              >
                <div><RouteBadge value={item.status} /><time>{new Date(item.created_at).toLocaleDateString("vi-VN")}</time></div>
                <strong>{item.decision_question}</strong>
                <span>{item.reason_code}</span>
              </button>
            ))}
            {!cases.length && <div className="queue-empty">No cases in this view.</div>}
          </div>
        </section>

        <section className="panel case-detail">
          {!selected && (
            <div className="empty-state compact">
              <h2>Select a case</h2>
              <p>The evidence packet and decision controls will appear here.</p>
            </div>
          )}
          {selected && (
            <>
              <div className="case-context-head">
                <div>
                  <RouteBadge value={selected.status} />
                  <h2>{selected.original_question}</h2>
                </div>
                <button className="text-button danger-text" onClick={cancelSelected} disabled={busy || selected.status === "DECIDED" || selected.status === "CANCELLED"}>
                  Cancel case
                </button>
              </div>
              <div className="context-grid">
                <div><span>Student</span><strong>{selected.actor_id}</strong></div>
                <div><span>Group</span><strong>{selected.group_id ?? "Unresolved"}</strong></div>
                <div><span>Course</span><strong>{selected.course_id}</strong></div>
                <div><span>Uncertainty</span><strong>{selected.uncertainty_type}</strong></div>
              </div>
              <div className="decision-question">
                <span>Decision requested</span>
                <h3>{selected.decision_question}</h3>
                <p>{selected.ai_summary}</p>
              </div>
              <CitationList citations={selected.citations} />

              {!["DECIDED", "CANCELLED"].includes(selected.status) && (
                <form className="decision-form" onSubmit={submitDecision}>
                  <div className="section-label">Human decision</div>
                  <div className="decision-tabs">
                    {(["APPROVED", "REJECTED", "NEED_MORE_INFO", "FORWARDED"] as Decision[]).map((value) => (
                      <button type="button" key={value} className={decision === value ? "active" : ""} onClick={() => setDecision(value)}>
                        {value.replaceAll("_", " ")}
                      </button>
                    ))}
                  </div>
                  <label>
                    Reason <em>required</em>
                    <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Record the human rationale…" />
                  </label>
                  {decision === "APPROVED" && (
                    <div className="exception-form">
                      <div className="exception-scope">
                        <span>Exception scope</span>
                        <strong>GROUP · {selected.group_id}</strong>
                      </div>
                      <label>
                        Exception content
                        <textarea rows={2} value={exceptionContent} onChange={(event) => setExceptionContent(event.target.value)} />
                      </label>
                      <div className="field-row">
                        <label>Valid from<input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} /></label>
                        <label>Valid until<input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>
                      </div>
                    </div>
                  )}
                  <button className="primary-button" disabled={busy || reason.trim().length < 3 || (decision === "APPROVED" && !selected.group_id)}>
                    {busy ? "Recording…" : "Confirm decision"}
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      </div>

      <section className="panel exception-register">
        <div className="panel-title"><span>Exception register</span><strong>{exceptions.length}</strong></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Status</th><th>Scope</th><th>Content</th><th>Valid period</th><th /></tr></thead>
            <tbody>
              {exceptions.map((item) => (
                <tr key={item.id}>
                  <td><RouteBadge value={item.status} /></td>
                  <td><strong>{item.scope_type}</strong><small>{item.scope_id}</small></td>
                  <td>{item.content}</td>
                  <td>{item.valid_from}<br />{item.valid_until}</td>
                  <td><button className="text-button danger-text" disabled={item.status !== "ACTIVE" || busy} onClick={() => revoke(item)}>Revoke</button></td>
                </tr>
              ))}
              {!exceptions.length && <tr><td colSpan={5} className="table-empty">No exceptions created.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
