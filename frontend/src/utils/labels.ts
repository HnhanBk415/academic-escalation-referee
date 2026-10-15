import type { DemoCatalog } from "../types";
import type { BadgeTone } from "../components/ui/Badge";

/**
 * Single source of truth for all user-facing labels and badge styles.
 * Ensures consistent, professional Vietnamese terminology across all screens.
 */

// ── 1. Routes (AI Routing) ──
export function routeLabel(route: string | null | undefined): string {
  if (!route) return "—";
  switch (route.toUpperCase()) {
    case "ANSWER":
      return "Đã trả lời";
    case "CLARIFY":
      return "Cần làm rõ";
    case "ESCALATE":
      return "Chuyển giảng viên";
    case "OUT_OF_SCOPE":
      return "Ngoài phạm vi";
    case "REJECT":
      return "Từ chối";
    default:
      return "Khác";
  }
}

export function routeTone(route: string | null | undefined): BadgeTone {
  if (!route) return "neutral";
  switch (route.toUpperCase()) {
    case "ANSWER":
      return "answer"; // Xanh lá
    case "CLARIFY":
      return "escalate"; // Vàng (cần làm rõ/chờ)
    case "ESCALATE":
      return "clarify"; // Xanh dương (chuyển GV)
    case "OUT_OF_SCOPE":
    case "REJECT":
      return "reject"; // Đỏ
    default:
      return "neutral";
  }
}

// ── 2. Student Case Status ──
export function studentCaseStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  switch (status.toLowerCase()) {
    case "auto_replied":
    case "answered":
      return "AI đã trả lời";
    case "pending_lecturer":
    case "under_review":
      return "Chờ giảng viên";
    case "approved":
    case "decided":
      return "Đã phê duyệt";
    case "rejected":
      return "Bị từ chối";
    case "out_of_scope":
      return "Ngoài phạm vi";
    case "clarify":
    case "need_info":
    case "need_more_info":
    case "waiting_for_student":
      return "Cần bổ sung";
    case "escalated":
      return "Đã chuyển tiếp";
    case "cancelled":
      return "Đã đóng";
    default:
      return "Đang xử lý";
  }
}

export function studentCaseStatusTone(status: string | null | undefined): BadgeTone {
  if (!status) return "neutral";
  switch (status.toLowerCase()) {
    case "auto_replied":
    case "answered":
    case "approved":
    case "decided":
      return "answer"; // Xanh lá
    case "pending_lecturer":
    case "under_review":
    case "clarify":
    case "need_info":
    case "need_more_info":
    case "waiting_for_student":
      return "escalate"; // Vàng (chờ duyệt/bổ sung)
    case "escalated":
    case "forwarded":
      return "clarify"; // Xanh dương (chuyển tiếp)
    case "rejected":
    case "out_of_scope":
    case "cancelled":
      return "reject"; // Đỏ
    default:
      return "neutral";
  }
}

// ── 3. Uncertainty Type ──
export function uncertaintyLabel(type: string | null | undefined): string {
  if (!type) return "Quy chuẩn";
  switch (type.toUpperCase()) {
    case "AUTHORITY_REQUIRED":
      return "Cần thẩm quyền GV";
    case "MISSING_FACT":
      return "Thiếu dữ kiện";
    case "OUT_OF_POLICY":
      return "Ngoài quy chế";
    case "CONFLICTING_EVIDENCE":
    case "CONFLICT":
      return "Xung đột quy định";
    case "SUSPICIOUS_INPUT":
    case "SUSPICIOUS":
      return "Nghi vấn";
    case "AI_UNAVAILABLE":
      return "AI gián đoạn";
    case "NONE":
      return "Quy chuẩn";
    default:
      return "Khác";
  }
}

export function uncertaintyTone(type: string | null | undefined): BadgeTone {
  if (!type) return "neutral";
  switch (type.toUpperCase()) {
    case "AUTHORITY_REQUIRED":
      return "clarify"; // Xanh dương
    case "MISSING_FACT":
      return "escalate"; // Vàng
    case "OUT_OF_POLICY":
      return "neutral";
    case "CONFLICTING_EVIDENCE":
    case "CONFLICT":
    case "SUSPICIOUS_INPUT":
    case "SUSPICIOUS":
    case "AI_UNAVAILABLE":
      return "reject"; // Đỏ
    default:
      return "neutral";
  }
}

// ── 4. Policy Topic ──
export function policyTopicLabel(topic: string | null | undefined): string {
  if (!topic) return "Chung";
  switch (topic.toUpperCase()) {
    case "GROUP_MEMBERSHIP":
      return "Thành viên nhóm";
    case "GRADING_RUBRIC":
      return "Rubric chấm điểm";
    case "SUBMISSION_DEADLINE":
      return "Hạn nộp bài";
    case "AI_USAGE":
    case "AI_USE":
      return "Sử dụng AI";
    case "GRADE_APPEAL":
      return "Phúc khảo điểm";
    case "COURSE_REGISTRATION":
      return "Đăng ký/Hủy môn";
    case "CAMPUS_LIFE":
    case "CAMPUS_SERVICES":
      return "Đời sống sinh viên";
    case "SECURITY":
      return "Bảo mật";
    case "GENERAL":
      return "Chung";
    case "AI_AVAILABILITY":
      return "Trạng thái AI";
    case "GROUP_CONTEXT":
      return "Ngữ cảnh nhóm";
    case "POLICY_VERSION":
      return "Phiên bản quy định";
    default:
      return "Khác";
  }
}

// ── 5. Audit Event Types ──
export function auditEventLabel(type: string | null | undefined): string {
  if (!type) return "—";
  switch (type.toUpperCase()) {
    case "QUESTION_SUBMITTED":
      return "Gửi câu hỏi";
    case "CONTEXT_RESOLVED":
      return "Xác định ngữ cảnh";
    case "CLARIFICATION_SUBMITTED":
    case "CLARIFICATION_RESPONSE_RECEIVED":
      return "Sinh viên bổ sung";
    case "CLARIFICATION_REQUESTED":
      return "Yêu cầu làm rõ";
    case "EVIDENCE_RETRIEVED":
      return "Truy xuất quy chế";
    case "REFEREE_DECIDED":
      return "AI phân luồng";
    case "EXCEPTION_APPLIED":
      return "Áp dụng ngoại lệ";
    case "ANSWER_RETURNED":
      return "Trả lời sinh viên";
    case "CASE_ESCALATED":
      return "Chuyển tiếp giảng viên";
    case "OUT_OF_SCOPE_RETURNED":
      return "Ngoài phạm vi";
    case "REQUEST_REJECTED":
      return "Từ chối yêu cầu";
    case "AI_FAILED":
      return "Lỗi xử lý AI";
    case "DECISION_RECORDED":
    case "CASE_DECIDED":
      return "Phê duyệt hồ sơ";
    case "STUDENT_NOTIFIED":
      return "Thông báo sinh viên";
    case "EXCEPTION_CREATED":
      return "Tạo ngoại lệ";
    case "EXCEPTION_REVOKED":
      return "Thu hồi ngoại lệ";
    case "CASE_CANCELLED":
      return "Đóng hồ sơ";
    case "POLICY_UPDATE_SAVED":
    case "POLICY_UPDATE_PUBLISHED":
      return "Lưu quy định";
    case "POLICY_CONFLICT_RESOLVED":
      return "Giải quyết xung đột";
    case "POLICY_DRAFT_DISCARDED":
      return "Hủy bản nháp";
    case "DOCUMENT_UPLOADED":
      return "Tải lên tài liệu";
    case "QUESTION_ROUTED":
      return "Phân luồng";
    case "DEMO_RESET":
      return "Khởi tạo dữ liệu";
    default:
      return "Khác";
  }
}

export function auditEventTone(type: string | null | undefined): BadgeTone {
  if (!type) return "neutral";
  switch (type.toUpperCase()) {
    case "ANSWER_RETURNED":
    case "DECISION_RECORDED":
    case "CASE_DECIDED":
    case "EXCEPTION_APPLIED":
      return "answer"; // Xanh lá
    case "QUESTION_SUBMITTED":
    case "CONTEXT_RESOLVED":
    case "EVIDENCE_RETRIEVED":
    case "REFEREE_DECIDED":
    case "QUESTION_ROUTED":
      return "info"; // Primary / blue
    case "CASE_ESCALATED":
    case "EXCEPTION_CREATED":
      return "clarify"; // Xanh dương
    case "CLARIFICATION_REQUESTED":
    case "CLARIFICATION_SUBMITTED":
    case "CLARIFICATION_RESPONSE_RECEIVED":
      return "escalate"; // Vàng
    case "REQUEST_REJECTED":
    case "OUT_OF_SCOPE_RETURNED":
    case "AI_FAILED":
    case "EXCEPTION_REVOKED":
    case "POLICY_DRAFT_DISCARDED":
    case "CASE_CANCELLED":
      return "reject"; // Đỏ
    default:
      return "neutral";
  }
}

// ── 6. Group Label ──
const KNOWN_GROUP_NAMES: Record<string, string> = {
  "group-a": "Nhóm 01",
  "group-b": "Nhóm 02",
  "group-dadn-a": "Nhóm DADN/01",
  "group-dadn-b": "Nhóm DADN/02",
};

export function groupLabel(
  groupId: string | null | undefined,
  catalog?: DemoCatalog | null
): string {
  if (!groupId) return "—";
  if (catalog?.courses) {
    for (const c of catalog.courses) {
      const found = c.groups.find((g) => g.id === groupId);
      if (found) return found.name.split(" - ")[0].trim();
    }
  }
  if (KNOWN_GROUP_NAMES[groupId]) {
    return KNOWN_GROUP_NAMES[groupId];
  }
  if (groupId.startsWith("group-")) {
    const suffix = groupId.replace("group-", "").toUpperCase();
    return `Nhóm ${suffix}`;
  }
  return groupId;
}

// ── 7. Decision Types ──
export function decisionTypeLabel(decision: string | null | undefined): string {
  if (!decision) return "—";
  switch (decision.toUpperCase()) {
    case "APPROVED":
      return "Phê duyệt";
    case "REJECTED":
      return "Từ chối";
    case "NEED_MORE_INFO":
      return "Cần thêm thông tin";
    case "FORWARDED":
      return "Chuyển tiếp";
    default:
      return "Khác";
  }
}

// ── 8. Exception Scope ──
export function exceptionScopeLabel(scope: string | null | undefined): string {
  if (!scope) return "—";
  switch (scope.toUpperCase()) {
    case "COURSE":
      return "Toàn môn";
    case "GROUP":
      return "Theo nhóm";
    case "STUDENT":
      return "Cá nhân";
    default:
      return "Khác";
  }
}
