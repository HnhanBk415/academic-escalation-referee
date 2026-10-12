import {
  IconArrowUpRight,
  IconBookOpen,
  IconCheck,
  IconCheckCircle,
  IconChevronRight,
  IconClipboard,
  IconClock,
  IconHelp,
  IconMessageSquare,
  IconScale,
  IconShield,
  IconSparkle,
  IconTarget,
  IconTeacher,
  IconZap,
} from "../components/Icons";
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
    icon: IconZap,
    tag: "Tự động 100%",
    title: "Trả lời trực tiếp",
    detail: "Hệ thống trích xuất và trả lời ngay kèm căn cứ điều khoản cụ thể từ tài liệu học phần.",
    badgeTone: "bg-emerald-100 text-emerald-800 border-emerald-200",
    iconTone: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    borderHover: "hover:border-emerald-300",
  },
  {
    icon: IconHelp,
    tag: "Hội thoại bổ sung",
    title: "Cần làm rõ",
    detail: "AI tương tác hỏi thêm sinh viên khi câu hỏi còn thiếu dữ kiện (mã nhóm, thời hạn hoặc ngữ cảnh cụ thể).",
    badgeTone: "bg-amber-100 text-amber-800 border-amber-200",
    iconTone: "bg-amber-50 text-amber-700 border-amber-200/80",
    borderHover: "hover:border-amber-300",
  },
  {
    icon: IconTeacher,
    tag: "SLA 48 giờ",
    title: "Chuyển tiếp Giảng viên",
    detail: "Các yêu cầu ngoại lệ vượt thẩm quyền được lập hồ sơ thẩm định kèm bằng chứng gửi tới Giảng viên phụ trách.",
    badgeTone: "bg-indigo-100 text-indigo-800 border-indigo-200",
    iconTone: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
    borderHover: "hover:border-indigo-300",
  },
];

export function HomePage({
  role,
  catalog,
  selectedCourseId,
  aiOnline,
  onNavigate,
}: HomePageProps) {
  const course = catalog?.courses.find((item) => item.id === selectedCourseId);
  const isStudent = role === "student";
  const isOperations = role === "academic_affairs";
  const primaryAction = isStudent ? "submit" : isOperations ? "operations" : "inbox";
  const primaryLabel = isStudent ? "Bắt đầu gửi câu hỏi" : isOperations ? "Mở trung tâm vận hành" : "Mở hàng chờ thẩm định";

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[#F8FAFC]">
      {/* Sticky Header */}
      <header className="px-6 lg:px-10 py-4 border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#DC2626]">
            <span>Academic Escalation Referee</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-medium">Hướng dẫn sử dụng</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
            Bắt đầu đúng luồng học vụ
          </h1>
        </div>

        {/* Live Status Badge */}
        <div
          className={`hidden sm:inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border shadow-2xs transition-all ${aiOnline
              ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-800"
              : "border-amber-200/80 bg-amber-50/80 text-amber-900"
            }`}
        >
          <span className="relative flex h-2 w-2">
            {aiOnline && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${aiOnline ? "bg-emerald-500 shadow-xs" : "bg-amber-500"
                }`}
            />
          </span>
          <span className="tracking-tight font-semibold text-[11px]">
            {aiOnline ? "Hệ thống sẵn sàng" : "AI đang cần kiểm tra"}
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10 py-8 lg:py-10 space-y-8">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#111C35] to-[#1E293B] px-6 py-8 sm:px-9 sm:py-10 text-white shadow-xl shadow-slate-900/10 border border-slate-800">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-red-600/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 h-40 w-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl">
            {/* Role badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isStudent ? "bg-red-400" : isOperations ? "bg-sky-400" : "bg-amber-400"}`} />
              <span className="text-xs font-semibold text-slate-200">
                {isStudent ? "Dành cho sinh viên" : isOperations ? "Dành cho Phòng Đào tạo" : "Dành cho giảng viên"}
              </span>
            </div>

            <h2 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight text-white">
              {isStudent
                ? "Hỏi đúng quy chế, nhận đúng hướng xử lý."
                : isOperations
                  ? "Giám sát dòng chảy học vụ từ một điểm kiểm soát."
                  : "Xem nhanh hồ sơ cần thẩm định và ra quyết định có căn cứ."}
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
              {isStudent
                ? "Sinh viên hỏi về quy chế, bổ sung thông tin khi cần và theo dõi quyết định học vụ dựa trên tài liệu học phần."
                : isOperations
                  ? "Theo dõi toàn bộ luồng xử lý học vụ, phân công và kiểm soát tiến độ trên một giao diện tập trung."
                  : "Xem xét hồ sơ sinh viên, tra cứu quy chế và ra quyết định có căn cứ văn bản rõ ràng."}
            </p>

            <button
              type="button"
              onClick={() => onNavigate(primaryAction)}
              className="mt-6 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-900/30 transition-all hover:shadow-red-900/50 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              {primaryLabel}
            </button>
          </div>
        </section>

        {/* 3 Step Recommendation */}
        <section className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#DC2626]">Quy trình khuyến nghị</p>
            <h2 className="mt-1 text-xl font-black text-slate-900 tracking-tight">Hoàn thành trong 3 bước</h2>
          </div>

          {/* Step cards with connector */}
          <div className="relative grid gap-4 md:grid-cols-3">
            {/* Connector line on desktop */}
            <div className="hidden md:block absolute top-[1.125rem] left-[calc(33.3%+18px)] right-[calc(33.3%+18px)] h-px bg-slate-200 pointer-events-none" />

            {([
              {
                index: "01",
                title: "Chọn đúng học phần",
                detail: "Chọn môn và nhóm liên quan để hệ thống chỉ dùng đúng tài liệu và quy định áp dụng.",
                action: null,
              },
              {
                index: "02",
                title: "Nêu rõ tình huống",
                detail: "Ghi mốc thời gian, nhóm và yêu cầu cụ thể; tránh câu hỏi chung chung để có kết quả chính xác.",
                action: null,
              },
              {
                index: "03",
                title: "Theo dõi kết quả",
                detail: "Đọc trích dẫn quy chế, bổ sung thông tin khi được hỏi hoặc theo dõi case chuyển giảng viên.",
                action: isStudent ? { label: "Xem hồ sơ của tôi →", nav: "history" as Destination } : null,
              },
            ] as Array<{ index: string; title: string; detail: string; action: { label: string; nav: Destination } | null }>).map((step) => (
              <article
                key={step.index}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-red-200 hover:shadow-sm transition-all duration-200 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 font-mono text-sm font-black text-[#DC2626] border border-red-100">
                    {step.index}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">{step.title}</h3>
                </div>
                <p className="pl-12 text-xs leading-relaxed text-slate-500">{step.detail}</p>
                {step.action && (
                  <button
                    type="button"
                    onClick={() => onNavigate(step.action!.nav)}
                    className="pl-12 text-xs font-bold text-[#DC2626] hover:underline cursor-pointer text-left"
                  >
                    {step.action.label}
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* 2 Main Cards: Guidance & Action Checklist */}
        <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          {/* Left Card: 3 Routes */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 text-[#DC2626] flex items-center justify-center shrink-0 shadow-2xs">
                  <IconScale size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">AER sẽ xử lý câu hỏi như thế nào?</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Phân luồng tự động dựa trên quy chế và thẩm quyền</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {routeGuidance.map((item) => {
                  const RouteIcon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className={`p-4 rounded-xl border border-slate-200/80 bg-white ${item.borderHover} transition-all duration-200 shadow-2xs hover:shadow-xs`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${item.iconTone}`}>
                            <RouteIcon size={16} />
                          </div>
                          <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${item.badgeTone}`}>
                          {item.tag}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2.5 leading-relaxed pl-10.5">
                        {item.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Card: Checklist & Quick Actions */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <IconCheckCircle size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">Bạn cần làm gì?</h2>
                  <p className="text-xs text-slate-500 mt-0.5">3 nguyên tắc để nhận kết quả chính xác nhất</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100/90 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                    1
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Đọc kỹ trích dẫn quy chế</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Câu trả lời luôn kèm trích dẫn văn bản chính thức của trường và khoa để bạn đối chiếu.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70">
                  <div className="w-6 h-6 rounded-lg bg-blue-100/90 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                    2
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Bảo mật thông tin cá nhân</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Chỉ cung cấp tình huống học vụ cần thiết; không gửi mật khẩu, CCCD hay dữ liệu nhạy cảm.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70">
                  <div className="w-6 h-6 rounded-lg bg-amber-100/90 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                    3
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Theo dõi tiến độ thẩm định</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Khi yêu cầu ngoại lệ được gửi lên Giảng viên, bạn có thể theo dõi hạn SLA và trạng thái tại mục Hồ sơ.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Navigation Cards */}
            <div className="mt-6 pt-5 border-t border-slate-200/80 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onNavigate(primaryAction)}
                className="group p-3 rounded-xl border border-slate-200 bg-white hover:border-red-300 hover:shadow-xs transition-all flex items-center justify-between text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-[#DC2626] flex items-center justify-center shrink-0 group-hover:bg-[#DC2626] group-hover:text-white transition-colors">
                    <IconMessageSquare size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 group-hover:text-[#DC2626] transition-colors">{isStudent ? "Hỏi đáp quy chế" : isOperations ? "Trung tâm vận hành" : "Hàng chờ thẩm định"}</p>
                    <p className="text-[11px] text-slate-500">{isStudent ? "Gửi tình huống học vụ" : isOperations ? "Theo dõi hồ sơ và SLA" : "Xử lý hồ sơ cần quyết định"}</p>
                  </div>
                </div>
                <IconChevronRight size={15} className="text-slate-400 group-hover:text-[#DC2626] group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate(isStudent ? "history" : isOperations ? "audit" : "exceptions")}
                className="group p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-400 hover:shadow-xs transition-all flex items-center justify-between text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                    <IconClipboard size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 group-hover:text-slate-950 transition-colors">
                      {isStudent ? "Xem hồ sơ" : isOperations ? "Xem Audit Trail" : "Xem ngoại lệ"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {isStudent ? "Lịch sử & ngoại lệ" : isOperations ? "Nhật ký kiểm toán" : "Danh sách phê duyệt"}
                    </p>
                  </div>
                </div>
                <IconChevronRight size={15} className="text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
