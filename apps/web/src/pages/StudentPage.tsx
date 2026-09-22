import { FormEvent, useEffect, useState } from "react";

import { api, postJson } from "../api/client";
import { CitationList } from "../components/CitationList";
import { PageHeader } from "../components/PageHeader";
import { RouteBadge } from "../components/RouteBadge";
import type { AIHealth, QuestionResponse } from "../types";

const co3001Examples = [
  "Một nhóm đồ án được có bao nhiêu thành viên?",
  "Rubric chấm điểm báo cáo và sản phẩm như thế nào?",
  "Nhóm em xin phép có 6 thành viên được không?"
];

const dadnExamples = [
  "Tỷ lệ điểm giữa kỳ, quá trình, báo cáo tổng kết và demo là bao nhiêu?",
  "Yêu cầu nộp mô tả tổng quan đề tài là gì?",
  "Các nhóm cần thực hiện theo những mốc công việc nào?"
];

const demoActors = {
  "student-a1": { label: "Student A1 · Group A", courseId: "CO3001", courseLabel: "CO3001 · Đồ án chuyên ngành" },
  "student-b1": { label: "Student B1 · Group B", courseId: "CO3001", courseLabel: "CO3001 · Đồ án chuyên ngành" },
  "student-dadn-a1": { label: "Student DADN A1 · Group A", courseId: "DADN-HK242", courseLabel: "DADN · Đồ án Đa ngành · HK242" },
  "student-dadn-b1": { label: "Student DADN B1 · Group B", courseId: "DADN-HK242", courseLabel: "DADN · Đồ án Đa ngành · HK242" }
} as const;
type DemoActorId = keyof typeof demoActors;

export function StudentPage() {
  const [actorId, setActorId] = useState<DemoActorId>("student-a1");
  const [question, setQuestion] = useState(co3001Examples[0]);
  const [result, setResult] = useState<QuestionResponse | null>(null);
  const [clarification, setClarification] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aiStatus, setAiStatus] = useState("Đang kiểm tra AI");
  const actor = demoActors[actorId];
  const examples = actor.courseId === "DADN-HK242" ? dadnExamples : co3001Examples;

  function changeActor(nextActorId: DemoActorId) {
    setActorId(nextActorId);
    setQuestion((nextActorId.startsWith("student-dadn") ? dadnExamples : co3001Examples)[0]);
    setResult(null);
    setError("");
  }

  useEffect(() => {
    api<AIHealth>("/health/ai")
      .then((health) => setAiStatus(health.available ? `${health.mode} · ${health.model}` : `${health.mode} không khả dụng`))
      .catch(() => setAiStatus("AI offline"));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await postJson<QuestionResponse>("/api/v1/questions", {
        actor_id: actorId,
        course_id: actor.courseId,
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
        title="Hỏi với đầy đủ căn cứ"
        description="Câu hỏi thường quy được trả lời theo bằng chứng. Mọi yêu cầu ngoại lệ đều chuyển cho con người."
        actions={<div className="health-pill"><span />{aiStatus}</div>}
      />

      <div className="student-layout">
        <section className="panel composer-panel">
          <div className="field-row">
            <label>
              Người gửi
              <select value={actorId} onChange={(event) => changeActor(event.target.value as DemoActorId)}>
                {Object.entries(demoActors).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
              </select>
            </label>
            <label>
              Môn học
              <select disabled value={actor.courseId}><option>{actor.courseLabel}</option></select>
            </label>
          </div>
          <form onSubmit={submit}>
            <label>
              Câu hỏi
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
              {busy ? "Đang xử lý…" : "Gửi câu hỏi"}
            </button>
          </form>
          {error && <div className="error-banner">{error}</div>}
        </section>

        <section className={`panel result-panel ${result ? "has-result" : "empty-result"}`}>
          {!result && (
            <div className="empty-state">
              <div className="empty-orbit"><span /></div>
              <h2>Chưa có kết quả</h2>
              <p>Câu trả lời, route và evidence sẽ xuất hiện tại đây.</p>
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
                  <span>Cần bổ sung một thông tin</span>
                  <h2>{result.clarifying_question}</h2>
                  <form onSubmit={submitClarification}>
                    <input value={clarification} onChange={(event) => setClarification(event.target.value)} />
                    <button disabled={busy || !clarification.trim()}>Gửi bổ sung</button>
                  </form>
                </div>
              )}
              {result.route === "ESCALATE" && (
                <div className="decision-callout escalate-callout">
                  <span>Cần giảng viên review</span>
                  <h2>Case đã gửi Lecturer 01</h2>
                  <p>Case ID: <code>{result.case_id}</code></p>
                  <button className="secondary-button" onClick={refreshResult} disabled={busy}>
                    Làm mới quyết định
                  </button>
                </div>
              )}
              {result.final_decision && (
                <div className="final-decision">
                  <RouteBadge value={result.final_decision} />
                  <div>
                    <strong>Đã nhận quyết định của giảng viên</strong>
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
