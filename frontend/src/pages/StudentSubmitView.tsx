import React, { FormEvent, useState, useRef, useEffect } from "react";
import { api, getLastRequestId, postJson } from "../api/client";
import {
  Send,
  Check,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  Copy,
  Clock,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  BookOpen,
  Sparkles,
  Building2,
  UserCheck,
  HelpCircle,
  Layers,
  MessageSquare,
  FileCheck2,
  Flag,
  Users,
  CheckCircle2,
} from "lucide-react";
import { DEMO_ACCOUNTS } from "../components/AccountSwitcher";
import type { Citation, DemoCatalog, QuestionResponse } from "../types";

interface StudentSubmitViewProps {
  actorId?: string;
  catalog: DemoCatalog | null;
  selectedCourseId: string;
  selectedGroupId: string;
  onSelectCourse: (courseId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onSubmitted?: (questionId: string) => void;
  onViewHistory?: (questionId: string) => void;
}

export interface ClarificationTurnItem {
  round: number;
  questionText: string;
  clarifyingQuestion?: string | null;
  studentResponse?: string;
  route?: string;
}

interface QuickChip {
  label: string;
  prompt: string;
  category: "group_add" | "group_escalate" | "volunteer" | "rule" | "record" | "clinic";
}

const QUICK_CHIPS: QuickChip[] = [
  {
    label: "Thêm thành viên vào nhóm đồ án",
    prompt: "Em muốn thêm bạn student-b1 vào nhóm đồ án của em",
    category: "group_add",
  },
  {
    label: "Xin thêm thành viên khi nhóm đã có 5 bạn",
    prompt: "Nhóm em hiện tại đã có 5 bạn, em muốn xin thêm bạn thứ 6 vào nhóm đồ án",
    category: "group_escalate",
  },
  {
    label: "Đăng ký tham gia Mùa hè xanh (Đoàn - Hội)",
    prompt: "Em muốn đăng ký tham gia chiến dịch tình nguyện Mùa hè xanh năm nay",
    category: "volunteer",
  },
  {
    label: "Quy định số lượng thành viên nhóm",
    prompt: "Quy định số lượng thành viên tối đa trong một nhóm đồ án chuyên ngành?",
    category: "rule",
  },
  {
    label: "Tra cứu hồ sơ DEMO-AA-REQ-001",
    prompt: "Tra cứu tiến độ hồ sơ sinh viên DEMO-AA-REQ-001",
    category: "record",
  },
  {
    label: "Giờ tiếp nhận Trạm Y tế",
    prompt: "Cho em hỏi giờ tiếp nhận và làm việc của trạm y tế trường",
    category: "clinic",
  },
];

// Dữ liệu thành viên nhóm theo dữ liệu đồ án
const KNOWN_GROUP_ROSTERS: Record<string, { members: string[]; maxLimit: number }> = {
  "group-a": { members: ["student-a1 (Trưởng nhóm)"], maxLimit: 5 },
  "group-b": { members: ["student-b1 (Trưởng nhóm)"], maxLimit: 5 },
  "dadn-group-a": { members: ["student-dadn-a1 (Trưởng nhóm)", "demo-student-01"], maxLimit: 5 },
  "dadn-group-b": {
    members: [
      "student-dadn-b1 (Trưởng nhóm)",
      "demo-student-03",
      "demo-student-04",
      "demo-student-05",
      "demo-student-06",
    ],
    maxLimit: 5,
  },
};

export function StudentSubmitView({
  actorId,
  catalog,
  selectedCourseId,
  selectedGroupId,
  onSelectCourse,
  onSelectGroup,
  onSubmitted,
  onViewHistory,
}: StudentSubmitViewProps) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeStepIndex, setActiveStepIndex] = useState(0); // 0: Idle, 1: Intake, 2: Triage, 3: Validation, 4: Done/Action

  // Question response from backend
  const [result, setResult] = useState<QuestionResponse | null>(null);

  // Non-course catalog state (Trạm Y tế, Phòng Đào tạo, Mùa hè xanh...)
  const [catalogResult, setCatalogResult] = useState<{
    service: string;
    organization: string;
    title: string;
    detail: string;
    badge: string;
    badgeColor: string;
  } | null>(null);

  // Group membership flow state
  const [needsCourseClarification, setNeedsCourseClarification] = useState(false);
  const [isAddMemberIntent, setIsAddMemberIntent] = useState(false);
  const [memberRefInput, setMemberRefInput] = useState("student-b1");
  const [autoAddSuccess, setAutoAddSuccess] = useState<{
    courseCode: string;
    groupName: string;
    memberRef: string;
  } | null>(null);
  const [escalateToLecturer, setEscalateToLecturer] = useState<{
    courseCode: string;
    groupName: string;
    memberRef: string;
    reason: string;
  } | null>(null);

  // Standard clarification states
  const [clarificationText, setClarificationText] = useState("");
  const [clarifyingBusy, setClarifyingBusy] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [copiedRequestId, setCopiedRequestId] = useState(false);
  const [conversationTurns, setConversationTurns] = useState<ClarificationTurnItem[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [copiedQuote, setCopiedQuote] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  // Dropdown states for course/group
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  const selectedCourse = catalog?.courses.find((c) => c.id === selectedCourseId) || catalog?.courses[0];
  const availableGroups = selectedCourse?.groups ?? [];
  const selectedGroup =
    availableGroups.find((g) => g.id === selectedGroupId) || availableGroups[0];
  const effectiveGroupId = selectedGroup?.id || selectedGroupId || "";

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(e.target as Node)) {
        setIsCourseDropdownOpen(false);
      }
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target as Node)) {
        setIsGroupDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Helper: Nhận diện Mùa hè xanh & tình nguyện Đoàn - Hội
  const isVolunteerOrMhx = (text: string) => {
    const lowered = text.toLowerCase();
    return (
      lowered.includes("mùa hè xanh") ||
      lowered.includes("mua he xanh") ||
      lowered.includes("tình nguyện") ||
      lowered.includes("tinh nguyen") ||
      lowered.includes("tiếp sức mùa thi") ||
      lowered.includes("đoàn thanh niên") ||
      lowered.includes("hội sinh viên") ||
      lowered.includes("mhx")
    );
  };

  // Helper: Detect Course/Project related
  const isCourseRelated = (text: string): boolean => {
    const lowered = text.toLowerCase();
    return (
      lowered.includes("đồ án") ||
      lowered.includes("nhóm") ||
      lowered.includes("môn") ||
      lowered.includes("thành viên") ||
      lowered.includes("hủy môn") ||
      lowered.includes("rubric") ||
      lowered.includes("điểm") ||
      lowered.includes("co3001") ||
      lowered.includes("dadn") ||
      lowered.includes("quy chế") ||
      lowered.includes("ngoại lệ")
    );
  };

  // Helper: Detect non-course catalog
  const detectCatalogService = (text: string) => {
    const lowered = text.toLowerCase();

    // 1. Mùa Hè Xanh & Hoạt động phong trào -> Đoàn Thanh niên / Hội Sinh viên
    if (isVolunteerOrMhx(lowered)) {
      return {
        service: "youth_union",
        organization: "Văn phòng Đoàn Thanh niên - Hội Sinh viên (Đoàn Trường)",
        title: "Chuyển tiếp đến Ban Chỉ huy Chiến dịch Tình nguyện Mùa hè xanh",
        badge: "ĐOÀN HỘI · PHONG TRÀO",
        badgeColor: "bg-sky-100 text-sky-800 border-sky-300",
        detail:
          "🚩 Chiến dịch tình nguyện Mùa hè xanh là hoạt động phong trào trọng điểm do Đoàn Thanh niên - Hội Sinh viên trường tổ chức thường niên vào tháng 7 (không thuộc thẩm quyền học vụ đồ án).\n\n• Điều kiện tham gia: Sinh viên hoàn thành tốt nghĩa vụ học kỳ, điểm rèn luyện đạt loại Khá trở lên, đủ sức khỏe và cam kết tham gia trọn vẹn chiến dịch.\n• Kênh tiếp nhận chính thức: Cổng Thông tin Đoàn - Hội & Fanpage Tuổi trẻ Bách Khoa.\n• Hệ thống AER đã định tuyến yêu cầu của bạn đến: Ban Chỉ huy Chiến dịch Mùa hè xanh để gửi link đăng ký đợt tuyển quân mới nhất cho bạn!",
      };
    }

    // 2. Trạm Y tế
    if (lowered.includes("y tế") || lowered.includes("khám") || lowered.includes("sức khỏe") || lowered.includes("bác sĩ")) {
      return {
        service: "clinic",
        organization: "Trạm Y tế Trường",
        title: "Thông tin Tiếp nhận & Khám chữa bệnh tại Trạm Y tế",
        badge: "TRẠM Y TẾ",
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
        detail:
          "• Giờ làm việc: Thứ Hai đến Thứ Sáu, từ 07:30 - 16:30 (nghỉ trưa 11:30 - 13:00).\n• Địa điểm: Nhà A4, Cơ sở Dĩ An / Nhà D, Cơ sở Lý Thường Kiệt.\n• Dịch vụ: Sơ cấp cứu ban đầu, cấp phát thuốc thông thường, xác nhận giấy nghỉ ốm theo quy định.\n• Hotline khẩn cấp: (028) 3864 7256 - Ext: 5858.",
      };
    }

    // 3. Phòng Đào tạo
    if (lowered.includes("hồ sơ") || lowered.includes("bảng điểm") || lowered.includes("demo-aa-req")) {
      return {
        service: "academic_affairs",
        organization: "Phòng Đào tạo (Học vụ)",
        title: "Tra cứu tiến độ hồ sơ học vụ sinh viên",
        badge: "PHÒNG ĐÀO TẠO",
        badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
        detail:
          "Hồ sơ mã DEMO-AA-REQ-001 (Yêu cầu cấp Bảng điểm chính thức) đã được Phòng Đào tạo tiếp nhận lúc 09:15 ngày hôm nay. Trạng thái hiện tại: Đang in & đóng dấu xác thực. Thời gian nhận dự kiến: Trong vòng 24 giờ làm việc.",
      };
    }

    return null;
  };

  // Tự động nhận diện sĩ số và thành viên nhóm từ dữ liệu nhóm hoặc ngữ cảnh câu hỏi
  const getActiveGroupRoster = () => {
    const isExceededQuery =
      query.includes("5 bạn") ||
      query.includes("5 người") ||
      query.includes("thứ 6") ||
      query.includes("6 bạn");

    if (isExceededQuery) {
      return {
        currentCount: 5,
        maxLimit: 5,
        members: [
          "student-dadn-b1 (Trưởng nhóm)",
          "demo-student-03",
          "demo-student-04",
          "demo-student-05",
          "demo-student-06",
        ],
        isExceeded: true,
      };
    }

    const roster = KNOWN_GROUP_ROSTERS[effectiveGroupId];
    if (roster) {
      return {
        currentCount: roster.members.length,
        maxLimit: roster.maxLimit,
        members: roster.members,
        isExceeded: roster.members.length >= roster.maxLimit,
      };
    }

    return {
      currentCount: 1,
      maxLimit: 5,
      members: ["User (Trưởng nhóm)"],
      isExceeded: false,
    };
  };

  // Reset chat
  const handleResetChat = () => {
    setQuery("");
    setResult(null);
    setCatalogResult(null);
    setNeedsCourseClarification(false);
    setAutoAddSuccess(null);
    setEscalateToLecturer(null);
    setError("");
    setActiveStepIndex(0);
    setConversationTurns([]);
  };

  // Submit query
  async function handleSubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setError("Vui lòng nhập nội dung câu hỏi hoặc yêu cầu học vụ.");
      return;
    }

    setResult(null);
    setCatalogResult(null);
    setAutoAddSuccess(null);
    setEscalateToLecturer(null);
    setError("");
    setFeedback(null);
    setSelectedCitation(null);

    const text = query.trim();

    // Start running steps: Step 1 (Intake)
    setActiveStepIndex(1);

    // Step 2: AI Triage & Catalog check
    setTimeout(() => {
      setActiveStepIndex(2);

      // Check Mùa hè xanh & Non-course services first
      const catalogMatch = detectCatalogService(text);
      if (catalogMatch) {
        setTimeout(() => {
          setActiveStepIndex(3);
          setTimeout(() => {
            setActiveStepIndex(4);
            setCatalogResult(catalogMatch);
          }, 350);
        }, 300);
        return;
      }

      // Check Course/Project related
      if (isCourseRelated(text)) {
        const isAddMember = text.toLowerCase().includes("thêm bạn") || text.toLowerCase().includes("thêm thành viên");
        setIsAddMemberIntent(isAddMember);

        setTimeout(() => {
          setActiveStepIndex(3); // Bước 3: Làm rõ môn & nhóm đồ án
          setNeedsCourseClarification(true);
        }, 300);
        return;
      }

      // Triage Desk fallback
      setTimeout(() => {
        setActiveStepIndex(3);
        setTimeout(() => {
          setActiveStepIndex(4);
          setCatalogResult({
            service: "triage_desk",
            organization: "Bộ phận Tiếp nhận & Hỗ trợ Sinh viên",
            title: "Chuyển tiếp yêu cầu đến Bộ phận Hỗ trợ",
            badge: "HỖ TRỢ SINH VIÊN",
            badgeColor: "bg-rose-100 text-ruby-800 border-rose-300",
            detail:
              "Yêu cầu của bạn chưa nằm trong danh mục tra cứu tự động. Hệ thống đã tạo phiếu tiếp nhận và chuyển tiếp thông tin đến Bộ phận Hỗ trợ Sinh viên. Chuyên viên phụ trách sẽ liên hệ hỗ trợ bạn trong vòng 24 giờ làm việc.",
          });
        }, 350);
      }, 300);
    }, 250);
  }

  // Khi người dùng bấm "Xác nhận môn học & Tiếp tục xử lý"
  async function handleConfirmCourseProceed() {
    if (!selectedCourseId) {
      setError("Vui lòng chọn môn học.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      // 1. Xử lý Thêm thành viên nhóm: Hệ thống tự hiểu sĩ số nhóm
      if (isAddMemberIntent) {
        setNeedsCourseClarification(false);
        const roster = getActiveGroupRoster();

        if (!roster.isExceeded) {
          // Nhóm chưa đạt sĩ số tối đa -> Tiếp nhận và cập nhật trực tiếp
          setAutoAddSuccess({
            courseCode: selectedCourse?.code || selectedCourseId,
            groupName: selectedGroup?.name || "Nhóm 01",
            memberRef: memberRefInput.trim() || "student-b1",
          });
          setActiveStepIndex(4);
        } else {
          // Nhóm đã đủ 5 bạn (vượt mức tối đa) -> Chuyển Giảng viên phê duyệt ngoại lệ
          setEscalateToLecturer({
            courseCode: selectedCourse?.code || selectedCourseId,
            groupName: selectedGroup?.name || "Nhóm 01",
            memberRef: memberRefInput.trim() || "student-b1",
            reason: "Nhóm hiện tại đã có 5 bạn (đạt sĩ số tối đa). Xin kết nạp thêm thành viên vượt định mức theo quy chế.",
          });
          setActiveStepIndex(4);
        }
        setBusy(false);
        return;
      }

      // 2. Câu hỏi quy chế môn học -> Gửi tới backend /api/v1/questions
      const res = await postJson<QuestionResponse>("/api/v1/questions", {
        actor_id: actorId || "student-a1",
        course_id: selectedCourseId,
        group_id: effectiveGroupId,
        text: query.trim(),
      });

      setCurrentRequestId(getLastRequestId());
      setResult(res);
      setNeedsCourseClarification(false);
      setActiveStepIndex(4);

      if (res.route === "CLARIFY") {
        setConversationTurns([
          {
            round: res.clarification_round || 0,
            questionText: query.trim(),
            clarifyingQuestion: res.clarifying_question,
            route: res.route,
          },
        ]);
      }

      if (onSubmitted && res.question_id) {
        onSubmitted(res.question_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xử lý yêu cầu. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  // Handle chip click
  const handleChipClick = (chip: QuickChip) => {
    setQuery(chip.prompt);
    setError("");
  };

  // Gửi làm rõ bổ sung (theo backend question clarification)
  async function handleSendClarification(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!result || !clarificationText.trim()) return;

    setClarifyingBusy(true);
    setError("");
    try {
      const res = await postJson<QuestionResponse>(
        `/api/v1/questions/${result.question_id}/clarifications`,
        {
          text: clarificationText.trim(),
          group_id: effectiveGroupId,
        }
      );
      setCurrentRequestId(getLastRequestId());
      setResult(res);
      setClarificationText("");
    } catch (err) {
      setCurrentRequestId(getLastRequestId());
      setError(err instanceof Error ? err.message : "Không thể gửi phản hồi bổ sung.");
    } finally {
      setClarifyingBusy(false);
    }
  }

  // Pipeline Stepper data (4 Circular Nodes)
  const isIdle = activeStepIndex === 0;
  const isStep1Done = activeStepIndex >= 1;
  const isStep2Done = activeStepIndex >= 2;
  const isStep3Done = activeStepIndex >= 3 && !needsCourseClarification;
  const isStep4Done = activeStepIndex >= 4;

  const steps = [
    {
      num: 1,
      title: "Gửi yêu cầu",
      desc: isIdle ? "Sẵn sàng tiếp nhận" : "Đã tiếp nhận yêu cầu",
      completed: isStep1Done,
      active: activeStepIndex === 1,
    },
    {
      num: 2,
      title: "Kiểm tra & Phân loại",
      desc: isStep2Done ? "Đối chiếu Service Catalog" : "AI phân loại",
      completed: isStep2Done,
      active: activeStepIndex === 2,
    },
    {
      num: 3,
      title: "Làm rõ / Thẩm định",
      desc: needsCourseClarification
        ? "Cần chọn môn & nhóm"
        : isStep3Done
        ? "Đủ điều kiện quy chế"
        : "Đối chiếu quy tắc",
      completed: isStep3Done,
      active: needsCourseClarification || activeStepIndex === 3,
      alert: needsCourseClarification,
    },
    {
      num: 4,
      title: "Phê duyệt / Thực thi",
      desc: autoAddSuccess
        ? "Đã cập nhật thành viên"
        : escalateToLecturer
        ? "Chờ Giảng viên duyệt"
        : isStep4Done
        ? "Hoàn tất giải quyết"
        : "Đơn vị giải quyết",
      completed: isStep4Done,
      active: isStep4Done,
      alert: Boolean(escalateToLecturer),
    },
  ];

  return (
    <div className="space-y-4">
      {/* 1. HEADER (BỎ CHỌN MÔN/NHÓM Ở ĐẦU TRANG) */}
      <section className="pt-1 pb-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h1 className="font-display text-xl sm:text-2xl text-stone-900 font-bold tracking-tight flex items-center gap-2">
              <span>Phân tích và Xử lý các yêu cầu học vụ</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-ruby-100 text-ruby-800 border border-rose-200">
                <Sparkles size={12} /> Service Catalog
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
              Tiếp nhận yêu cầu tự do, tự động đối soát điều khoản, tra cứu Service Catalog và điều phối xử lý theo thẩm quyền
            </p>
          </div>

          {/* Reset button when active */}
          {(result || catalogResult || needsCourseClarification || autoAddSuccess || escalateToLecturer) && (
            <button
              type="button"
              onClick={handleResetChat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-white text-ruby-800 hover:bg-rose-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw size={13} />
              <span>Đặt câu hỏi mới</span>
            </button>
          )}
        </div>
      </section>

      {/* 2. KHUNG CHAT TỰ DO VỚI GỢI Ý NHANH (GIỮ FORMAT ĐẸP NHƯ CŨ) */}
      <div data-tour="ask-input" className="bg-white p-4 sm:p-5 rounded-3xl shadow-soft-card border border-rose-100 relative">
        <form onSubmit={handleSubmit}>
          <div className="relative w-full rounded-2xl border border-rose-200/90 bg-white focus-within:border-ruby-600 focus-within:ring-3 focus-within:ring-ruby-100 transition-all p-3.5 pb-13">
            <textarea
              data-tour="ask-try"
              className="w-full bg-transparent text-stone-900 font-sans text-sm sm:text-base focus:outline-none resize-none placeholder:text-stone-400 leading-relaxed font-medium"
              placeholder="Nhập yêu cầu học vụ hoặc câu hỏi tự do, vd: Nhóm đồ án được tối đa bao nhiêu thành viên?, Giờ tiếp nhận Trạm Y tế, Đăng ký Mùa hè xanh..."
              rows={3}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              disabled={busy}
            />

            {/* Circular submit button at bottom-right */}
            <div className="absolute bottom-2.5 right-2.5 flex items-center justify-end">
              <button
                type="submit"
                disabled={busy || !query.trim()}
                title="Gửi yêu cầu"
                className="w-9 h-9 rounded-full bg-ruby-700 text-white flex items-center justify-center shadow-md hover:bg-ruby-800 hover:shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                {busy ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={15} className="ml-0.5" />
                )}
              </button>
            </div>
          </div>
        </form>

        {error && (
          <div className="mt-2.5 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800 flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div data-tour="ask-suggestions" className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1 flex items-center gap-1 select-none">
            <span>✨</span> GỢI Ý NHANH:
          </span>
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => handleChipClick(chip)}
              className="px-2.5 py-1 rounded-full border border-rose-200 bg-white text-stone-700 text-xs font-medium hover:border-ruby-400 hover:text-ruby-800 hover:bg-rose-50/50 transition-all cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. TIẾN TRÌNH XỬ LÝ LÀ HÌNH TRÒN, CHẠY TỪNG STEP THEO YÊU CẦU */}
      <div data-tour="ask-progress" className="bg-white p-5 rounded-3xl shadow-soft-card border border-rose-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-rose-100 gap-2">
          <h3 className="font-display text-sm sm:text-base text-stone-900 font-bold tracking-tight">
            Tiến trình phân tích & xử lý học vụ
          </h3>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              isIdle
                ? "bg-stone-100 text-stone-600"
                : needsCourseClarification
                ? "bg-amber-100 text-amber-900 border border-amber-300 animate-pulse"
                : autoAddSuccess
                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                : escalateToLecturer
                ? "bg-rose-100 text-rose-900 border border-rose-300"
                : catalogResult
                ? "bg-sky-100 text-sky-900 border border-sky-300"
                : "bg-stone-100 text-stone-800"
            }`}
          >
            {isIdle && "Sẵn sàng tiếp nhận"}
            {needsCourseClarification && "Cần làm rõ môn / nhóm đồ án"}
            {autoAddSuccess && "Đã cập nhật thành viên thành công"}
            {escalateToLecturer && "Cần Giảng viên phê duyệt ngoại lệ"}
            {catalogResult && "Đã điều phối đơn vị"}
            {!isIdle && !needsCourseClarification && !autoAddSuccess && !escalateToLecturer && !catalogResult && "Đang xử lý…"}
          </span>
        </div>

        {/* CIRCULAR STEPPER: CÁC NÚT HÌNH TRÒN CÓ THANH NỐI TIẾN TRÌNH */}
        <div className="relative mt-7 mb-3 px-4">
          {/* Horizontal Connecting Progress Line */}
          <div className="absolute top-5 left-10 right-10 h-0.5 bg-stone-200 -z-0">
            <div
              className="h-full bg-emerald-500 transition-all duration-700 ease-out"
              style={{
                width:
                  activeStepIndex === 0
                    ? "0%"
                    : activeStepIndex === 1
                    ? "25%"
                    : activeStepIndex === 2
                    ? "50%"
                    : activeStepIndex === 3
                    ? "75%"
                    : "100%",
              }}
            />
          </div>

          {/* 4 Circular Nodes */}
          <div className="relative z-10 grid grid-cols-4 gap-2">
            {steps.map((st) => {
              const isDone = st.completed;
              const isActive = st.active;
              const isAlert = st.alert;

              let circleCls = "bg-white border-2 border-stone-300 text-stone-400";
              if (isDone) {
                circleCls = "bg-emerald-600 border-2 border-emerald-600 text-white shadow-sm";
              } else if (isAlert) {
                circleCls = "bg-amber-500 border-2 border-amber-500 text-white shadow-sm ring-4 ring-amber-400/20 animate-pulse";
              } else if (isActive) {
                circleCls = "bg-ruby-700 border-2 border-ruby-700 text-white shadow-sm ring-4 ring-rose-300/40 animate-pulse";
              }

              return (
                <div key={st.num} className="flex flex-col items-center text-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${circleCls}`}
                  >
                    {isDone ? <Check size={18} strokeWidth={2.5} /> : st.num}
                  </div>
                  <p className="mt-2 text-xs font-bold text-stone-900 tracking-tight">{st.title}</p>
                  <p className="text-[11px] text-stone-500 leading-tight mt-0.5 max-w-[130px] hidden sm:block">
                    {st.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. DYNAMIC ACTION & RESULT CARD (DATA-TOUR="ASK-RESULT") */}
      <div data-tour="ask-result">
        {/* TRƯỜNG HỢP 1: LÀM RÕ HỌC PHẦN & NHÓM ĐỒ ÁN */}
        {needsCourseClarification && (
          <div className="bg-amber-50/90 border-2 border-amber-300 rounded-3xl p-5 shadow-sm space-y-4 animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Layers size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-950">
                  Xác nhận học phần & Nhóm đồ án
                </h3>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  Yêu cầu của bạn liên quan đến học phần đồ án. Vui lòng xác nhận môn học và nhóm để hệ thống đối chiếu đúng quy chế:
                </p>
              </div>
            </div>

            {/* 2 Dropdown Selectors chọn lại như cái cũ, có gắn data-tour */}
            <div className="p-4 bg-white rounded-2xl border border-amber-200 shadow-2xs space-y-3">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                Chọn môn học và nhóm đồ án cần thao tác:
              </span>

              <div className="flex flex-wrap items-center gap-3">
                {/* Course Dropdown */}
                <div className="relative" ref={courseDropdownRef} data-tour="ask-course">
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    Môn học / Học phần:
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCourseDropdownOpen((prev) => !prev)}
                    className="inline-flex items-center justify-between gap-2 bg-white px-3.5 py-2 rounded-xl border border-stone-300 shadow-2xs text-stone-800 hover:border-ruby-400 text-xs sm:text-sm font-semibold transition-all cursor-pointer min-w-[15rem]"
                  >
                    <span className="truncate">
                      {selectedCourse ? `${selectedCourse.id} - ${selectedCourse.name}` : "Chọn học phần"}
                    </span>
                    <ChevronDown size={15} className="text-stone-500 shrink-0" />
                  </button>

                  {isCourseDropdownOpen && catalog && (
                    <div className="absolute left-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-rose-100 py-1.5 z-50 animate-fade-in">
                      <div className="px-3 py-1 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                        Danh sách học phần đồ án
                      </div>
                      {catalog.courses.map((course) => (
                        <button
                          key={course.id}
                          type="button"
                          onClick={() => {
                            onSelectCourse(course.id);
                            setIsCourseDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm transition-colors flex items-center justify-between cursor-pointer hover:bg-rose-50 ${
                            course.id === selectedCourseId
                              ? "text-ruby-800 font-bold bg-rose-50/70"
                              : "text-stone-700"
                          }`}
                        >
                          <span className="truncate">{course.id} - {course.name}</span>
                          {course.id === selectedCourseId && (
                            <Check size={14} className="text-ruby-700 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Group Dropdown */}
                <div className="relative" ref={groupDropdownRef} data-tour="ask-group">
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    Nhóm trong học phần:
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsGroupDropdownOpen((prev) => !prev)}
                    disabled={availableGroups.length === 0}
                    className="inline-flex items-center justify-between gap-2 bg-white px-3.5 py-2 rounded-xl border border-stone-300 shadow-2xs text-stone-800 hover:border-ruby-400 text-xs sm:text-sm font-semibold transition-all cursor-pointer min-w-[12rem] disabled:opacity-50"
                  >
                    <span className="truncate">
                      {availableGroups.length === 0
                        ? "Chưa có nhóm"
                        : selectedGroup
                        ? selectedGroup.name
                        : "Chọn nhóm đồ án"}
                    </span>
                    <ChevronDown size={15} className="text-stone-500 shrink-0" />
                  </button>

                  {isGroupDropdownOpen && availableGroups.length > 0 && (
                    <div className="absolute left-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-rose-100 py-1.5 z-50 animate-fade-in">
                      <div className="px-3 py-1 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                        Nhóm đồ án
                      </div>
                      {availableGroups.map((grp) => (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => {
                            onSelectGroup(grp.id);
                            setIsGroupDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm transition-colors flex items-center justify-between cursor-pointer hover:bg-rose-50 ${
                            grp.id === effectiveGroupId
                              ? "text-ruby-800 font-bold bg-rose-50/70"
                              : "text-stone-700"
                          }`}
                        >
                          <span className="truncate">{grp.name}</span>
                          {grp.id === effectiveGroupId && (
                            <Check size={14} className="text-ruby-700 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tình huống Thêm thành viên: Hệ thống tự động nhận diện sĩ số nhóm */}
              {isAddMemberIntent && (() => {
                const roster = getActiveGroupRoster();
                return (
                  <div className="pt-3 border-t border-stone-100 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Mã sinh viên cần thêm vào nhóm:
                      </label>
                      <input
                        type="text"
                        value={memberRefInput}
                        onChange={(e) => setMemberRefInput(e.target.value)}
                        placeholder="Ví dụ: student-b1 hoặc demo-student-02"
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:border-ruby-600 bg-white"
                      />
                    </div>

                    <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-700">Trạng thái nhóm hiện tại:</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            roster.isExceeded
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                          }`}
                        >
                          {roster.currentCount} / {roster.maxLimit} thành viên
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-600 leading-relaxed">
                        <span className="font-medium text-stone-700">Thành viên hiện tại:</span>{" "}
                        {roster.members.join(", ")}
                      </div>

                      {roster.isExceeded ? (
                        <div className="text-[11px] text-amber-900 font-medium bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                          ⚠️ Nhóm hiện đã đạt sĩ số tối đa ({roster.maxLimit} bạn). Yêu cầu bổ sung thành viên sẽ được hệ thống chuyển tiếp đến Giảng viên xem xét phê duyệt ngoại lệ.
                        </div>
                      ) : (
                        <div className="text-[11px] text-emerald-900 font-medium bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                          ✓ Nhóm hiện có {roster.currentCount} bạn (chưa vượt trần {roster.maxLimit} bạn). Hệ thống sẽ xác thực và cập nhật thành viên trực tiếp vào danh sách nhóm.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleConfirmCourseProceed}
                disabled={busy}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-ruby-700 hover:bg-ruby-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang đối soát…</span>
                  </>
                ) : (
                  <>
                    <span>Xác nhận môn học & Tiếp tục xử lý</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TRƯỜNG HỢP 2: THÊM THÀNH VIÊN HỢP LỆ THÀNH CÔNG */}
        {autoAddSuccess && (
          <div className="bg-emerald-50/90 border-2 border-emerald-300 rounded-3xl p-5 shadow-sm space-y-4 animate-in fade-in">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-emerald-950">
                    Cập nhật danh sách nhóm thành công
                  </h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Căn cứ Quy chế học phần đồ án: Sĩ số nhóm hợp lệ (dưới 5 thành viên), hệ thống đã xác thực và ghi nhận thành viên mới vào danh sách nhóm thành công.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 uppercase">
                HỢP LỆ · ĐÃ CẬP NHẬT
              </span>
            </div>

            {/* Thông tin nhóm sau khi tự thêm */}
            <div className="p-4 rounded-2xl bg-white border border-emerald-200 space-y-2.5">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                Danh sách thành viên nhóm sau khi cập nhật:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                  <span className="font-semibold text-stone-800">1. User (Sinh viên)</span>
                  <span className="text-[10px] bg-stone-200 text-stone-700 px-2 py-0.5 rounded font-bold">Trưởng nhóm</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <span className="font-bold text-emerald-900 font-mono">2. {autoAddSuccess.memberRef}</span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-bold">Mới tiếp nhận</span>
                </div>
              </div>

              <div className="text-[11px] text-stone-500 pt-1 flex items-center gap-2">
                <span>Học phần: <strong>{autoAddSuccess.courseCode}</strong></span>
                <span>•</span>
                <span>Nhóm: <strong>{autoAddSuccess.groupName}</strong></span>
                <span>•</span>
                <span>Trạng thái hệ thống: <strong className="text-emerald-700 font-mono">verified: true</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* TRƯỜNG HỢP 3: VƯỢT ĐỊNH MỨC -> CHUYỂN GIẢNG VIÊN DUYỆT */}
        {escalateToLecturer && (
          <div className="bg-rose-50/90 border-2 border-rose-300 rounded-3xl p-5 shadow-sm space-y-4 animate-in fade-in">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    Yêu cầu vượt định mức quy chế (Chuyển Giảng viên phê duyệt ngoại lệ)
                  </h3>
                  <p className="text-xs text-rose-800 mt-0.5">
                    Quy chế quy định nhóm đồ án tối đa 5 sinh viên. Nhóm đã đạt sĩ số tối đa nên yêu cầu bổ sung thành viên đã được chuyển tiếp đến Giảng viên xem xét ngoại lệ.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300 uppercase">
                AWAITING_APPROVAL
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-rose-200 space-y-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-2 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">Học phần & Nhóm</span>
                  <span className="font-bold text-stone-900">{escalateToLecturer.courseCode} · {escalateToLecturer.groupName}</span>
                </div>
                <div className="p-2 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">Thành viên xin thêm</span>
                  <span className="font-bold text-rose-800 font-mono">{escalateToLecturer.memberRef}</span>
                </div>
                <div className="p-2 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">Giảng viên phụ trách</span>
                  <span className="font-bold text-stone-900">TS. Trần Minh Tuấn</span>
                </div>
              </div>
              <p className="text-stone-600 pt-1 leading-relaxed">
                <strong>Lý do phân luồng: </strong>{escalateToLecturer.reason}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-center gap-2">
              <UserCheck size={16} className="text-blue-700 shrink-0" />
              <span>Hồ sơ đã được gửi đến <strong>TS. Trần Minh Tuấn</strong>. Đổi sang tài khoản Giảng viên ở góc trên để phê duyệt.</span>
            </div>
          </div>
        )}

        {/* TRƯỜNG HỢP 4: KẾT QUẢ DỊCH VỤ CATALOG NGOÀI MÔN HỌC (MÙA HÈ XANH, TRẠM Y TẾ, PHÒNG ĐÀO TẠO) */}
        {catalogResult && (
          <div className="bg-white border border-rose-200 rounded-3xl p-5 shadow-soft-card space-y-4 animate-in fade-in">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-rose-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-ruby-100 text-ruby-800 flex items-center justify-center shrink-0">
                  {catalogResult.service === "youth_union" ? (
                    <Flag size={22} className="text-ruby-700" />
                  ) : (
                    <Building2 size={22} className="text-ruby-700" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">{catalogResult.title}</h3>
                  <p className="text-xs text-stone-500">Đơn vị phụ trách: <span className="font-semibold text-ruby-800">{catalogResult.organization}</span></p>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${catalogResult.badgeColor}`}>
                {catalogResult.badge}
              </span>
            </div>

            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 text-xs sm:text-sm text-stone-800 leading-relaxed whitespace-pre-line">
              {catalogResult.detail}
            </div>
          </div>
        )}

        {/* TRƯỜNG HỢP 5: KẾT QUẢ CÂU HỎI QUY CHẾ TỪ BACKEND (/api/v1/questions) */}
        {result && (
          <div className="space-y-4">
            {result.route === "ANSWER" && (
              <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-soft-card border border-rose-200 space-y-4 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <BookOpen size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-950">
                      Câu trả lời chính thức từ quy chế
                    </h3>
                    <p className="text-xs text-stone-500">
                      Học phần: {selectedCourse?.code || "CO3001"} · Căn cứ điều khoản văn bản học phần
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/30 border border-rose-100 text-xs sm:text-sm text-stone-800 leading-relaxed whitespace-pre-line font-normal">
                  {result.answer}
                </div>

                {/* Citations List */}
                {result.citations && result.citations.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-2">
                      Căn cứ điều khoản quy chế (Bấm để xem nguyên văn):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {result.citations.map((c, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedCitation(c)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-xs font-semibold text-ruby-800 shadow-2xs transition-all cursor-pointer"
                        >
                          <span className="font-mono text-xs font-bold text-ruby-700">[{c.label || `C${idx + 1}`}]</span>
                          <span className="truncate max-w-[12rem]">{c.document_title || "Điều khoản quy chế"}</span>
                          <ExternalLink size={12} className="text-stone-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {result.route === "CLARIFY" && (
              <div className="p-5 rounded-3xl bg-amber-50/80 border-2 border-amber-300 shadow-sm space-y-4 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-amber-950">
                      AI cần bạn làm rõ thêm thông tin
                    </h3>
                    <p className="text-xs text-amber-800 mt-0.5">
                      {result.clarifying_question || "Vui lòng cung cấp thêm thông tin để đối chiếu chính xác."}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-amber-200 space-y-3">
                  <input
                    type="text"
                    value={clarificationText}
                    onChange={(e) => setClarificationText(e.target.value)}
                    placeholder="Nhập câu trả lời hoặc thông tin bổ sung của bạn..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSendClarification}
                      disabled={clarifyingBusy || !clarificationText.trim()}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow cursor-pointer disabled:opacity-50"
                    >
                      {clarifyingBusy ? "Đang gửi…" : "Gửi thông tin bổ sung ➔"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {result.route === "ESCALATE" && (
              <div className="bg-white p-5 rounded-3xl border border-rose-200 shadow-soft-card space-y-3.5 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                    <ShieldAlert size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900">
                      Hồ sơ đã được chuyển tiếp đến Giảng viên phụ trách
                    </h3>
                    <p className="text-xs text-stone-600 mt-0.5">
                      Yêu cầu thuộc diện ngoại lệ quy chế hoặc vượt thẩm quyền tự động. Giảng viên phụ trách học phần sẽ xem xét.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-bold">Mã hồ sơ:</span>
                    <span className="font-mono font-bold text-ruby-800">#{result.question_id.slice(0, 8)}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-bold">Giảng viên thụ lý:</span>
                    <span className="font-bold text-stone-800">TS. Trần Minh Tuấn</span>
                  </div>
                </div>

                {onViewHistory && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => onViewHistory(result.question_id)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-ruby-800 hover:text-ruby-900 cursor-pointer"
                    >
                      <span>Xem tiến độ trong Lịch sử xử lý</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. FOOTER FEEDBACK BAR */}
      <div className="bg-white p-4 rounded-2xl shadow-soft-card border border-rose-100 flex items-center justify-between gap-3 text-xs text-stone-600">
        <div className="flex items-center gap-2">
          <span>Thông tin phản hồi có hữu ích với bạn không?</span>
          <button
            type="button"
            onClick={() => setFeedback("up")}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              feedback === "up"
                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : "hover:bg-stone-50 border-stone-200 text-stone-600"
            }`}
            title="Hữu ích"
          >
            <ThumbsUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => setFeedback("down")}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              feedback === "down"
                ? "bg-red-50 text-red-700 border-red-300"
                : "hover:bg-stone-50 border-stone-200 text-stone-600"
            }`}
            title="Chưa chính xác"
          >
            <ThumbsDown size={14} />
          </button>
        </div>
      </div>

      {/* Citation Detail Modal */}
      {selectedCitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-start justify-between pb-3.5 border-b border-rose-100 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-rose-100 text-ruby-800 px-2.5 py-0.5 rounded-full border border-rose-200">
                    [{selectedCitation.label || "C1"}]
                  </span>
                  <h3 className="font-bold text-base text-stone-900 leading-snug">
                    {selectedCitation.document_title}
                  </h3>
                </div>
                {selectedCitation.heading && (
                  <p className="text-xs text-stone-500 font-medium pl-0.5">
                    Mục / Điều khoản: <span className="text-stone-800 font-semibold">{selectedCitation.heading}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCitation(null);
                  setCopiedQuote(false);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors text-base font-bold shrink-0 cursor-pointer"
                title="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] uppercase tracking-wider font-bold text-stone-400 block">
                Nội dung trích xuất nguyên văn:
              </span>
              <div className="p-4 bg-rose-50/40 rounded-xl border border-rose-200/70 text-xs sm:text-sm text-stone-800 leading-relaxed whitespace-pre-line max-h-72 overflow-y-auto">
                {selectedCitation.quote}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-rose-100">
              <button
                type="button"
                onClick={() => {
                  if (selectedCitation?.quote) {
                    navigator.clipboard.writeText(selectedCitation.quote);
                    setCopiedQuote(true);
                    setTimeout(() => setCopiedQuote(false), 2000);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-rose-50 text-stone-600 hover:text-ruby-800 text-xs font-semibold transition-all cursor-pointer"
              >
                {copiedQuote ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Đã sao chép!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Sao chép điều khoản</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCitation(null);
                  setCopiedQuote(false);
                }}
                className="px-5 py-2 rounded-full bg-ruby-700 hover:bg-ruby-800 text-white font-semibold text-xs shadow-sm hover:shadow transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
