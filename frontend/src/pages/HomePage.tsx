import React from "react";
import {
  Zap,
  HelpCircle,
  GraduationCap,
  Scale,
  CheckCircle2,
  MessageSquare,
  ClipboardList,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { Badge, Button, Card } from "../components/ui";
import type { DemoCatalog } from "../types";

type Role = "student" | "lecturer" | "academic_affairs";
type Destination = "submit" | "history" | "inbox" | "exceptions" | "operations" | "audit";

interface HomePageProps {
  role: Role;
  catalog: DemoCatalog | null;
  selectedCourseId: string;
  aiOnline: boolean;
  onNavigate: (destination: Destination) => void;
}

const routeGuidance = [
  {
    icon: Zap,
    tag: "Tự động",
    title: "Trả lời trực tiếp",
    detail: "Hệ thống trích xuất và giải đáp ngay kèm điều khoản cụ thể từ tài liệu học phần.",
    tone: "answer" as const,
  },
  {
    icon: HelpCircle,
    tag: "Hội thoại",
    title: "Cần làm rõ",
    detail: "AI tương tác hỏi thêm sinh viên khi câu hỏi còn thiếu dữ kiện (mã nhóm, thời hạn hoặc ngữ cảnh).",
    tone: "clarify" as const,
  },
  {
    icon: GraduationCap,
    tag: "SLA 48 giờ",
    title: "Chuyển tiếp Giảng viên",
    detail: "Yêu cầu ngoại lệ hoặc vượt thẩm quyền được lập hồ sơ thẩm định gửi tới Giảng viên phụ trách.",
    tone: "escalate" as const,
  },
];

export function HomePage({
  role,
  catalog,
  selectedCourseId,
  aiOnline,
  onNavigate,
}: HomePageProps) {
  const isStudent = role === "student";
  const isOperations = role === "academic_affairs";
  const primaryAction: Destination = isStudent ? "submit" : isOperations ? "operations" : "inbox";
  const primaryLabel = isStudent
    ? "Bắt đầu gửi câu hỏi"
    : isOperations
    ? "Mở trung tâm vận hành"
    : "Mở hàng chờ thẩm định";

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-normal text-[var(--on-surface)]">
            Hướng dẫn sử dụng học vụ
          </h1>
          <p className="text-[13px] text-[var(--on-surface-variant)] mt-0.5">
            Quy trình tra cứu quy chế, phân luồng tự động và thẩm định học vụ tại AER
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={aiOnline ? "answer" : "neutral"}>
            {aiOnline ? "Hệ thống sẵn sàng" : "AI đang kiểm tra"}
          </Badge>
        </div>
      </div>

      {/* Hero Section - Clean Flat Material Surface */}
      <Card className="p-6 sm:p-8 bg-[var(--surface)] border border-[var(--outline)]/30">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2">
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-[var(--primary-container)] text-[var(--primary)]">
              {isStudent
                ? "Dành cho sinh viên"
                : isOperations
                ? "Dành cho Phòng Đào tạo"
                : "Dành cho giảng viên"}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-normal text-[var(--on-surface)] leading-snug">
            {isStudent
              ? "Hỏi đúng quy chế, nhận đúng hướng xử lý."
              : isOperations
              ? "Giám sát dòng chảy học vụ từ một điểm kiểm soát."
              : "Xem nhanh hồ sơ cần thẩm định và ra quyết định có căn cứ."}
          </h2>

          <p className="text-sm text-[var(--on-surface-variant)] leading-relaxed">
            {isStudent
              ? "Sinh viên đặt câu hỏi về quy chế, bổ sung thông tin khi cần và theo dõi quyết định học vụ dựa trên tài liệu học phần."
              : isOperations
              ? "Theo dõi toàn bộ luồng xử lý học vụ, phân công và kiểm soát tiến độ trên một giao diện tập trung."
              : "Xem xét hồ sơ sinh viên, tra cứu quy chế và ra quyết định có căn cứ văn bản rõ ràng."}
          </p>

          <div className="pt-3">
            <Button
              variant="filled"
              size="md"
              onClick={() => onNavigate(primaryAction)}
              className="gap-2"
            >
              <span>{primaryLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* 3 Step Recommendation */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--on-surface)]">
          Quy trình thực hiện trong 3 bước
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              index: "1",
              title: "Chọn đúng học phần",
              detail:
                "Chọn môn học và nhóm lớp liên quan để hệ thống áp dụng đúng tài liệu và quy định.",
              action: null,
            },
            {
              index: "2",
              title: "Nêu rõ tình huống",
              detail:
                "Ghi mốc thời gian, nhóm và yêu cầu cụ thể; tránh câu hỏi mơ hồ để có kết quả chính xác.",
              action: null,
            },
            {
              index: "3",
              title: "Theo dõi kết quả",
              detail:
                "Đọc trích dẫn quy chế, bổ sung thông tin khi được yêu cầu hoặc theo dõi ca duyệt.",
              action: isStudent
                ? { label: "Xem hồ sơ của tôi", nav: "history" as Destination }
                : null,
            },
          ].map((item) => (
            <Card key={item.index} className="p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span className="w-6 h-6 rounded-full bg-[var(--surface-container-high)] text-[var(--primary)] text-xs font-semibold flex items-center justify-center">
                    {item.index}
                  </span>
                  <h3 className="text-sm font-medium text-[var(--on-surface)]">
                    {item.title}
                  </h3>
                </div>
                <p className="text-xs text-[var(--on-surface-variant)] leading-relaxed">
                  {item.detail}
                </p>
              </div>
              {item.action && (
                <div className="pt-3 mt-3 border-t border-[var(--outline)]/15">
                  <button
                    type="button"
                    onClick={() => onNavigate(item.action!.nav)}
                    className="text-xs font-medium text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    <span>{item.action.label}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* 2 Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Phân luồng */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-[var(--outline)]/20">
            <div className="w-9 h-9 rounded-full bg-[var(--primary-container)] text-[var(--primary)] flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--on-surface)]">
                Cơ chế phân luồng xử lý
              </h2>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Phân luồng tự động dựa trên quy chế và thẩm quyền
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {routeGuidance.map((item) => {
              const IconComp = item.icon;
              return (
                <div
                  key={item.title}
                  className="p-3.5 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] border border-[var(--outline)]/20 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconComp className="w-4 h-4 text-[var(--primary)]" />
                      <h3 className="text-xs font-semibold text-[var(--on-surface)]">
                        {item.title}
                      </h3>
                    </div>
                    <Badge tone={item.tone}>{item.tag}</Badge>
                  </div>
                  <p className="text-xs text-[var(--on-surface-variant)] leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right: Nguyên tắc tiếp nhận & Quick Actions */}
        <Card className="p-5 sm:p-6 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b border-[var(--outline)]/20">
              <div className="w-9 h-9 rounded-full bg-[#E8F5E9] text-[#146C2E] flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--on-surface)]">
                  Nguyên tắc tiếp nhận
                </h2>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  3 điều cần lưu ý để đạt kết quả chính xác
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] border border-[var(--outline)]/20 text-xs">
                <span className="font-semibold text-[var(--on-surface)] block mb-0.5">
                  1. Đọc kỹ trích dẫn quy chế
                </span>
                <p className="text-[var(--on-surface-variant)] leading-relaxed">
                  Câu trả lời luôn kèm trích dẫn văn bản chính thức của trường và khoa để đối chiếu.
                </p>
              </div>

              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] border border-[var(--outline)]/20 text-xs">
                <span className="font-semibold text-[var(--on-surface)] block mb-0.5">
                  2. Bảo mật thông tin cá nhân
                </span>
                <p className="text-[var(--on-surface-variant)] leading-relaxed">
                  Chỉ cung cấp tình huống học vụ cần thiết; không gửi mật khẩu, CCCD hay dữ liệu nhạy cảm.
                </p>
              </div>

              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] border border-[var(--outline)]/20 text-xs">
                <span className="font-semibold text-[var(--on-surface)] block mb-0.5">
                  3. Theo dõi tiến độ thẩm định
                </span>
                <p className="text-[var(--on-surface-variant)] leading-relaxed">
                  Khi yêu cầu ngoại lệ được gửi lên Giảng viên, bạn có thể theo dõi hạn SLA và trạng thái tại mục Hồ sơ.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-3 border-t border-[var(--outline)]/15 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onNavigate(primaryAction)}
              className="p-3 rounded-[var(--radius-md)] border border-[var(--outline)]/30 bg-[var(--surface-container-lowest)] hover:bg-[var(--surface-container-low)] transition-colors flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-[var(--primary)]" />
                <div>
                  <div className="text-xs font-semibold text-[var(--on-surface)]">
                    {isStudent
                      ? "Hỏi đáp quy chế"
                      : isOperations
                      ? "Trung tâm vận hành"
                      : "Hàng chờ thẩm định"}
                  </div>
                  <div className="text-[11px] text-[var(--on-surface-variant)]">
                    {isStudent
                      ? "Gửi tình huống học vụ"
                      : isOperations
                      ? "Theo dõi hồ sơ & SLA"
                      : "Xử lý hồ sơ cần quyết định"}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--on-surface-variant)]" />
            </button>

            <button
              type="button"
              onClick={() =>
                onNavigate(isStudent ? "history" : isOperations ? "audit" : "exceptions")
              }
              className="p-3 rounded-[var(--radius-md)] border border-[var(--outline)]/30 bg-[var(--surface-container-lowest)] hover:bg-[var(--surface-container-low)] transition-colors flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2.5">
                <ClipboardList className="w-4 h-4 text-[var(--on-surface-variant)]" />
                <div>
                  <div className="text-xs font-semibold text-[var(--on-surface)]">
                    {isStudent
                      ? "Xem hồ sơ"
                      : isOperations
                      ? "Nhật ký kiểm toán"
                      : "Xem ngoại lệ"}
                  </div>
                  <div className="text-[11px] text-[var(--on-surface-variant)]">
                    {isStudent
                      ? "Lịch sử & ngoại lệ"
                      : isOperations
                      ? "Truy vết hệ thống"
                      : "Danh sách phê duyệt"}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--on-surface-variant)]" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
