import { FormEvent, useEffect, useState } from "react";

import { api, postJson } from "../api/client";
import { CitationList }  from "../components/CitationList";
import { PageHeader }    from "../components/PageHeader";
import { RouteBadge }    from "../components/RouteBadge";
import { StepTracker }   from "../components/StepTracker";
import type { AIHealth, QuestionResponse } from "../types";

/* ── Demo data ── */
const co3001Examples = [
  "Một nhóm đồ án được có bao nhiêu thành viên?",
  "Rubric chấm điểm báo cáo và sản phẩm như thế nào?",
  "Nhóm em xin phép có 6 thành viên được không?",
];
const dadnExamples = [
  "Tỷ lệ điểm giữa kỳ, quá trình, báo cáo tổng kết và demo là bao nhiêu?",
  "Yêu cầu nộp mô tả tổng quan đề tài là gì?",
  "Các nhóm cần thực hiện theo những mốc công việc nào?",
  "Nhóm em xin phép có 6 thành viên được không?",
];

const demoActors = {
  "student-dadn-a1": { label: "Lê Văn Cường · DADN/A",  courseId: "DADN-HK242", courseLabel: "DADN · Đồ án Đa ngành (HK242)" },
  "student-dadn-b1": { label: "Phạm Thị Dung · DADN/B", courseId: "DADN-HK242", courseLabel: "DADN · Đồ án Đa ngành (HK242)" },
  "student-a1":      { label: "Nguyễn Văn An · Nhóm A", courseId: "CO3001",     courseLabel: "CO3001 · Đồ án chuyên ngành" },
  "student-b1":      { label: "Trần Thị Bình · Nhóm B", courseId: "CO3001",     courseLabel: "CO3001 · Đồ án chuyên ngành" },
} as const;
type DemoActorId = keyof typeof demoActors;

/* ── Route helper ── */
function routeConfig(route: string | null) {
  if (route === "ANSWER")  return { cls: "answer",  icon: "✅", title: "AI đã tìm thấy câu trả lời dựa trên quy chế", sub: "Trích xuất từ tài liệu được kiểm duyệt" };
  if (route === "CLARIFY") return { cls: "clarify", icon: "❓", title: "Cần bổ sung thêm thông tin", sub: "AI chưa đủ dữ kiện để phán quyết" };
  if (route === "ESCALATE")return { cls: "escalate",icon: "🔺", title: "Chuyển tiếp lên giảng viên để phê duyệt", sub: "Vượt thẩm quyền AI – con người sẽ quyết định" };
  return null;
}

/* ── Steps ── */
const STEPS = [
  { label: "Gửi câu hỏi",            desc: "Sinh viên gửi yêu cầu học vụ" },
  { label: "Kiểm tra & Phân luồng",  desc: "AI đối chiếu quy chế môn học" },
  { label: "AI Trả lời & Trích dẫn", desc: "Dẫn đủ căn cứ pháp lý" },
];

function getStep(busy: boolean, result: QuestionResponse | null) {
  if (!result && !busy) return 0;
  if (busy) return 1;
  return 2;
}

export function StudentPage() {
  const [actorId, setActorId]       = useState<DemoActorId>("student-dadn-a1");
  const [question, setQuestion]     = useState(dadnExamples[0]);
  const [result, setResult]         = useState<QuestionResponse | null>(null);
  const [clarification, setClarification] = useState("");
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState("");
  const [aiStatus, setAiStatus]     = useState("Đang kiểm tra AI…");
  const [aiOnline, setAiOnline]     = useState(false);

  const actor   = demoActors[actorId];
  const examples = actor.courseId === "DADN-HK242" ? dadnExamples : co3001Examples;

  function changeActor(nextId: DemoActorId) {
    setActorId(nextId);
    setQuestion((nextId.startsWith("student-dadn") ? dadnExamples : co3001Examples)[0]);
    setResult(null);
    setError("");
  }

  useEffect(() => {
    api<AIHealth>("/health/ai")
      .then((h) => {
        setAiOnline(h.available);
        setAiStatus(h.available ? `${h.mode} · ${h.model}` : `${h.mode} không khả dụng`);
      })
      .catch(() => { setAiOnline(false); setAiStatus("AI offline"); });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setResult(null);
    try {
      const res = await postJson<QuestionResponse>("/api/v1/questions", {
        actor_id:  actorId,
        course_id: actor.courseId,
        text:      question,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi câu hỏi.");
    } finally { setBusy(false); }
  }

  async function submitClarification(e: FormEvent) {
    e.preventDefault();
    if (!result) return;
    setBusy(true); setError("");
    try {
      const res = await postJson<QuestionResponse>(
        `/api/v1/questions/${result.question_id}/clarifications`,
        { text: clarification },
      );
      setResult(res); setClarification("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi bổ sung.");
    } finally { setBusy(false); }
  }

  async function refreshResult() {
    if (!result) return;
    setBusy(true);
    try { setResult(await api<QuestionResponse>(`/api/v1/questions/${result.question_id}`)); }
    catch (err) { setError(err instanceof Error ? err.message : "Không thể cập nhật."); }
    finally { setBusy(false); }
  }

  const step = getStep(busy, result);
  const rc   = result ? routeConfig(result.route) : null;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Hệ thống phán giải & Tham chiếu học vụ · Tự động hoá tức thì"
        title="Hỏi đáp quy chế học vụ"
        description="Câu hỏi thường quy được trả lời theo bằng chứng. Mọi yêu cầu ngoại lệ đều chuyển cho con người."
        actions={
          <div className="health-pill">
            <span className={`dot ${aiOnline ? "" : "offline"}`} />
            {aiStatus}
          </div>
        }
      />

      {/* Step tracker */}
      <StepTracker steps={STEPS} currentStep={step} />

      <div className="student-layout">
        {/* ── Left: Composer ── */}
        <section className="panel composer-panel">
          <div className="field-row">
            <label>
              Người gửi
              <select value={actorId} onChange={(e) => changeActor(e.target.value as DemoActorId)}>
                {Object.entries(demoActors).map(([id, item]) => (
                  <option key={id} value={id}>{item.label}</option>
                ))}
              </select>
            </label>
            <label>
              Môn học
              <select disabled value={actor.courseId}>
                <option>{actor.courseLabel}</option>
              </select>
            </label>
          </div>

          <form onSubmit={submit}>
            <label>
              Nội dung câu hỏi
              <textarea
                id="question-input"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={5}
                placeholder="Hỏi về quy định, rubric hoặc yêu cầu ngoại lệ…"
              />
            </label>
            <div className="example-row">
              {examples.map((ex) => (
                <button type="button" className="chip" key={ex} onClick={() => setQuestion(ex)}>
                  {ex.length > 44 ? `${ex.slice(0, 44)}…` : ex}
                </button>
              ))}
            </div>
            <button
              id="submit-question-btn"
              className="primary-button"
              disabled={busy || question.trim().length < 3}
            >
              {busy ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                    style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Đang xử lý…
                </>
              ) : (
                "Tra cứu quy chế →"
              )}
            </button>
          </form>

          {error && <div className="error-banner" role="alert">{error}</div>}
        </section>

        {/* ── Right: Result ── */}
        <section className={`panel result-panel ${result ? "has-result" : "empty-result"}`}>
          {!result && (
            <div className="empty-state">
              <div className="empty-orbit">?</div>
              <h2>Chưa có kết quả</h2>
              <p>Câu trả lời, route phân luồng và trích dẫn quy chế sẽ xuất hiện tại đây.</p>
            </div>
          )}

          {result && (
            <>
              {/* Route info banner */}
              {rc && (
                <div className={`route-info-banner ${rc.cls}`}>
                  <span className="rbi-icon">{rc.icon}</span>
                  <div className="rbi-body">
                    <div className="rbi-title">{rc.title}</div>
                    <div className="rbi-sub">{rc.sub}</div>
                  </div>
                  <RouteBadge value={result.route} />
                </div>
              )}

              {/* Answer */}
              {result.answer && (
                <p className="answer-text">{result.answer}</p>
              )}

              {/* Clarify callout */}
              {result.clarifying_question && (
                <div className="decision-callout clarify-callout">
                  <span className="callout-label">Cần bổ sung một thông tin</span>
                  <h2>{result.clarifying_question}</h2>
                  <form onSubmit={submitClarification}>
                    <input
                      value={clarification}
                      onChange={(e) => setClarification(e.target.value)}
                      placeholder="Nhập thêm thông tin…"
                    />
                    <button disabled={busy || !clarification.trim()}>Gửi bổ sung</button>
                  </form>
                </div>
              )}

              {/* Escalate callout */}
              {result.route === "ESCALATE" && !result.final_decision && (
                <div className="decision-callout escalate-callout">
                  <span className="callout-label">Cần giảng viên review</span>
                  <h2>Chuyển tiếp lên Giảng viên phụ trách</h2>
                  <p style={{ fontSize: 12, marginBottom: 12 }}>
                    Mã hồ sơ: <code>{result.case_id}</code>
                    &nbsp;·&nbsp;
                    <span style={{ color: "#92400e", fontWeight: 700 }}>{result.reason_code}</span>
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="secondary-button compact-button" onClick={refreshResult} disabled={busy}>
                      Làm mới quyết định
                    </button>
                  </div>
                </div>
              )}

              {/* Final decision */}
              {result.final_decision && (
                <div className="final-decision">
                  <RouteBadge value={result.final_decision} />
                  <div>
                    <strong>Đã nhận quyết định của giảng viên</strong>
                    <p>{result.final_decision_reason}</p>
                  </div>
                </div>
              )}

              {/* Citations */}
              <CitationList citations={result.citations} />

              <div className="result-meta">
                <span>{new Date(result.created_at).toLocaleString("vi-VN")}</span>
                <code className="mono">{result.question_id}</code>
              </div>
            </>
          )}
        </section>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
