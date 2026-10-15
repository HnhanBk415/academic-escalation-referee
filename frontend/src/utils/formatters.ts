/**
 * Localization and formatting utilities for academic workflows.
 * Converts technical enum codes and backend identifiers into polite, professional Vietnamese.
 */

export function formatEscalationReason(reasonCode: string | undefined | null): string {
  if (!reasonCode) {
    return "Cần Giảng viên phụ trách xem xét và quyết định";
  }

  const code = reasonCode.trim().toUpperCase();

  // No policy / out of policy matches
  if (code.startsWith("NO_POLICY") || code === "NO_POLICY_MATCH" || code === "OUT_OF_POLICY") {
    return "Chưa có quy định riêng trong tài liệu môn học, cần Giảng viên hướng dẫn cụ thể";
  }

  // Waiver / exception requests
  if (
    code === "AUTHORITY_EXCEPTION_REQUIRED" ||
    code === "STUDENT_REQUESTS_WAIVER" ||
    code === "REQUESTS_WAIVER" ||
    code === "REQUIRES_APPROVAL"
  ) {
    return "Yêu cầu ngoại lệ vượt thẩm quyền AI, cần Giảng viên phụ trách xem xét phê duyệt";
  }

  // Missing facts
  if (code === "MISSING_CONCRETE_FACT" || code === "MISSING_FACT") {
    return "Thiếu thông tin hoặc dữ kiện cụ thể từ sinh viên";
  }

  if (code === "MISSING_GROUP_CONTEXT") {
    return "Cần xác định nhóm sinh viên cụ thể để áp dụng chính sách môn học";
  }

  // Clarification exhaustion
  if (code === "CLARIFICATION_LIMIT_REACHED" || code === "UNRESOLVED") {
    return "Đã qua các lượt trao đổi tự động, chuyển Giảng viên phụ trách xử lý trực tiếp";
  }

  // Document conflicts
  if (code === "CONFLICTING_ACTIVE_DOCUMENTS" || code === "CONFLICTING") {
    return "Tài liệu học phần có nội dung chưa đồng nhất, chuyển Giảng viên xác nhận";
  }

  // System/AI fallback
  if (code === "AI_UNAVAILABLE") {
    return "Hệ thống AI đang bảo trì, chuyển Giảng viên phụ trách hỗ trợ trực tiếp";
  }

  // Security / Invalid
  if (code === "SUSPICIOUS_INPUT" || code === "SUSPICIOUS") {
    return "Nội dung câu hỏi không hợp lệ hoặc nằm ngoài quy chuẩn học vụ";
  }

  // Exceptions applied
  if (code === "APPLICABLE_SCOPED_EXCEPTION") {
    return "Đã đối chiếu và áp dụng ngoại lệ được phê duyệt trước đó";
  }

  if (code === "DIRECT_POLICY_MATCH" || code === "DIRECT" || code === "POLICY_GROUNDED_EXTRACTIVE_ANSWER") {
    return "Đối chiếu trực tiếp từ quy định chính thức của môn học";
  }

  if (code === "HUMAN_APPROVED") {
    return "Giảng viên đã phê duyệt chấp thuận";
  }

  if (code === "HUMAN_REJECTED") {
    return "Giảng viên đã từ chối yêu cầu";
  }

  // Human friendly fallback: remove snake_case
  return code
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

export function formatEscalationTarget(target: string | undefined | null): string {
  if (!target) return "Giảng viên phụ trách môn học";
  const t = target.trim().toUpperCase();
  switch (t) {
    case "COURSE_LECTURER":
      return "Giảng viên phụ trách môn học";
    case "ACADEMIC_AFFAIRS":
      return "Cấp có thẩm quyền";
    case "POLICY_VIOLATION":
      return "Hội đồng học vụ / Vi phạm quy chế";
    default:
      return "Giảng viên phụ trách";
  }
}

export function formatCaseStatus(status: string | undefined | null): {
  label: string;
  badgeClass: string;
  description: string;
} {
  switch (status?.toUpperCase()) {
    case "UNDER_REVIEW":
      return {
        label: "Đang chờ giảng viên duyệt",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
        description: "Hồ sơ đã được gửi đến giảng viên phụ trách và đang chờ phản hồi.",
      };
    case "DECIDED":
      return {
        label: "Đã có quyết định",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        description: "Giảng viên đã hoàn tất việc xem xét và đưa ra quyết định chính thức.",
      };
    case "WAITING_FOR_STUDENT":
      return {
        label: "Chờ sinh viên phản hồi",
        badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
        description: "Giảng viên yêu cầu sinh viên cung cấp thêm thông tin minh chứng.",
      };
    case "FORWARDED":
      return {
        label: "Đã chuyển tiếp cấp trên",
        badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
        description: "Hồ sơ đã được chuyển tiếp lên cấp có thẩm quyền giải quyết.",
      };
    case "CANCELLED":
      return {
        label: "Đã đóng hồ sơ",
        badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
        description: "Hồ sơ đã được đóng hoặc hủy bỏ.",
      };
    default:
      return {
        label: "Đang thụ lý",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
        description: "Hồ sơ đang trong quy trình xử lý học vụ.",
      };
  }
}

export function formatShortId(id: string | undefined | null, prefix = "#"): string {
  if (!id) return "";
  const cleaned = id.replace(/^(case_|q_|event_|doc_)/i, "");
  if (cleaned.length <= 10) return `${prefix}${cleaned}`;
  return `${prefix}${cleaned.slice(0, 8)}…`;
}
