import { useState } from "react";
import type { FormatRuleType } from "../types";

export function RuleTypeBadge({
  ruleType,
  name,
  expectedValue,
}: {
  ruleType: FormatRuleType;
  name?: string;
  expectedValue?: Record<string, unknown>;
}) {
  const norm = (name || "").toLowerCase();
  if (
    expectedValue?.citation_style ||
    norm.includes("tham khảo") ||
    norm.includes("trích dẫn") ||
    expectedValue?.value === "Tài liệu tham khảo"
  ) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/90 shadow-2xs">
        📚 Trích dẫn &amp; TLTK
      </span>
    );
  }
  if (
    expectedValue?.kind === "cover_page" ||
    expectedValue?.kind === "cover_page_fields" ||
    norm.includes("trang bìa")
  ) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200/90 shadow-2xs">
        🎨 Trang bìa
      </span>
    );
  }
  if (expectedValue?.kind === "template_chapter") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200/90 shadow-2xs">
        📖 Chương (Cấp 1)
      </span>
    );
  }
  if (expectedValue?.kind === "template_section") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-50 text-violet-800 border border-violet-200/90 shadow-2xs">
        📌 Mục con (Cấp 2)
      </span>
    );
  }
  if (expectedValue?.kind === "template_sequence") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200/90 shadow-2xs">
        🔀 Thứ tự tuần tự
      </span>
    );
  }
  if (ruleType === "MEASUREMENT") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200/90 shadow-2xs">
        📏 Số đo
      </span>
    );
  }
  if (ruleType === "TEMPLATE") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200/90 shadow-2xs">
        📑 Khung đề mục
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200/90 shadow-2xs">
      👥 Bảng &amp; Hiện diện
    </span>
  );
}

export function getCriterionSummary(item: {
  name?: string;
  rule_type: FormatRuleType;
  expected_value: Record<string, unknown>;
}): string {
  const { rule_type, expected_value, name } = item;
  const norm = (name || "").toLowerCase();
  if (rule_type === "MEASUREMENT") {
    const prop = expected_value?.property as string;
    const val = expected_value?.value;
    if (prop === "page_count") {
      const minP = expected_value?.min_pages;
      const maxP = expected_value?.max_pages;
      if (minP && maxP) return `${minP} – ${maxP} trang`;
      if (maxP) return `Tối đa ${maxP} trang`;
      if (minP) return `Tối thiểu ${minP} trang`;
      const op = expected_value?.operator === "max" ? "Tối đa" : expected_value?.operator === "min" ? "Tối thiểu" : "Chính xác";
      return `${op} ${val} trang`;
    }
    if (prop === "margins_cm" && typeof val === "object" && val !== null) {
      const v = val as Record<string, number>;
      return `Lề: T${v.top ?? 2.5} · D${v.bottom ?? 2.5} · Tr${v.left ?? 3.0} · P${v.right ?? 2.0} cm`;
    }
    if (prop === "font_name" || expected_value?.font_name) {
      const f = expected_value?.font_name || val;
      const s = expected_value?.font_size_pt;
      const l = expected_value?.line_spacing;
      return `Phông ${f}${s ? ` ${s}pt` : ""}${l ? ` · giãn dòng ${l}` : ""}`;
    }
    if (prop === "font_size_pt") return `Cỡ chữ: ${val} pt`;
    if (prop === "line_spacing") return `Giãn dòng: ${val}`;
  }
  if (rule_type === "TEMPLATE") {
    if (expected_value?.requirement_text) {
      const text = String(expected_value.requirement_text).trim().replace(/\n+/g, " · ");
      return text.length > 70 ? text.slice(0, 67) + "..." : text;
    }
    if (expected_value?.kind === "template_outline") {
      const headings = (expected_value?.outline_headings as string[]) || [];
      if (headings.length > 0) return `${headings.length} mục theo khung đề cương`;
      return "Khung cấu trúc đề cương";
    }
    if (expected_value?.kind === "template_chapter") {
      const num = expected_value?.chapter_number;
      const sem = expected_value?.allow_semantic_equivalent ? "Tương đương ngữ nghĩa" : "Tên chính xác 100%";
      return `Chương ${num} · ${sem}`;
    }
    if (expected_value?.kind === "template_section") {
      const parent = expected_value?.parent_chapter as string;
      const sem = expected_value?.allow_semantic_equivalent ? "Tương đương ngữ nghĩa" : "Tên chính xác 100%";
      return `${parent || "Mục con"} · ${sem}`;
    }
    if (expected_value?.kind === "template_sequence") {
      const chaps = expected_value?.chapters as string[];
      return `Thứ tự tuần tự (${chaps?.length || 0} chương)`;
    }
    const count = Array.isArray(expected_value?.headings) ? expected_value.headings.length : 0;
    return count > 0 ? `${count} mục theo dàn ý mẫu` : "Khung cấu trúc đề cương";
  }
  if (rule_type === "PRESENCE") {
    if (expected_value?.kind === "cover_page" || expected_value?.kind === "cover_page_fields" || norm.includes("trang bìa")) {
      const req = expected_value?.required_fields as string[];
      return `Trang bìa (${req ? req.length : 5} trường thông tin)`;
    }
    if (
      expected_value?.citation_style ||
      norm.includes("tham khảo") ||
      norm.includes("trích dẫn") ||
      expected_value?.value === "Tài liệu tham khảo"
    ) {
      return `Chuẩn ${expected_value?.citation_style || "IEEE"} · Mục TLTK`;
    }
    if (expected_value?.kind === "table_columns") {
      const cols = Array.isArray(expected_value?.value) ? (expected_value.value as string[]).length : 0;
      return `Bảng phân công (${cols} cột bắt buộc)`;
    }
    if (expected_value?.requirement_text) {
      const text = String(expected_value.requirement_text).trim();
      return text.length > 70 ? text.slice(0, 67) + "..." : text;
    }
    return "Yêu cầu cấu trúc bắt buộc";
  }
  return "";
}

export function StructuredContentEditor({
  ruleType,
  expectedValue,
  name,
  onChange,
}: {
  ruleType: FormatRuleType;
  expectedValue: Record<string, unknown>;
  name: string;
  onChange: (val: Record<string, unknown>) => void;
}) {
  const [jsonMode, setJsonMode] = useState(false);
  const [templateTab, setTemplateTab] = useState<"text" | "tree">("text");
  const normalizedName = (name || "").toLowerCase();

  // Phân loại phân hệ cấu hình
  const isCoverPage =
    ruleType === "PRESENCE" &&
    (expectedValue?.kind === "cover_page" ||
      expectedValue?.kind === "cover_page_fields" ||
      normalizedName.includes("bìa"));
  const isGranularChapter = ruleType === "TEMPLATE" && expectedValue?.kind === "template_chapter";
  const isGranularSection = ruleType === "TEMPLATE" && expectedValue?.kind === "template_section";
  const isGranularSequence = ruleType === "TEMPLATE" && expectedValue?.kind === "template_sequence";

  const isTemplate = ruleType === "TEMPLATE" || expectedValue?.kind === "template_outline" || Array.isArray(expectedValue?.headings);
  const isReferences =
    ruleType === "PRESENCE" &&
    (Boolean(expectedValue?.citation_style) ||
      normalizedName.includes("tham khảo") ||
      normalizedName.includes("trích dẫn") ||
      expectedValue?.value === "Tài liệu tham khảo");
  const isTable =
    ruleType === "PRESENCE" &&
    (expectedValue?.kind === "table_columns" ||
      normalizedName.includes("bảng") ||
      normalizedName.includes("thành viên") ||
      normalizedName.includes("đóng góp"));
  const isPageCount =
    ruleType === "MEASUREMENT" &&
    (expectedValue?.property === "page_count" || normalizedName.includes("trang"));
  const isFont =
    ruleType === "MEASUREMENT" &&
    (expectedValue?.property === "font_name" ||
      Boolean(expectedValue?.font_name) ||
      Boolean(expectedValue?.font_size_pt) ||
      normalizedName.includes("phông") ||
      normalizedName.includes("font") ||
      normalizedName.includes("giãn dòng"));

  // Switcher tab cho MEASUREMENT và PRESENCE
  const [measurementSubKind, setMeasurementSubKind] = useState<"margin" | "font" | "page">(
    isPageCount ? "page" : isFont ? "font" : "margin"
  );
  const [presenceSubKind, setPresenceSubKind] = useState<"cover" | "reference" | "table">(
    isCoverPage ? "cover" : isTable ? "table" : "reference"
  );

  // Dữ liệu Margins
  const marginsObj = (typeof expectedValue?.value === "object" && expectedValue?.value !== null
    ? expectedValue.value
    : {}) as Record<string, number>;
  const top = marginsObj.top ?? 2.5;
  const bottom = marginsObj.bottom ?? 2.5;
  const left = marginsObj.left ?? 3.0;
  const right = marginsObj.right ?? 2.0;
  const currentMargins = { top, bottom, left, right };
  const tolerance = typeof expectedValue?.tolerance === "number" ? expectedValue.tolerance : 0.15;

  // Dữ liệu Page Count
  const pageOperator = (expectedValue?.operator as string) || "max";
  const pageVal = typeof expectedValue?.value === "number" ? expectedValue.value : 50;

  // Dữ liệu Font
  const fontName = (expectedValue?.font_name || (expectedValue?.property === "font_name" ? expectedValue?.value : "Times New Roman")) as string;
  const fontSize = Number(expectedValue?.font_size_pt || 13);
  const lineSpacing = Number(expectedValue?.line_spacing || 1.5);

  // Dữ liệu Template Headings & Requirement Text
  const rawReqText = (expectedValue?.requirement_text as string) || "";
  const headings = Array.isArray(expectedValue?.outline_headings)
    ? (expectedValue.outline_headings as string[])
    : Array.isArray(expectedValue?.headings)
    ? (expectedValue.headings as string[])
    : rawReqText ? rawReqText.split("\n").map((l) => l.trim()).filter(Boolean) : [];
  const allowSemantic = expectedValue?.allow_semantic_equivalent !== false;
  const allowExtra = expectedValue?.allow_extra !== false;
  const strictNames = expectedValue?.strict_names !== false;

  // Dữ liệu Table Columns
  const tableColumns = Array.isArray(expectedValue?.value)
    ? (expectedValue.value as string[])
    : ["STT", "Họ và tên", "Mã số sinh viên (MSSV)", "Nhiệm vụ đảm nhiệm", "Tỷ lệ đóng góp (%)", "Chữ ký xác nhận"];
  const [newColInput, setNewColInput] = useState("");

  // Dữ liệu Trích dẫn & Tài liệu tham khảo
  const citationStyle = (expectedValue?.citation_style as string) || "IEEE";
  const headingName = (expectedValue?.value as string) || "Tài liệu tham khảo";
  const minRefs = typeof expectedValue?.min_count === "number" ? expectedValue.min_count : 5;

  const citationPresets = [
    {
      id: "IEEE",
      name: "Chuẩn IEEE",
      badge: "ĐHBK & Kỹ thuật",
      desc: "Đánh số trong ngoặc vuông [1], [2] theo thứ tự xuất hiện.",
      inText: "Theo các phân tích gần đây về mô hình đối chiếu học thuật [1], [2], độ chính xác được nâng cao.",
      refSample: '[1] A. Nguyen and B. Tran, "Neural verification for academic papers," IEEE Trans. Software Eng., vol. 48, no. 2, pp. 110-124, 2024.',
    },
    {
      id: "APA",
      name: "Chuẩn APA (7th)",
      badge: "Khoa học & Quản trị",
      desc: "Trích dẫn Tác giả - Năm (Nguyễn & Trần, 2024). Danh mục sắp theo alphabet.",
      inText: "Theo các phân tích gần đây (Nguyễn & Trần, 2024), độ chính xác của hệ thống được nâng cao.",
      refSample: "Nguyen, A., & Tran, B. (2024). Neural verification for academic papers. IEEE Transactions on Software Engineering, 48(2), 110-124.",
    },
    {
      id: "Harvard",
      name: "Chuẩn Harvard",
      badge: "Quốc tế",
      desc: "Dạng Author (Year). Danh mục sắp xếp alphabet theo họ tác giả.",
      inText: "Như đã chứng minh bởi Nguyen & Tran (2024), mô hình đối chiếu tự động giúp tiết kiệm thời gian.",
      refSample: "Nguyen, A. & Tran, B. 2024, 'Neural verification for academic papers', IEEE Transactions on Software Engineering, vol. 48, no. 2, pp. 110-124.",
    },
    {
      id: "TCVN",
      name: "Chuẩn TCVN 7114 / BGD",
      badge: "Quy chuẩn Việt Nam",
      desc: "Đánh số [1], [2] sắp xếp danh mục theo thứ tự alphabet tác giả.",
      inText: "Theo kết quả nghiên cứu [1], các quy định về hình thức báo cáo đồ án cần được tự động hóa.",
      refSample: '[1] Nguyễn Văn A, Trần Thị B (2024), "Phương pháp thẩm định báo cáo đồ án", Tạp chí Phát triển KH&CN ĐHQG-HCM, tập 27, số 1, tr. 15-28.',
    },
  ];

  if (jsonMode) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <span>⚙️</span> Chế độ cấu hình JSON trực tiếp:
          </span>
          <button
            type="button"
            onClick={() => setJsonMode(false)}
            className="text-xs text-sky-700 font-semibold hover:underline cursor-pointer"
          >
            ← Quay lại giao diện trực quan
          </button>
        </div>
        <textarea
          rows={5}
          value={JSON.stringify(expectedValue, null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {}
          }}
          className="w-full bg-white border border-slate-300 rounded-lg p-3 font-mono text-xs text-slate-800 leading-relaxed focus:ring-2 focus:ring-slate-400 focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── 1. KHUNG ĐỀ MỤC TEMPLATE (VĂN BẢN MÔ TẢ TỰ NHIÊN / DÀN Ý CỦA GIẢNG VIÊN) ── */}
      {isTemplate ? (
        isGranularChapter ? (
          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2 border-b border-purple-100 pb-2">
              <div>
                <h4 className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                  <span>📖</span> Tiêu chí Chương bắt buộc (Cấp 1)
                </h4>
                <p className="text-[11px] text-purple-800/80 mt-0.5">
                  Kiểm tra sự hiện diện của Chương {String(expectedValue?.chapter_number || "")} theo đúng thứ tự và phân cấp
                </p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-200/80 text-purple-900">
                Chương {String(expectedValue?.chapter_number || "")}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Tên tiêu đề chuẩn của chương:
                </label>
                <input
                  type="text"
                  value={(expectedValue?.title as string) || ""}
                  onChange={(e) => onChange({ ...expectedValue, title: e.target.value })}
                  className="w-full bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Số thứ tự chương:
                </label>
                <input
                  type="number"
                  value={Number(expectedValue?.chapter_number) || 1}
                  onChange={(e) => onChange({ ...expectedValue, chapter_number: parseInt(e.target.value) || 1 })}
                  className="w-full bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
                />
              </div>
            </div>
            <div className="pt-2 border-t border-purple-200 flex flex-col gap-2 text-xs">
              <label className="flex items-center gap-2 text-purple-950 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={expectedValue?.allow_semantic_equivalent !== false}
                  onChange={(e) => onChange({ ...expectedValue, allow_semantic_equivalent: e.target.checked })}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span>
                  <b>Cho phép tên tương đương ngữ nghĩa:</b> Chấp nhận từ đồng nghĩa (ví dụ: &quot;Mở đầu&quot; ↔ &quot;Giới thiệu&quot;) nhưng vẫn kiểm soát nghiêm ngặt vị trí và phân cấp chương.
                </span>
              </label>
              <label className="flex items-center gap-2 text-purple-950 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={expectedValue?.allow_extra !== false}
                  onChange={(e) => onChange({ ...expectedValue, allow_extra: e.target.checked })}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span>Cho phép có thêm các mục con mở rộng bên trong chương này</span>
              </label>
            </div>
          </div>
        ) : isGranularSection ? (
          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2 border-b border-purple-100 pb-2">
              <div>
                <h4 className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                  <span>📌</span> Tiêu chí Mục con bắt buộc (Cấp 2)
                </h4>
                <p className="text-[11px] text-purple-800/80 mt-0.5">
                  Mục con trực thuộc {(expectedValue?.parent_chapter as string) || "Chương chính"}
                </p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-200/80 text-purple-900">
                Mục con Cấp 2
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Tên tiêu đề mục con:
                </label>
                <input
                  type="text"
                  value={(expectedValue?.title as string) || ""}
                  onChange={(e) => onChange({ ...expectedValue, title: e.target.value })}
                  className="w-full bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Thuộc chương:
                </label>
                <input
                  type="text"
                  value={(expectedValue?.parent_chapter as string) || ""}
                  onChange={(e) => onChange({ ...expectedValue, parent_chapter: e.target.value })}
                  className="w-full bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
                />
              </div>
            </div>
            <div className="pt-2 border-t border-purple-200 text-xs">
              <label className="flex items-center gap-2 text-purple-950 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={expectedValue?.allow_semantic_equivalent !== false}
                  onChange={(e) => onChange({ ...expectedValue, allow_semantic_equivalent: e.target.checked })}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span>
                  <b>Cho phép tên tương đương ngữ nghĩa:</b> Cho phép đặt tên linh hoạt nhưng phải đúng phân cấp mục con.
                </span>
              </label>
            </div>
          </div>
        ) : isGranularSequence ? (
          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-3.5">
            <div className="border-b border-purple-100 pb-2">
              <h4 className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                <span>🔀</span> Tiêu chí Thứ tự và phân cấp cấu trúc đề mục
              </h4>
              <p className="text-[11px] text-purple-800/80 mt-0.5">
                Xác thực trật tự xuất hiện của các chương trong báo cáo phải tăng dần tuần tự (không bị đảo lộn thứ tự)
              </p>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-700 block">Thứ tự các chương bắt buộc:</span>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(expectedValue?.chapters) ? (expectedValue.chapters as string[]) : []).map((chap, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-lg bg-white border border-purple-300 text-xs font-semibold text-purple-900 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-purple-700 text-white text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <span>{chap}</span>
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 italic pt-1">
              * Nếu sinh viên đảo lộn thứ tự (ví dụ: đưa Chương 2 lên trước Chương 1), hệ thống sẽ đánh FAIL tiêu chí này.
            </p>
          </div>
        ) : (
        <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                <span>📑</span> Khung cấu trúc đề cương &amp; Dàn ý báo cáo
              </h4>
              <p className="text-[11px] text-purple-800/80 mt-0.5">
                Được lưu dưới dạng văn bản tự nhiên để LLM đối chiếu toàn diện và linh hoạt theo từng môn học
              </p>
            </div>
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-purple-200 text-xs">
              <button
                type="button"
                onClick={() => setTemplateTab("text")}
                className={`px-2.5 py-1 rounded font-semibold transition-all cursor-pointer ${
                  templateTab === "text" ? "bg-purple-700 text-white shadow-2xs" : "text-purple-900 hover:bg-purple-50"
                }`}
              >
                📝 Văn bản đề cương
              </button>
              <button
                type="button"
                onClick={() => setTemplateTab("tree")}
                className={`px-2.5 py-1 rounded font-semibold transition-all cursor-pointer ${
                  templateTab === "tree" ? "bg-purple-700 text-white shadow-2xs" : "text-purple-900 hover:bg-purple-50"
                }`}
              >
                🌳 Danh sách đề mục ({headings.length})
              </button>
            </div>
          </div>

          {templateTab === "text" ? (
            <div className="space-y-2">
              <textarea
                rows={8}
                value={rawReqText || headings.join("\n")}
                onChange={(e) => {
                  const val = e.target.value;
                  const lines = val.split("\n").map((l) => l.trim()).filter(Boolean);
                  onChange({
                    ...expectedValue,
                    kind: "template_outline",
                    requirement_text: val,
                    outline_headings: lines,
                    allow_semantic_equivalent: allowSemantic,
                    allow_extra: allowExtra,
                  });
                }}
                className="w-full bg-white border border-purple-300 rounded-xl p-3 text-xs text-slate-900 font-sans leading-relaxed focus:ring-2 focus:ring-purple-400 focus:outline-none"
                placeholder="Dán hoặc mô tả khung cấu trúc các chương mục theo đề cương:&#10;Chương 1: Khái niệm (1. Mô tả đồ án, 2. Tại sao cần)&#10;Chương 2: Hiện thực (1. Thiết kế hệ thống, 2. Cài đặt và thử nghiệm)&#10;Chương 3: Đánh giá và Kết luận (1. Kết quả đạt được, 2. Hướng phát triển)"
              />
              <div className="bg-purple-100/60 rounded-lg p-2.5 text-[11px] text-purple-900 border border-purple-200">
                💡 <b>Nguyên lý hoạt động:</b> LLM sẽ đọc toàn bộ đoạn văn đề cương này và đối chiếu với toàn bộ đề mục trong bài nộp của sinh viên trong <b>1 lần gọi duy nhất</b>, nhận diện chính xác các đề mục tương đương ngữ nghĩa học thuật.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                {headings.map((heading, hIdx) => {
                  const isMainChapter =
                    heading.toLowerCase().startsWith("chương") ||
                    heading.toLowerCase().startsWith("trang bìa") ||
                    heading.toLowerCase().startsWith("mục lục") ||
                    heading.toLowerCase().startsWith("tài liệu tham khảo") ||
                    heading.toLowerCase().startsWith("bảng phân công");
                  return (
                    <div
                      key={hIdx}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                        isMainChapter
                          ? "bg-purple-100/70 border-purple-300/80 shadow-2xs"
                          : "bg-white border-purple-200 ml-4"
                      }`}
                    >
                      <span className="w-6 h-6 rounded-md bg-purple-200/80 text-purple-900 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                        {hIdx + 1}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                          isMainChapter ? "bg-purple-700 text-white" : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                      >
                        {isMainChapter ? "Chương / Phần lớn" : "↳ Tiểu mục"}
                      </span>
                      <input
                        value={heading}
                        onChange={(e) => {
                          const updated = [...headings];
                          updated[hIdx] = e.target.value;
                          onChange({
                            ...expectedValue,
                            kind: "template_outline",
                            outline_headings: updated,
                            requirement_text: updated.join("\n"),
                            allow_semantic_equivalent: allowSemantic,
                            allow_extra: allowExtra,
                          });
                        }}
                        className="flex-1 bg-transparent border-0 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-purple-400 rounded px-1.5 py-0.5"
                      />
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          disabled={hIdx === 0}
                          onClick={() => {
                            if (hIdx === 0) return;
                            const updated = [...headings];
                            const temp = updated[hIdx - 1];
                            updated[hIdx - 1] = updated[hIdx];
                            updated[hIdx] = temp;
                            onChange({
                              ...expectedValue,
                              kind: "template_outline",
                              outline_headings: updated,
                              requirement_text: updated.join("\n"),
                              allow_semantic_equivalent: allowSemantic,
                              allow_extra: allowExtra,
                            });
                          }}
                          className="w-5 h-5 rounded hover:bg-purple-200 text-purple-800 text-[11px] font-bold disabled:opacity-30 cursor-pointer flex items-center justify-center"
                          title="Di chuyển lên trên"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={hIdx === headings.length - 1}
                          onClick={() => {
                            if (hIdx === headings.length - 1) return;
                            const updated = [...headings];
                            const temp = updated[hIdx + 1];
                            updated[hIdx + 1] = updated[hIdx];
                            updated[hIdx] = temp;
                            onChange({
                              ...expectedValue,
                              kind: "template_outline",
                              outline_headings: updated,
                              requirement_text: updated.join("\n"),
                              allow_semantic_equivalent: allowSemantic,
                              allow_extra: allowExtra,
                            });
                          }}
                          className="w-5 h-5 rounded hover:bg-purple-200 text-purple-800 text-[11px] font-bold disabled:opacity-30 cursor-pointer flex items-center justify-center"
                          title="Di chuyển xuống dưới"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = headings.filter((_, i) => i !== hIdx);
                            onChange({
                              ...expectedValue,
                              kind: "template_outline",
                              outline_headings: updated,
                              requirement_text: updated.join("\n"),
                              allow_semantic_equivalent: allowSemantic,
                              allow_extra: allowExtra,
                            });
                          }}
                          className="w-5 h-5 rounded hover:bg-rose-100 text-rose-600 text-[11px] font-bold cursor-pointer flex items-center justify-center"
                          title="Xóa đề mục này"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-200">
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...headings, "Tiểu mục mới"];
                    onChange({
                      ...expectedValue,
                      kind: "template_outline",
                      outline_headings: updated,
                      requirement_text: updated.join("\n"),
                      allow_semantic_equivalent: allowSemantic,
                      allow_extra: allowExtra,
                    });
                  }}
                  className="px-3 py-1.5 bg-white border border-purple-300 text-purple-900 rounded-lg text-xs font-bold hover:bg-purple-50 transition-all cursor-pointer"
                >
                  ➕ Thêm đề mục
                </button>
              </div>
            </div>
          )}

          {/* Cấu hình bổ sung cho Template */}
          <div className="pt-2 border-t border-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <label className="flex items-center gap-2 text-purple-950 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={allowSemantic}
                onChange={(e) => onChange({ ...expectedValue, allow_semantic_equivalent: e.target.checked })}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              <span>
                <b>Cho phép tên tương đương ngữ nghĩa:</b> AI sẽ tự động phân tích và chấp nhận các từ đồng nghĩa học thuật (VD: &quot;Mở đầu&quot; ↔ &quot;Giới thiệu&quot;)
              </span>
            </label>
            <span className="text-[11px] font-bold text-purple-900 bg-purple-200/80 px-2.5 py-0.5 rounded-full flex-shrink-0">
              {headings.length} đề mục
            </span>
          </div>
        </div>
      )
    ) : ruleType === "MEASUREMENT" ? (
        /* ── 2. CÁC QUY TẮC ĐO LƯỜNG (CĂN LỀ, PHÔNG CHỮ, SỐ TRANG) ────────── */
        <div className="bg-sky-50/50 border border-sky-200 rounded-xl p-4 space-y-3.5">
          {/* Subtype switch bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 pb-2.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setMeasurementSubKind("margin");
                  onChange({
                    property: "margins_cm",
                    value: { top: 2.5, bottom: 2.5, left: 3.0, right: 2.0 },
                    tolerance: 0.15,
                  });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  measurementSubKind === "margin"
                    ? "bg-sky-700 text-white shadow-2xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                📐 Căn lề &amp; Khổ giấy (A4)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMeasurementSubKind("font");
                  onChange({
                    property: "font_name",
                    value: "Times New Roman",
                    font_size_pt: 13,
                    line_spacing: 1.5,
                  });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  measurementSubKind === "font"
                    ? "bg-sky-700 text-white shadow-2xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                ✍️ Phông chữ &amp; Giãn dòng
              </button>
              <button
                type="button"
                onClick={() => {
                  setMeasurementSubKind("page");
                  onChange({
                    property: "page_count",
                    operator: "max",
                    value: 50,
                  });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  measurementSubKind === "page"
                    ? "bg-sky-700 text-white shadow-2xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                📄 Dung lượng số trang
              </button>
            </div>
            <span className="text-[11px] text-sky-800 font-medium">Quy chuẩn đo lường định lượng</span>
          </div>

          {/* Subtype 1: Margins */}
          {measurementSubKind === "margin" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  Sơ đồ căn lề trang in (Khổ A4 chuẩn: 210 × 297 mm, in một mặt):
                </span>
                <span className="text-slate-500">Đơn vị: centimet (cm)</span>
              </div>

              {/* Visual Paper Box with 4 margins positioned around */}
              <div className="bg-white border-2 border-slate-200 rounded-xl p-4 max-w-md mx-auto shadow-xs space-y-3">
                {/* Top margin */}
                <div className="flex justify-center items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600">Lề trên (Top):</span>
                  <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 w-24">
                    <input
                      type="number"
                      step="0.1"
                      value={top}
                      onChange={(e) =>
                        onChange({
                          ...expectedValue,
                          property: "margins_cm",
                          value: { ...currentMargins, top: parseFloat(e.target.value) || 0 },
                          tolerance,
                        })
                      }
                      className="w-full text-xs font-bold text-slate-900 bg-transparent focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">cm</span>
                  </div>
                </div>

                {/* Middle row: Left margin - Center Sheet - Right margin */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-600 mb-1">Lề trái (Gáy):</span>
                    <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 w-20">
                      <input
                        type="number"
                        step="0.1"
                        value={left}
                        onChange={(e) =>
                          onChange({
                            ...expectedValue,
                            property: "margins_cm",
                            value: { ...currentMargins, left: parseFloat(e.target.value) || 0 },
                            tolerance,
                          })
                        }
                        className="w-full text-xs font-bold text-slate-900 bg-transparent focus:outline-none"
                      />
                      <span className="text-[11px] text-slate-400">cm</span>
                    </div>
                  </div>

                  <div className="flex-1 bg-sky-50/80 border border-dashed border-sky-300 rounded-lg p-4 text-center">
                    <span className="text-lg">📄</span>
                    <p className="text-xs font-bold text-sky-950 mt-1">Khổ giấy A4</p>
                    <p className="text-[10px] text-sky-700">In 1 mặt · Gáy sách bên trái</p>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-600 mb-1">Lề phải (Right):</span>
                    <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 w-20">
                      <input
                        type="number"
                        step="0.1"
                        value={right}
                        onChange={(e) =>
                          onChange({
                            ...expectedValue,
                            property: "margins_cm",
                            value: { ...currentMargins, right: parseFloat(e.target.value) || 0 },
                            tolerance,
                          })
                        }
                        className="w-full text-xs font-bold text-slate-900 bg-transparent focus:outline-none"
                      />
                      <span className="text-[11px] text-slate-400">cm</span>
                    </div>
                  </div>
                </div>

                {/* Bottom margin */}
                <div className="flex justify-center items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600">Lề dưới (Bottom):</span>
                  <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 w-24">
                    <input
                      type="number"
                      step="0.1"
                      value={bottom}
                      onChange={(e) =>
                        onChange({
                          ...expectedValue,
                          property: "margins_cm",
                          value: { ...currentMargins, bottom: parseFloat(e.target.value) || 0 },
                          tolerance,
                        })
                      }
                      className="w-full text-xs font-bold text-slate-900 bg-transparent focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">cm</span>
                  </div>
                </div>
              </div>

              {/* Presets and tolerance */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">Mẫu nhanh:</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...expectedValue,
                        property: "margins_cm",
                        value: { top: 2.5, bottom: 2.5, left: 3.0, right: 2.0 },
                        tolerance: 0.15,
                      })
                    }
                    className="px-2 py-1 bg-white border border-slate-200 text-slate-700 rounded text-[11px] font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    🏛 ĐHBK (3.0 - 2.0 - 2.5 - 2.5 cm)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...expectedValue,
                        property: "margins_cm",
                        value: { top: 2.0, bottom: 2.0, left: 3.5, right: 2.0 },
                        tolerance: 0.15,
                      })
                    }
                    className="px-2 py-1 bg-white border border-slate-200 text-slate-700 rounded text-[11px] font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    📜 Bộ GD&amp;ĐT (3.5 - 2.0 - 2.0 - 2.0 cm)
                  </button>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <span>Sai số cho phép:</span>
                  <input
                    type="number"
                    step="0.05"
                    value={tolerance}
                    onChange={(e) =>
                      onChange({
                        ...expectedValue,
                        tolerance: parseFloat(e.target.value) || 0.15,
                      })
                    }
                    className="w-14 px-1.5 py-0.5 bg-white border border-slate-300 rounded font-bold text-slate-800 text-center"
                  />
                  <span>cm</span>
                </div>
              </div>
            </div>
          )}

          {/* Subtype 2: Font & Spacing */}
          {measurementSubKind === "font" && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-800 block">
                Quy chuẩn Phông chữ &amp; Giãn dòng văn bản:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Phông chữ (Font family):
                  </label>
                  <input
                    type="text"
                    value={fontName}
                    onChange={(e) =>
                      onChange({
                        ...expectedValue,
                        property: "font_name",
                        value: e.target.value,
                        font_name: e.target.value,
                      })
                    }
                    placeholder="Times New Roman, Arial..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
                  />
                  <div className="flex gap-1 mt-1">
                    {["Times New Roman", "Arial"].map((fn) => (
                      <button
                        key={fn}
                        type="button"
                        onClick={() =>
                          onChange({
                            ...expectedValue,
                            property: "font_name",
                            value: fn,
                            font_name: fn,
                          })
                        }
                        className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600"
                      >
                        {fn}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Cỡ chữ thân bài:
                  </label>
                  <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                    <input
                      type="number"
                      step="0.5"
                      value={fontSize}
                      onChange={(e) =>
                        onChange({
                          ...expectedValue,
                          font_size_pt: parseFloat(e.target.value) || 13,
                        })
                      }
                      className="w-full text-xs font-bold text-slate-800 focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">pt</span>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[12, 13, 14].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onChange({ ...expectedValue, font_size_pt: s })}
                        className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600"
                      >
                        {s} pt
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Khoảng cách giãn dòng:
                  </label>
                  <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                    <input
                      type="number"
                      step="0.1"
                      value={lineSpacing}
                      onChange={(e) =>
                        onChange({
                          ...expectedValue,
                          line_spacing: parseFloat(e.target.value) || 1.5,
                        })
                      }
                      className="w-full text-xs font-bold text-slate-800 focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">lines</span>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[1.3, 1.5].map((ls) => (
                      <button
                        key={ls}
                        type="button"
                        onClick={() => onChange({ ...expectedValue, line_spacing: ls })}
                        className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600"
                      >
                        {ls} lines
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sample text preview */}
              <div
                className="bg-white border border-slate-200 rounded-lg p-3 text-slate-800 text-xs shadow-2xs mt-2"
                style={{
                  fontFamily: fontName,
                  fontSize: `${fontSize}px`,
                  lineHeight: lineSpacing,
                }}
              >
                <span className="font-bold">Đoạn văn minh họa:</span> Báo cáo đồ án môn học trình bày giải pháp kỹ thuật, hiện thực hệ thống và đánh giá kết quả thực nghiệm một cách trung thực, khoa học.
              </div>
            </div>
          )}

          {/* Subtype 3: Page count */}
          {measurementSubKind === "page" && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-800 block">
                Quy định về dung lượng số trang báo cáo:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Điều kiện:</label>
                  <select
                    value={pageOperator}
                    onChange={(e) =>
                      onChange({
                        ...expectedValue,
                        property: "page_count",
                        operator: e.target.value,
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="max">Tối đa không quá (Max)</option>
                    <option value="min">Tối thiểu phải đạt (Min)</option>
                    <option value="equals">Chính xác số trang (Equals)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Số trang yêu cầu:</label>
                  <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                    <input
                      type="number"
                      value={pageVal}
                      onChange={(e) =>
                        onChange({
                          ...expectedValue,
                          property: "page_count",
                          value: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full text-xs font-bold text-slate-800 focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">trang</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── 3. HIỆN DIỆN: BẢNG & TRÍCH DẪN & TÀI LIỆU THAM KHẢO ──────────── */
        <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3.5">
          {/* Subtype switch bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 pb-2.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPresenceSubKind("cover");
                  onChange({
                    kind: "cover_page",
                    required_fields: ["university", "faculty", "title", "students", "advisor", "year"],
                  });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  presenceSubKind === "cover"
                    ? "bg-amber-700 text-white shadow-2xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                🎨 Trang bìa chính
              </button>
              <button
                type="button"
                onClick={() => {
                  setPresenceSubKind("reference");
                  onChange({
                    kind: "heading",
                    value: "Tài liệu tham khảo",
                    citation_style: "IEEE",
                    min_count: 5,
                  });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  presenceSubKind === "reference"
                    ? "bg-amber-700 text-white shadow-2xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                📚 Trích dẫn &amp; Tài liệu tham khảo
              </button>
              <button
                type="button"
                onClick={() => {
                  setPresenceSubKind("table");
                  onChange({
                    kind: "table_columns",
                    value: ["STT", "Họ và tên", "Mã số sinh viên (MSSV)", "Nhiệm vụ đảm nhiệm", "Tỷ lệ đóng góp (%)", "Chữ ký xác nhận"],
                  });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  presenceSubKind === "table"
                    ? "bg-amber-700 text-white shadow-2xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                👥 Bảng phân công thành viên
              </button>
            </div>
            <span className="text-[11px] text-amber-800 font-medium">Cấu trúc bắt buộc &amp; Trích dẫn</span>
          </div>

          {/* Subtype 0: Cover page */}
          {presenceSubKind === "cover" ? (
            <div className="space-y-3">
              <div className="border-b border-amber-200/70 pb-2">
                <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <span>🎨</span> Các trường thông tin bắt buộc trên Trang bìa
                </h4>
                <p className="text-[11px] text-amber-800/80 mt-0.5">
                  Hệ thống phân tích tự động toàn bộ trang đầu tiên (kể cả văn bản trong bảng và khung viền) để đối soát các trường thông tin này.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {[
                  { id: "university", label: "Tên trường / ĐHQG (VD: ĐẠI HỌC BÁCH KHOA...)" },
                  { id: "faculty", label: "Khoa / Bộ môn / Viện (VD: KHOA KH&KT MÁY TÍNH...)" },
                  { id: "title", label: "Tên đề tài / Đồ án / Khóa luận tốt nghiệp" },
                  { id: "students", label: "Họ tên sinh viên & Mã số SV (MSSV 7-8 chữ số)" },
                  { id: "advisor", label: "Cán bộ / Giảng viên hướng dẫn (GVHD / CBHD)" },
                  { id: "year", label: "Địa điểm & Năm / Thời gian (VD: TP.HCM, 2026)" },
                ].map((f) => {
                  const reqList = Array.isArray(expectedValue?.required_fields)
                    ? (expectedValue.required_fields as string[])
                    : ["university", "faculty", "title", "students", "advisor", "year"];
                  const isChecked = reqList.includes(f.id);
                  return (
                    <label
                      key={f.id}
                      className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-all text-xs ${
                        isChecked
                          ? "bg-amber-100/70 border-amber-300 font-semibold text-amber-950 shadow-2xs"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const updated = isChecked
                            ? reqList.filter((x) => x !== f.id)
                            : [...reqList, f.id];
                          onChange({ ...expectedValue, kind: "cover_page", required_fields: updated });
                        }}
                        className="rounded text-amber-700 focus:ring-amber-500"
                      />
                      <span>{f.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : presenceSubKind === "reference" ? (
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800">
                  Tên đề mục tham khảo bắt buộc ở cuối báo cáo:
                </label>
                <input
                  type="text"
                  value={headingName}
                  onChange={(e) => onChange({ ...expectedValue, kind: "heading", value: e.target.value })}
                  placeholder="Tài liệu tham khảo"
                  className="bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 w-64"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  Lựa chọn chuẩn định dạng trích dẫn học thuật:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {citationPresets.map((preset) => {
                    const isSelected = citationStyle === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() =>
                          onChange({
                            ...expectedValue,
                            kind: "heading",
                            value: headingName,
                            citation_style: preset.id,
                            min_count: minRefs,
                          })
                        }
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? "bg-amber-100/80 border-amber-400 ring-2 ring-amber-400/50 shadow-xs"
                            : "bg-white border-amber-200 hover:bg-amber-50/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-slate-900">{preset.name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                            {preset.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">{preset.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Box of the Selected Citation Style */}
              {(() => {
                const currentPreset = citationPresets.find((p) => p.id === citationStyle) || citationPresets[0];
                return (
                  <div className="bg-white border border-amber-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                      <span>📖 Mẫu hiển thị chuẩn trích dẫn ({currentPreset.name}):</span>
                      <span className="text-[11px] text-amber-700 font-normal">Minh họa đối chiếu</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-700 bg-amber-50/40 p-2.5 rounded-lg border border-amber-100">
                      <p>
                        <span className="font-bold text-amber-950">Trích dẫn trong bài: </span>
                        <span className="italic">{currentPreset.inText}</span>
                      </p>
                      <p className="pt-1 border-t border-amber-100">
                        <span className="font-bold text-amber-950">Trong danh mục tham khảo: </span>
                        <span className="font-mono text-[11px] text-slate-800">{currentPreset.refSample}</span>
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">Số lượng tài liệu tham khảo tối thiểu:</span>
                  <input
                    type="number"
                    min={1}
                    value={minRefs}
                    onChange={(e) =>
                      onChange({ ...expectedValue, min_count: parseInt(e.target.value) || 1 })
                    }
                    className="w-16 px-2 py-1 bg-white border border-amber-300 rounded text-xs font-bold text-center text-slate-900"
                  />
                  <span className="text-slate-500">tài liệu</span>
                </div>
                <span className="text-[11px] text-amber-800 italic">
                  * Hệ thống kiểm tra đối chiếu sự hiện diện của danh mục và chỉ số trích dẫn trong văn bản.
                </span>
              </div>
            </div>
          ) : (
            /* Subtype: Table Columns (Contribution Table) */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-950">
                  Các cột bắt buộc trong Bảng phân công đóng góp thành viên:
                </span>
                <span className="text-amber-700">Kiểm tra qua cấu trúc bảng</span>
              </div>

              {/* Interactive Column Chips */}
              <div className="flex flex-wrap gap-2">
                {tableColumns.map((col, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 bg-white border border-amber-300 text-amber-900 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-2xs"
                  >
                    <span>✓ {col}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = tableColumns.filter((_, i) => i !== idx);
                        onChange({ ...expectedValue, kind: "table_columns", value: updated });
                      }}
                      className="text-amber-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>

              {/* Add column input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newColInput}
                  onChange={(e) => setNewColInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newColInput.trim()) {
                      e.preventDefault();
                      onChange({ ...expectedValue, kind: "table_columns", value: [...tableColumns, newColInput.trim()] });
                      setNewColInput("");
                    }
                  }}
                  placeholder="Nhập tên cột mới rồi bấm Thêm..."
                  className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-slate-800 flex-1 max-w-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newColInput.trim()) {
                      onChange({ ...expectedValue, kind: "table_columns", value: [...tableColumns, newColInput.trim()] });
                      setNewColInput("");
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-700 text-white rounded-lg text-xs font-bold hover:bg-amber-800 cursor-pointer"
                >
                  ➕ Thêm cột
                </button>
              </div>

              {/* Table Wireframe Mockup */}
              <div className="overflow-x-auto border border-amber-200 rounded-lg bg-white mt-2">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-amber-100/70 border-b border-amber-200">
                      {tableColumns.map((c, i) => (
                        <th key={i} className="p-2 font-bold text-amber-950 border-r last:border-r-0 border-amber-200">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-slate-400 italic">
                      {tableColumns.map((_, i) => (
                        <td key={i} className="p-2 border-r last:border-r-0 border-slate-100">
                          (Dữ liệu mẫu)
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Advanced JSON Toggle */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={() => setJsonMode(true)}
          className="text-[11px] text-slate-400 hover:text-slate-700 font-medium cursor-pointer"
        >
          {'{ }'} Xem / Sửa JSON kỹ thuật nâng cao
        </button>
      </div>
    </div>
  );
}
