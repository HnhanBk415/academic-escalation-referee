import {
  IconBookOpen,
  IconCheck,
  IconClipboard,
  IconMessageSquare,
  IconScale,
  IconShield,
  IconSparkle,
  IconTeacher,
} from "../components/Icons";
import type { DemoCatalog } from "../types";

type Role = "student" | "lecturer" | "academic_affairs";
type Destination = "submit" | "history" | "format" | "inbox" | "exceptions" | "operations" | "audit";

interface HomePageProps {
  role: Role;
  catalog: DemoCatalog | null;
  selectedCourseId: string;
  aiOnline: boolean;
  onNavigate: (destination: Destination) => void;
}

const routeGuidance = [
  {
    title: "Trả lời ngay",
    detail: "Câu trả lời có căn cứ từ tài liệu học phần kèm trích dẫn.",
    tone: "bg-emerald-50 border-emerald-200 text-emerald-800",
  },
  {
    title: "Cần làm rõ",
    detail: "Hệ thống hỏi thêm khi thiếu thông tin như nhóm hoặc tình huống cụ thể.",
    tone: "bg-amber-50 border-amber-200 text-amber-900",
  },
  {
    title: "Chuyển giảng viên",
    detail: "Các yêu cầu ngoại lệ và vấn đề cần thẩm quyền sẽ được tạo hồ sơ thẩm định.",
    tone: "bg-blue-50 border-blue-200 text-blue-900",
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
      <header className="px-6 lg:px-10 py-5 border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#DC2626]">
            <span>Academic Escalation Referee</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">Hướng dẫn sử dụng</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Bắt đầu đúng luồng học vụ
          </h1>
        </div>
        <div
          className={`hidden sm:flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            aiOnline
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${aiOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
          {aiOnline ? "Hệ thống sẵn sàng" : "AI đang cần kiểm tra"}
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10 py-8 lg:py-10 space-y-7">
        <section className="relative overflow-hidden rounded-3xl bg-[#101827] px-6 py-8 sm:px-9 sm:py-10 text-white shadow-xl shadow-slate-900/10">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-red-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-40 w-80 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                <IconSparkle size={14} />
                {isStudent ? "Dành cho sinh viên" : isOperations ? "Dành cho Phòng Đào tạo" : "Dành cho giảng viên"}
              </div>
              <h2 className="mt-4 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
                {isStudent
                  ? "Hỏi đúng quy chế, nhận đúng hướng xử lý."
                  : isOperations
                    ? "Giám sát dòng chảy học vụ từ một điểm kiểm soát."
                    : "Xem nhanh hồ sơ cần thẩm định và ra quyết định có căn cứ."}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                AER tra cứu tài liệu theo học phần, cho biết khi nào có thể trả lời ngay,
                cần bổ sung thông tin hoặc cần chuyển tới giảng viên phụ trách.
              </p>
              <button
                type="button"
                onClick={() => onNavigate(primaryAction)}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#DC2626] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                {isStudent ? <IconMessageSquare size={17} /> : isOperations ? <IconShield size={17} /> : <IconTeacher size={17} />}
                {primaryLabel}
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ngữ cảnh hiện tại</p>
              <p className="mt-2 text-base font-bold text-white">
                {course ? `${course.code} · ${course.name}` : "Đang tải học phần..."}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {course
                  ? `Học kỳ ${course.semester} · ${course.groups.length} nhóm demo`
                  : "Chọn học phần ở các bước tiếp theo."}
              </p>
              <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-xs text-slate-300">
                <IconShield size={15} className="text-red-300" />
                Không thay thế quyết định của giảng viên.
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#DC2626]">Quy trình khuyến nghị</p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-900">Hoàn thành trong 3 bước</h2>
            </div>
            {isStudent && (
              <button
                type="button"
                onClick={() => onNavigate("history")}
                className="text-xs font-semibold text-slate-600 underline-offset-4 hover:text-[#B91C1C] hover:underline"
              >
                Xem hồ sơ của tôi
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              ["01", "Chọn đúng học phần", "Chọn môn và nhóm liên quan để hệ thống chỉ dùng đúng tài liệu và quy định áp dụng."],
              ["02", "Nêu rõ tình huống", "Ghi mốc thời gian, nhóm và yêu cầu cụ thể; tránh các câu hỏi chung chung."],
              ["03", "Theo dõi kết quả", "Đọc trích dẫn, bổ sung thông tin khi được hỏi hoặc theo dõi case chuyển giảng viên."],
            ].map(([index, title, detail]) => (
              <article key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 font-mono text-xs font-extrabold text-[#C81E1E]">
                  {index}
                </span>
                <h3 className="mt-4 text-sm font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_0.95fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <IconScale size={19} className="text-[#C81E1E]" />
              <h2 className="text-base font-extrabold text-slate-900">AER sẽ xử lý câu hỏi như thế nào?</h2>
            </div>
            <div className="mt-4 space-y-3">
              {routeGuidance.map((item) => (
                <div key={item.title} className={`rounded-xl border p-3.5 ${item.tone}`}>
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 opacity-80">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <IconCheck size={19} className="text-emerald-600" />
              <h2 className="text-base font-extrabold text-slate-900">Bạn cần làm gì?</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li className="flex gap-3"><span className="mt-1 text-emerald-600">✓</span><span>Đọc câu trả lời cùng phần trích dẫn tài liệu.</span></li>
              <li className="flex gap-3"><span className="mt-1 text-emerald-600">✓</span><span>Chỉ cung cấp thông tin học vụ cần thiết, không gửi mật khẩu hay dữ liệu nhạy cảm.</span></li>
              <li className="flex gap-3"><span className="mt-1 text-emerald-600">✓</span><span>Với ngoại lệ, ghi rõ lý do và theo dõi hồ sơ thẩm định.</span></li>
            </ul>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <button type="button" onClick={() => onNavigate("format")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:border-[#DC2626] hover:text-[#B91C1C]">
                <IconBookOpen size={16} /> Kiểm tra hình thức
              </button>
              <button type="button" onClick={() => onNavigate(isStudent ? "history" : isOperations ? "audit" : "exceptions")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:border-[#DC2626] hover:text-[#B91C1C]">
                <IconClipboard size={16} /> {isStudent ? "Xem hồ sơ" : isOperations ? "Xem Audit Trail" : "Xem ngoại lệ"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
