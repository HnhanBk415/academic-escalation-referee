import { FormEvent, useEffect, useState } from "react";

import { api, postJson } from "../api/client";
import { CitationList } from "../components/CitationList";
import { PageHeader } from "../components/PageHeader";
import { RouteBadge } from "../components/RouteBadge";
import type { QuestionResponse } from "../types";

const examples = [
  "Một nhóm đồ án được có bao nhiêu thành viên?",
  "Rubric chấm điểm báo cáo và sản phẩm như thế nào?",
  "Nhóm em xin phép có 6 thành viên được không?"
];

export function StudentPage() {
  const [actorId, setActorId] = useState("student-a1");
  const [question, setQuestion] = useState(examples[0]);
  const [result, setResult] = useState<QuestionResponse | null>(null);
  const [clarification, setClarification] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aiStatus, setAiStatus] = useState("checking");

  useEffect(() => {
    api<{ available: boolean; model: string }>("/health/ai")
      .then((health) => setAiStatus(health.available ? health.model : "unavailable"))
      .catch(() => setAiStatus("offline"));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await postJson<QuestionResponse>("/api/v1/questions", {
        actor_id: actorId,
        course_id: "CO3001",
        text: question
      });
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể gửi câu hỏi.");
    } finally {
      setBusy(false);
    }
  }

  async function submitClarification(event: FormEvent) {
    event.preventDefault();
    if (!result) return;
    setBusy(true);
    setError("");
    try {
      const response = await postJson<QuestionResponse>(
        `/api/v1/questions/${result.question_id}/clarifications`,
        { text: clarification }
      );
      setResult(response);
      setClarification("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể gửi bổ sung.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshResult() {
    if (!result) return;
    setBusy(true);
    try {
      setResult(await api<QuestionResponse>(`/api/v1/questions/${result.question_id}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể cập nhật.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Student workspace"
        title="Ask with confidence."
        description="Routine policy questions are grounded in evidence. Exceptions always go to a human."
        actions={<div className="health-pill"><span />{aiStatus}</div>}
      />

      <div className="student-layout">
        <section className="panel composer-panel">
          <div className="field-row">
            <label>
              Acting as
              <select value={actorId} onChange={(event) => setActorId(event.target.value)}>
                <option value="student-a1">Student A1 · Group A</option>
                <option value="student-b1">Student B1 · Group B</option>
              </select>
            </label>
            <label>
              Course
              <select disabled value="CO3001"><option>CO3001 · Đồ án chuyên ngành</option></select>
            </label>
          </div>
          <form onSubmit={submit}>
            <label>
              Your question
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={6}
                placeholder="Hỏi về quy định, rubric hoặc yêu cầu ngoại lệ…"
              />
            </label>
            <div className="example-row">
              {examples.map((example) => (
                <button type="button" className="chip" key={example} onClick={() => setQuestion(example)}>
                  {example.length > 42 ? `${example.slice(0, 42)}…` : example}
                </button>
              ))}
            </div>
            <button className="primary-button" disabled={busy || question.trim().length < 3}>
              {busy ? "Referee is working…" : "Submit question"}
            </button>
          </form>
          {error && <div className="error-banner">{error}</div>}
        </section>

        <section className={`panel result-panel ${result ? "has-result" : "empty-result"}`}>
          {!result && (
            <div className="empty-state">
              <div className="empty-orbit"><span /></div>
              <h2>No decision yet</h2>
              <p>Your grounded response and evidence packet will appear here.</p>
            </div>
          )}
          {result && (
            <>
              <div className="result-head">
                <RouteBadge value={result.route} />
                <span className="mono">{result.reason_code}</span>
              </div>
              {result.answer && <h2 className="answer-text">{result.answer}</h2>}
              {result.clarifying_question && (
                <div className="decision-callout clarify-callout">
                  <span>One detail needed</span>
                  <h2>{result.clarifying_question}</h2>
                  <form onSubmit={submitClarification}>
                    <input value={clarification} onChange={(event) => setClarification(event.target.value)} />
                    <button disabled={busy || !clarification.trim()}>Send detail</button>
                  </form>
                </div>
              )}
              {result.route === "ESCALATE" && (
                <div className="decision-callout escalate-callout">
                  <span>Human review required</span>
                  <h2>Case sent to Lecturer 01</h2>
                  <p>Case ID: <code>{result.case_id}</code></p>
                  <button className="secondary-button" onClick={refreshResult} disabled={busy}>
                    Refresh decision
                  </button>
                </div>
              )}
              {result.final_decision && (
                <div className="final-decision">
                  <RouteBadge value={result.final_decision} />
                  <div>
                    <strong>Lecturer decision received</strong>
                    <p>{result.final_decision_reason}</p>
                  </div>
                </div>
              )}
              <CitationList citations={result.citations} />
              <div className="result-meta">
                <span>{new Date(result.created_at).toLocaleString("vi-VN")}</span>
                <code>{result.question_id}</code>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
