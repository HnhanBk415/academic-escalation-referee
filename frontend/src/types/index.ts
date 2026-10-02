export type Route =
  | "ANSWER"
  | "CLARIFY"
  | "ESCALATE"
  | "OUT_OF_SCOPE"
  | "REJECT";

export interface AIHealth {
  mode: string;
  available: boolean;
  model: string;
  detail: string | null;
}

export interface Citation {
  label: string;
  chunk_id: string;
  document_id: string;
  document_title: string;
  page_number: number | null;
  heading: string | null;
  quote: string;
}

export interface DemoGroup {
  id: string;
  name: string;
}

export interface DemoCourse {
  id: string;
  code: string;
  name: string;
  semester: string;
  groups: DemoGroup[];
}

export interface DemoCatalog {
  lecturer: {
    id: string;
    display_name: string;
  };
  courses: DemoCourse[];
}

export interface QuestionResponse {
  question_id: string;
  status: string;
  route: Route;
  uncertainty_type: string;
  reason_code: string;
  policy_topic: string | null;
  escalation_target?: string | null;
  answer: string | null;
  clarifying_question: string | null;
  case_id: string | null;
  final_decision: string | null;
  final_decision_reason: string | null;
  exception_id: string | null;
  applied_exception_id?: string | null;
  parent_question_id?: string | null;
  clarification_round?: number;
  citations: Citation[];
  created_at: string;
  text?: string | null;
  course_id?: string | null;
  group_id?: string | null;
  actor_id?: string | null;
}

export interface CaseSummary {
  id: string;
  question_id: string;
  status: string;
  reason_code: string;
  uncertainty_type: string;
  escalation_target?: string | null;
  decision_question: string;
  assigned_reviewer_id: string | null;
  created_at: string;
  sla_due_at?: string | null;
  sla_overdue?: boolean;
}

export interface CaseDetail extends CaseSummary {
  original_question: string;
  actor_id: string;
  group_id: string | null;
  group_name: string | null;
  course_id: string;
  policy_topic: string | null;
  ai_summary: string;
  citations: Citation[];
}

export interface DecisionResponse {
  decision_id: string;
  case_id: string;
  status: string;
  decision: "APPROVED" | "REJECTED";
  exception_id: string | null;
}

export interface ExceptionCreatePayload {
  scope_type: "GROUP" | "STUDENT" | "COURSE";
  scope_id: string;
  course_id: string;
  policy_topic?: string | null;
  content: string;
  valid_from: string;
  valid_until: string;
}

export interface CaseDecisionCreate {
  reviewer_id: string;
  decision: "APPROVED" | "REJECTED";
  reason: string;
  create_exception?: boolean;
  exception?: ExceptionCreatePayload | null;
}

export interface PolicyException {
  id: string;
  course_id: string;
  scope_type: "STUDENT" | "GROUP" | "COURSE";
  scope_id: string;
  policy_topic: string;
  content: string;
  valid_from: string;
  valid_until: string;
  status: string;
  effective_status: "ACTIVE" | "UPCOMING" | "EXPIRED" | "REVOKED";
  is_effective: boolean;
  created_by: string;
  created_at: string;
  revoked_by: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
}

export interface GroupExceptionOverview {
  group_id: string;
  group_name: string;
  semester: string;
  exceptions: PolicyException[];
}

export interface CourseExceptionOverview {
  course_id: string;
  course_code: string;
  course_name: string;
  semester: string;
  course_exceptions: PolicyException[];
  groups: GroupExceptionOverview[];
  student_exceptions: PolicyException[];
}

export interface DashboardCounts {
  pending_questions: number;
  under_review_cases: number;
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
