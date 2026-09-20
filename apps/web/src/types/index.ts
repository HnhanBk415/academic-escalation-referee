export type Route = "ANSWER" | "CLARIFY" | "ESCALATE";

export interface Citation {
  label: string;
  chunk_id: string;
  document_title: string;
  page_number: number | null;
  heading: string | null;
  quote: string;
}

export interface QuestionResponse {
  question_id: string;
  status: string;
  route: Route;
  uncertainty_type: string;
  reason_code: string;
  answer: string | null;
  clarifying_question: string | null;
  case_id: string | null;
  final_decision: string | null;
  final_decision_reason: string | null;
  exception_id: string | null;
  citations: Citation[];
  created_at: string;
}

export interface CaseSummary {
  id: string;
  question_id: string;
  status: string;
  reason_code: string;
  uncertainty_type: string;
  decision_question: string;
  assigned_reviewer_id: string | null;
  created_at: string;
}

export interface CaseDetail extends CaseSummary {
  original_question: string;
  actor_id: string;
  group_id: string | null;
  course_id: string;
  ai_summary: string;
  citations: Citation[];
}

export interface PolicyException {
  id: string;
  course_id: string;
  scope_type: "STUDENT" | "GROUP" | "COURSE";
  scope_id: string;
  content: string;
  valid_from: string;
  valid_until: string;
  status: string;
  created_by: string;
  created_at: string;
  revoked_by: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
}

export interface AuditEvent {
  id: string;
  request_id: string | null;
  event_type: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  input_snapshot: Record<string, unknown>;
  output_snapshot: Record<string, unknown>;
  reason_code: string | null;
  evidence_ids: string[];
  model_name: string | null;
  prompt_version: string | null;
  duration_ms: number | null;
  created_at: string;
}
