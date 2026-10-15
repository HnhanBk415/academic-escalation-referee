import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Sparkles,
  HelpCircle,
  FileText,
  Users,
  Search,
  ShieldCheck,
} from "lucide-react";
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

export function HomePage({
  role,
  catalog,
  selectedCourseId,
  aiOnline,
  onNavigate,
}: HomePageProps) {
  const [selectedRoleTab, setSelectedRoleTab] = useState<"student" | "lecturer">(
    role === "lecturer" ? "lecturer" : "student"
  );

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="w-full overflow-x-hidden text-stone-800">
      {/* ─────────────────────────────────────────────────────────────
          HÌNH CHỮ NHẬT 1: HERO BANNER (NỀN HỒNG)
         ───────────────────────────────────────────────────────────── */}
      <section
        className="w-full bg-[#fff0f3] border-b border-rose-200/80 pt-10 pb-16 md:pt-14 md:pb-24 relative custom-radial-glow"
        data-purpose="hero-section"
        id="hero"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Headline and Call to Action */}
            <div className="lg:col-span-6 space-y-6">
              {/* Tag metadata */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-rose-200/80 text-ruby-800 text-xs font-bold tracking-wide uppercase shadow-xs">
                <img src="/logo.png" alt="AER Logo" className="w-4 h-4 object-contain rounded-full" />
                HỌC THUẬT • CÔNG NGHỆ AI • AER SYSTEM
              </div>

              {/* Main Title */}
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-display font-bold text-stone-900 leading-[1.12] tracking-tight">
                Academic Escalation Referee
              </h1>

              {/* Highlight Subtitle */}
              <p className="text-2xl sm:text-3xl font-bold text-ruby-800 leading-snug">
                Hệ thống AI tự động phân tích và thẩm định khiếu nại học thuật theo quy chế môn học
              </p>

              {/* Buttons Group */}
              <div className="pt-4 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onNavigate("submit")}
                  className="inline-flex items-center gap-2 px-7 py-3.5 text-base font-bold text-white bg-ruby-800 hover:bg-ruby-900 rounded-full shadow-ruby-glow transition-all transform hover:scale-105 cursor-pointer"
                >
                  <span>Gửi yêu cầu phân tích</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection("process")}
                  className="inline-flex items-center gap-2 text-stone-700 hover:text-ruby-800 font-semibold text-sm transition-colors border-b-2 border-transparent hover:border-ruby-800 py-1 cursor-pointer"
                >
                  <span>Xem quy trình hoạt động</span>
                  <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Right Column: Simulated AER Terminal Card */}
            <div className="lg:col-span-6 flex justify-center">
              <div
                className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-7 shadow-soft-card border border-rose-100 relative"
                data-purpose="terminal-card"
              >
                {/* Terminal Header */}
                <div className="flex items-center justify-between pb-4 border-b border-stone-100 text-xs font-semibold text-stone-600">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-rose-200 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-rose-300 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-rose-200 inline-block" />
                    <span className="ml-2 uppercase tracking-wider text-[11px] font-bold text-stone-600">
                      Hỏi đáp quy chế
                    </span>
                  </div>
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-rose-100 text-ruby-800 tracking-wide uppercase">
                    TỰ ĐỘNG THẨM ĐỊNH
                  </span>
                </div>

                {/* Simulated Question Card (No confidence % and no gauge icon as requested) */}
                <div className="mt-5 p-4 sm:p-5 bg-rose-50/70 rounded-2xl border border-rose-200/70">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-ruby-800 block mb-1">
                    CÂU HỎI MÔ PHỎNG:
                  </span>
                  <p className="text-xs sm:text-sm font-semibold text-stone-800 leading-snug">
                    Tỷ lệ điểm giữa kỳ, quá trình, báo cáo tổng kết và sản phẩm là bao nhiêu?
                  </p>
                </div>

                {/* Regulation & Rule Reasoning Block */}
                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-stone-700 uppercase tracking-wide">CĂN CỨ ĐIỀU KHOẢN:</span>
                  </div>
                  <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 text-xs leading-relaxed text-stone-700 flex items-start gap-2.5">
                    <div className="text-emerald-700 mt-0.5 shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <p className="text-xs sm:text-sm">
                      <span className="font-semibold text-stone-900">Phân tích quy chế:</span> Đánh giá đồ án gồm báo cáo kỹ thuật{" "}
                      <span className="font-bold text-ruby-800">30%</span>, sản phẩm{" "}
                      <span className="font-bold text-ruby-800">40%</span>, trình bày và trả lời câu hỏi{" "}
                      <span className="font-bold text-ruby-800">20%</span>, hợp tác và đóng góp trong nhóm{" "}
                      <span className="font-bold text-ruby-800">10%</span>.
                    </p>
                  </div>
                </div>

                {/* Terminal Footer */}
                <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                  <span>Học phần: CO3001 - Đồ án chuyên ngành</span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Đã đối soát điều khoản
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Core Value Pillars Card Grid */}
          <div
            className="mt-14 bg-white rounded-3xl p-8 shadow-soft-card border border-rose-100/90 grid grid-cols-1 md:grid-cols-3 gap-8"
            data-purpose="core-values"
          >
            {/* Pillar 1 */}
            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-stone-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-ruby-700" />
                HIỂU ĐÚNG
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed font-normal">
                Hệ thống phân tích yêu cầu của sinh viên, hiểu ngữ cảnh và đối chiếu với quy chế môn học để xác định hướng xử lý phù hợp.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="space-y-2 md:border-l md:border-stone-200/80 md:pl-8">
              <h3 className="text-base font-extrabold text-stone-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-ruby-700" />
                TỰ ĐỘNG KHI RÕ
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed font-normal">
                Hệ thống AI tự động chấp thuận hoặc từ chối các yêu cầu dựa trên điều kiện và quy định đã được xác định rõ ràng.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="space-y-2 md:border-l md:border-stone-200/80 md:pl-8">
              <h3 className="text-base font-extrabold text-stone-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-ruby-700" />
                CHUYỂN CẤP KHI CẦN
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed font-normal">
                Những yêu cầu chưa được quy định rõ hoặc cần xem xét thêm sẽ được chuyển đến giảng viên quyết định, kèm theo thông tin và căn cứ liên quan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          HÌNH CHỮ NHẬT 2: ĐỐI TƯỢNG SỬ DỤNG (NỀN TRẮNG)
         ───────────────────────────────────────────────────────────── */}
      <section
        className="w-full bg-white border-b border-rose-200/80 py-16 md:py-20"
        data-purpose="audience-roles-section"
        id="roles"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Title */}
          <div className="pb-10">
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-ruby-950 tracking-tight">
              Hệ thống AER dành cho ai?
            </h2>
            <p className="text-sm text-stone-600 mt-2">
              Thiết kế tối ưu cho cả người học và cán bộ giảng dạy trong quy trình xử lý học vụ
            </p>
          </div>

          {/* Bento Split Roles Selection */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Role Selection Column (Left) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-ruby-800 rounded-full inline-block" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-stone-900">
                    DÀNH CHO
                  </span>
                </div>
                <span className="text-xs text-stone-600 font-medium italic">
                  Chọn vai trò để xem chức năng
                </span>
              </div>

              {/* Role Tab: Student */}
              <button
                type="button"
                onClick={() => setSelectedRoleTab("student")}
                className={`w-full text-left p-5 rounded-2xl transition-all flex items-center gap-4 group cursor-pointer ${
                  selectedRoleTab === "student"
                    ? "bg-rose-50/50 border-2 border-ruby-700 shadow-md relative overflow-hidden"
                    : "bg-white border border-rose-100 shadow-sm hover:border-ruby-300 hover:shadow-md"
                }`}
              >
                {selectedRoleTab === "student" && (
                  <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-ruby-700" />
                )}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                    selectedRoleTab === "student"
                      ? "bg-ruby-100 text-ruby-800"
                      : "bg-rose-50 group-hover:bg-rose-100 text-ruby-800"
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M12 14l9-5-9-5-9 5 9 5z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-stone-900 group-hover:text-ruby-800 transition-colors">
                      Sinh viên
                    </h4>
                    {selectedRoleTab === "student" && (
                      <span className="text-[10px] bg-ruby-100 text-ruby-800 px-2 py-0.5 rounded-full font-bold">
                        Đang xem
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 font-medium mt-0.5">
                    Theo dõi, gửi đơn và tra cứu quy chế môn
                  </p>
                </div>
              </button>

              {/* Role Tab: Lecturer */}
              <button
                type="button"
                onClick={() => setSelectedRoleTab("lecturer")}
                className={`w-full text-left p-5 rounded-2xl transition-all flex items-center gap-4 group cursor-pointer ${
                  selectedRoleTab === "lecturer"
                    ? "bg-rose-50/50 border-2 border-ruby-700 shadow-md relative overflow-hidden"
                    : "bg-white border border-rose-100 shadow-sm hover:border-ruby-300 hover:shadow-md"
                }`}
              >
                {selectedRoleTab === "lecturer" && (
                  <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-ruby-700" />
                )}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                    selectedRoleTab === "lecturer"
                      ? "bg-ruby-100 text-ruby-800"
                      : "bg-rose-50 group-hover:bg-rose-100 text-ruby-800"
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-ruby-950">Giảng viên</h4>
                    {selectedRoleTab === "lecturer" && (
                      <span className="text-[10px] bg-ruby-100 text-ruby-800 px-2 py-0.5 rounded-full font-bold">
                        Đang xem
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 font-medium mt-0.5">
                    Thẩm định khiếu nại, phân quyền và duyệt ngoại lệ
                  </p>
                </div>
              </button>
            </div>

            {/* Capability Cards Column (Right) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-ruby-800 rounded-full inline-block" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-stone-900">
                    LÀM ĐƯỢC
                  </span>
                </div>
                <span className="text-xs bg-rose-100 text-ruby-800 px-2.5 py-0.5 rounded-full font-bold">
                  {selectedRoleTab === "student" ? "Dành cho Sinh viên" : "Dành cho Giảng viên"}
                </span>
              </div>

              {selectedRoleTab === "student" ? (
                <>
                  {/* Feature Card 1 */}
                  <div className="p-6 bg-rose-50/40 rounded-2xl border border-rose-100 shadow-soft-card flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-white text-ruby-800 shrink-0 flex items-center justify-center shadow-xs">
                      <Search size={22} />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-stone-900 mb-1">
                        Tra cứu & Hỏi đáp quy chế
                      </h4>
                      <p className="text-sm text-stone-600 leading-relaxed font-normal">
                        Tra cứu quy chế học vụ nhanh chóng với hệ thống AI, tìm ngay các quy định về môn học mà không cần đọc toàn bộ tài liệu.
                      </p>
                    </div>
                  </div>

                  {/* Feature Card 2 */}
                  <div className="p-6 bg-rose-50/40 rounded-2xl border border-rose-100 shadow-soft-card flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-white text-ruby-800 shrink-0 flex items-center justify-center shadow-xs">
                      <FileText size={22} />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-stone-900 mb-1">Đề nghị yêu cầu</h4>
                      <p className="text-sm text-stone-600 leading-relaxed font-normal">
                        Gửi yêu cầu học vụ, tự động xử lý theo quy chế hoặc chuyển giảng viên xem xét minh bạch và nhanh chóng.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Lecturer Feature Card 1 */}
                  <div className="p-6 bg-rose-50/40 rounded-2xl border border-rose-100 shadow-soft-card flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-white text-ruby-800 shrink-0 flex items-center justify-center shadow-xs">
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-stone-900 mb-1">
                        Thẩm định hồ sơ ngoại lệ
                      </h4>
                      <p className="text-sm text-stone-600 leading-relaxed font-normal">
                        Tiếp nhận các trường hợp vượt thẩm quyền tự động của AI, xem xét căn cứ pháp lý và đưa ra quyết định chuẩn xác.
                      </p>
                    </div>
                  </div>

                  {/* Lecturer Feature Card 2 */}
                  <div className="p-6 bg-rose-50/40 rounded-2xl border border-rose-100 shadow-soft-card flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-white text-ruby-800 shrink-0 flex items-center justify-center shadow-xs">
                      <FileText size={22} />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-stone-900 mb-1">
                        Quản lý quy chế & Rubric môn học
                      </h4>
                      <p className="text-sm text-stone-600 leading-relaxed font-normal">
                        Tải lên đề cương môn học, bảng phân bổ trọng số điểm để huấn luyện kiến thức thẩm định tự động cho AER System.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          HÌNH CHỮ NHẬT 3: QUY TRÌNH 4 BƯỚC (NỀN HỒNG)
         ───────────────────────────────────────────────────────────── */}
      <section
        className="w-full bg-[#fff0f3] border-b border-rose-200/80 py-16 md:py-24"
        data-purpose="process-flow-section"
        id="process"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="max-w-3xl mb-14">
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-stone-900 leading-tight">
              Quy trình tiếp nhận, thẩm định, giải quyết yêu cầu học vụ{" "}
              <span className="text-ruby-700">minh bạch và đúng quy định</span>
            </h2>
          </div>

          {/* 4-Column Bento Flow Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 01 */}
            <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-soft-card flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display text-4xl font-extrabold text-ruby-600">01</span>
                  <span className="w-4 h-4 rounded-full bg-rose-100" />
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-2">Sinh viên gửi yêu cầu</h3>
                <p className="text-xs text-stone-600 leading-relaxed font-normal">
                  Chọn học phần cụ thể, gửi tình huống và câu hỏi thắc mắc liên quan tới quy chế, hạn nộp, tỷ lệ điểm.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-stone-100">
                <div className="h-2 rounded-full bg-rose-100/80 w-3/4" />
              </div>
            </div>

            {/* Step 02 */}
            <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-soft-card flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display text-4xl font-extrabold text-ruby-600">02</span>
                  <span className="w-4 h-4 rounded-full bg-rose-100" />
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-2">
                  Hệ thống tiếp nhận và thẩm định
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed font-normal">
                  AI phân tích biểu mẫu, trích xuất mã môn, đối chiếu điều khoản và kiểm tra dữ kiện học phần.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-stone-100">
                <div className="h-2 rounded-full bg-rose-100/80 w-3/4" />
              </div>
            </div>

            {/* Step 03 (Branching Hub) */}
            <div className="bg-white rounded-3xl p-6 border border-rose-200/90 shadow-soft-card flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display text-4xl font-extrabold text-ruby-800">03</span>
                  <span className="w-4 h-4 rounded-full bg-ruby-200" />
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-1">Phân luồng xử lý</h3>
                <p className="text-xs text-stone-600 mb-4">Hệ thống AI xác định hướng xử lý phù hợp</p>

                {/* Nested Sub-cards */}
                <div className="space-y-2.5">
                  {/* Case: Approved */}
                  <div className="p-3 bg-rose-50/40 rounded-xl border-l-4 border-emerald-500 shadow-xs">
                    <span className="text-[10px] font-extrabold tracking-wide uppercase text-emerald-800 block">
                      ĐỦ CĂN CỨ THEO QUY CHẾ
                    </span>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      AI đưa ra kết luận theo chính sách môn học kèm điều khoản trích dẫn.
                    </p>
                  </div>

                  {/* Case: Pending Data */}
                  <div className="p-3 bg-rose-50/40 rounded-xl border-l-4 border-amber-500 shadow-xs">
                    <span className="text-[10px] font-extrabold tracking-wide uppercase text-amber-800 block">
                      THIẾU THÔNG TIN HOẶC CHƯA RÕ
                    </span>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Yêu cầu sinh viên bổ sung, làm rõ thông tin trong tối đa 2 lượt tương tác.
                    </p>
                  </div>

                  {/* Case: Escalate to Teacher */}
                  <div className="p-3 bg-rose-50/40 rounded-xl border-l-4 border-ruby-600 shadow-xs">
                    <span className="text-[10px] font-extrabold tracking-wide uppercase text-ruby-800 block">
                      NGOÀI PHẠM VI HOẶC NGOẠI LỆ
                    </span>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Chuyển Giảng viên xem xét và đưa ra quyết định cuối cùng kèm SLA 48h.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-rose-200/50">
                <span className="text-[10px] font-bold text-ruby-800 uppercase tracking-wider">
                  Xử lý đa luồng thông minh
                </span>
              </div>
            </div>

            {/* Step 04 */}
            <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-soft-card flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display text-4xl font-extrabold text-ruby-600">04</span>
                  <span className="w-4 h-4 rounded-full bg-rose-100" />
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-2">Thông báo và theo dõi kết quả</h3>
                <p className="text-xs text-stone-600 leading-relaxed font-normal">
                  Sinh viên và giảng viên nhận thông báo kết quả kèm biên bản giải trình, lưu trữ lịch sử minh bạch và bất biến.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-stone-100">
                <div className="h-2 rounded-full bg-rose-100/80 w-3/4" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          HÌNH CHỮ NHẬT 4: BẢNG SO SÁNH (NỀN TRẮNG)
         ───────────────────────────────────────────────────────────── */}
      <section
        className="w-full bg-white border-b border-rose-200/80 py-16 md:py-20"
        data-purpose="comparison-section"
        id="comparison"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Title */}
          <div className="max-w-3xl mb-12">
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-ruby-950 tracking-tight leading-tight">
              So sánh quy trình thủ công và quy trình thông minh với AER System
            </h2>
          </div>

          {/* Comparison Bento Table */}
          <div className="overflow-hidden rounded-3xl border border-rose-200/80 bg-white shadow-soft-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" id="comparison-table">
                <thead>
                  <tr className="bg-rose-100/70 border-b border-rose-200/60">
                    <th className="py-5 px-6 text-xs font-extrabold uppercase tracking-wider text-stone-700 w-1/4">
                      TIÊU CHÍ
                    </th>
                    <th className="py-5 px-6 text-xs font-extrabold uppercase tracking-wider text-stone-700 w-3/8">
                      QUY TRÌNH THỦ CÔNG
                    </th>
                    <th className="py-5 px-6 text-xs font-extrabold uppercase tracking-wider text-ruby-800 w-3/8">
                      HỆ THỐNG AER AI REFEREE
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100 text-sm">
                  {/* Row 1 */}
                  <tr className="hover:bg-rose-50/40 transition-colors">
                    <td className="py-6 px-6 font-bold text-stone-900 align-top">
                      Tiếp nhận và thẩm định
                    </td>
                    <td className="py-6 px-6 text-stone-600 align-top leading-relaxed font-normal">
                      Giảng viên phải tự đọc yêu cầu, kiểm tra thông tin và tra cứu quy chế liên quan.
                    </td>
                    <td className="py-6 px-6 text-ruby-900 font-medium align-top leading-relaxed bg-rose-50/20">
                      Hệ thống AI tự động phân tích yêu cầu, đối chiếu quy chế và kiểm tra thông tin cần thiết.
                    </td>
                  </tr>

                  {/* Row 2 */}
                  <tr className="hover:bg-rose-50/40 transition-colors">
                    <td className="py-6 px-6 font-bold text-stone-900 align-top">Xử lý yêu cầu</td>
                    <td className="py-6 px-6 text-stone-600 align-top leading-relaxed font-normal">
                      Giảng viên tự tra cứu, diễn giải quy định và xem xét từng trường hợp trước khi đưa ra kết quả.
                    </td>
                    <td className="py-6 px-6 text-ruby-900 font-medium align-top leading-relaxed bg-rose-50/20">
                      Hệ thống AI tự động áp dụng quy chế để xử lý các trường hợp đủ căn cứ hoặc yêu cầu chưa rõ sẽ được đề nghị bổ sung thông tin.
                    </td>
                  </tr>

                  {/* Row 3 */}
                  <tr className="hover:bg-rose-50/40 transition-colors">
                    <td className="py-6 px-6 font-bold text-stone-900 align-top">Vai trò con người</td>
                    <td className="py-6 px-6 text-stone-600 align-top leading-relaxed font-normal">
                      Giảng viên trực tiếp đảm nhiệm hầu hết các bước từ tiếp nhận, thẩm định đến giải quyết.
                    </td>
                    <td className="py-6 px-6 text-ruby-900 font-medium align-top leading-relaxed bg-rose-50/20">
                      Hệ thống AI đảm nhận các bước có thể tự động hóa, giảng viên tập trung xem xét trường hợp phức tạp, ngoại lệ và quyết định cần sự can thiệp của con người.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          HÌNH CHỮ NHẬT 5: CALL TO ACTION BANNER (NỀN HỒNG)
         ───────────────────────────────────────────────────────────── */}
      <section
        className="w-full bg-[#fff0f3] border-b border-rose-200/80 py-16 md:py-20"
        data-purpose="cta-banner-section"
        id="cta"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ruby-900 via-ruby-800 to-ruby-700 text-white p-8 sm:p-12 lg:p-16 shadow-2xl">
            {/* Background Ambient Accents */}
            <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-rose-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -top-20 w-80 h-80 rounded-full bg-ruby-950/40 blur-2xl pointer-events-none" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Headline and Description */}
              <div className="lg:col-span-7 space-y-4">
                <span className="inline-block px-3.5 py-1 rounded-full bg-white/15 text-white/95 text-xs font-bold tracking-wider uppercase border border-white/20">
                  SẴN SÀNG VỚI AER SYSTEM
                </span>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold leading-tight tracking-tight text-white">
                  Trải nghiệm quy trình tiếp nhận thông minh, xử lý minh bạch ngay hôm nay
                </h2>
              </div>

              {/* Action Buttons Column */}
              <div className="lg:col-span-5 flex flex-col sm:w-80 lg:w-full lg:max-w-xs lg:ml-auto">
                <button
                  type="button"
                  onClick={() => onNavigate("submit")}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white hover:bg-stone-50 text-ruby-800 font-bold text-sm shadow-md transition-all transform hover:scale-[1.02] cursor-pointer"
                >
                  <span className="text-xs">▷</span>
                  <span>Gửi yêu cầu thử nghiệm</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          HÌNH CHỮ NHẬT 6: FOOTER (NỀN TRẮNG)
         ───────────────────────────────────────────────────────────── */}
      <footer className="w-full bg-white border-t border-rose-100 py-12 text-sm text-stone-600" data-purpose="page-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Institutional Partner Logos Section */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-stone-100">
            <div className="space-y-1 text-center md:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Đơn vị hợp tác & Nghiên cứu phát triển
              </span>
              <p className="text-xs text-stone-500 font-medium">
                Hệ thống thẩm định học vụ AI phục vụ môi trường giáo dục đại học
              </p>
            </div>

            <div className="flex items-center flex-wrap justify-center gap-6 sm:gap-8">
              {/* Logo Trường ĐH Bách Khoa TP.HCM */}
              <div className="flex items-center gap-2 group" title="Trường Đại học Bách Khoa - ĐHQG-HCM">
                <img
                  src="/logo-bk.png"
                  alt="Đại học Bách Khoa TP.HCM"
                  className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
                />
                <span className="text-xs font-bold text-stone-700 tracking-tight">
                  HCMUT
                </span>
              </div>

              <div className="h-6 w-px bg-stone-200 hidden sm:block" />

              {/* Logo Trường ĐH Sư phạm Kỹ thuật TP.HCM */}
              <div className="flex items-center gap-2 group" title="Trường Đại học Sư phạm Kỹ thuật TP.HCM">
                <img
                  src="/logo-ute.png"
                  alt="Đại học Sư phạm Kỹ thuật TP.HCM"
                  className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
                />
                <span className="text-xs font-bold text-stone-700 tracking-tight">
                  HCM-UTE
                </span>
              </div>

              <div className="h-6 w-px bg-stone-200 hidden sm:block" />

              {/* Logo Tập đoàn VNG */}
              <div className="flex items-center group" title="Tập đoàn Công nghệ VNG">
                <img
                  src="/logo-vng.png"
                  alt="VNG Corporation"
                  className="h-7 w-auto object-contain transition-transform group-hover:scale-105"
                />
              </div>
            </div>
          </div>

          {/* Bottom Copyright & System Brand */}
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="AER System Logo" className="w-6 h-6 object-contain rounded-md" />
              <span className="font-display font-bold text-ruby-800">AER System</span>
              <span>· Academic Escalation Referee · Hệ thống AI Thẩm định Học vụ</span>
            </div>
            <div className="font-medium">
              Đại học Bách Khoa TP.HCM (HCMUT) · 2026
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
