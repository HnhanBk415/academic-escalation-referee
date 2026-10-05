import { useState } from "react";
import type { FormatRuleType } from "../types";

export function RuleTypeBadge({
  ruleType,
}: {
  ruleType: FormatRuleType;
  name?: string;
  expectedValue?: Record<string, unknown>;
}) {
  if (ruleType === "MEASUREMENT") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200 shadow-2xs">
        <span>📏</span>
        <span>Số đo (Code kiểm tra)</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs">
      <span>📝</span>
      <span>Nội dung / Text (AI kiểm tra)</span>
    </span>
  );
}

export function getCriterionSummary(item: {
  name?: string;
  rule_type: FormatRuleType;
  expected_value: Record<string, unknown>;
}): string {
  const { rule_type, expected_value } = item;
  if (!expected_value) return "";

  if (rule_type === "MEASUREMENT") {
    const prop = expected_value.property as string;
    const val = expected_value.value;

    if (prop === "page_count") {
      const minP = expected_value.min_pages;
      const maxP = expected_value.max_pages;
      if (minP && maxP) return `${minP} – ${maxP} trang`;
      if (maxP) return `Tối đa ${maxP} trang`;
      if (minP) return `Tối thiểu ${minP} trang`;
      return `${val || ""} trang`;
    }
    if (prop === "margins_cm") {
      if (typeof val === "object" && val !== null) {
        const v = val as Record<string, number>;
        return `Lề: Trên ${v.top ?? 2.5} · Dưới ${v.bottom ?? 2.5} · Trái ${v.left ?? 3.0} · Phải ${v.right ?? 2.0} cm`;
      }
      return "Căn lề chuẩn cm";
    }
    if (prop === "font_name" || expected_value.font_name) {
      const f = expected_value.font_name || val;
      const s = expected_value.font_size_pt;
      const l = expected_value.line_spacing;
      return `Phông ${f || "Times New Roman"}${s ? ` ${s}pt` : ""}${l ? ` · giãn dòng ${l}` : ""}`;
    }
    if (prop === "font_size_pt") return `Cỡ chữ: ${val} pt`;
    if (prop === "line_spacing") return `Giãn dòng: ${val}`;
  }

  // ALL OTHER CRITERIA (Text / Semantic / Presence / Template)
  if (expected_value.requirement_text) {
    const text = String(expected_value.requirement_text).trim().replace(/\s+/g, " ");
    return text.length > 90 ? text.slice(0, 87) + "..." : text;
  }
  if (expected_value.description) {
    const text = String(expected_value.description).trim().replace(/\s+/g, " ");
    return text.length > 90 ? text.slice(0, 87) + "..." : text;
  }
  if (typeof expected_value.value === "string") {
    return expected_value.value;
  }

  return "Nội dung quy định theo tài liệu";
}

export function FormattedExpectedValue({
  ruleType,
  expectedValue,
  description,
}: {
  ruleType?: FormatRuleType;
  expectedValue?: Record<string, unknown>;
  description?: string;
}) {
  if (!expectedValue && !description) {
    return <span className="text-slate-400 italic">Theo quy định chung của môn học</span>;
  }

  const exp = expectedValue || {};
  const isMeas = ruleType === "MEASUREMENT" || exp.property;

  if (isMeas) {
    const prop = exp.property as string;
    const val = exp.value;

    if (prop === "margins_cm" && typeof val === "object" && val !== null) {
      const v = val as Record<string, number>;
      return (
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-slate-800">Căn lề trang quy định:</p>
          <div className="flex flex-wrap gap-2 text-[11px] font-mono">
            <span className="bg-sky-50 px-2 py-0.5 rounded border border-sky-200">Trên: {v.top ?? 2.5}cm</span>
            <span className="bg-sky-50 px-2 py-0.5 rounded border border-sky-200">Dưới: {v.bottom ?? 2.5}cm</span>
            <span className="bg-sky-50 px-2 py-0.5 rounded border border-sky-200">Trái: {v.left ?? 3.0}cm</span>
            <span className="bg-sky-50 px-2 py-0.5 rounded border border-sky-200">Phải: {v.right ?? 2.0}cm</span>
          </div>
        </div>
      );
    }

    if (prop === "page_count") {
      const minP = exp.min_pages;
      const maxP = exp.max_pages;
      return (
        <div className="text-xs">
          <span className="font-semibold text-slate-800">Dung lượng: </span>
          <span className="font-mono bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
            {minP && maxP ? `${minP} - ${maxP} trang` : maxP ? `Tối đa ${maxP} trang` : minP ? `Tối thiểu ${minP} trang` : `${val || 0} trang`}
          </span>
        </div>
      );
    }

    if (prop === "font_name" || exp.font_name || prop === "font_size_pt" || prop === "line_spacing") {
      const fontVal = exp.font_name || (prop === "font_name" ? val : null);
      const sizeVal = exp.font_size_pt || (prop === "font_size_pt" ? val : null);
      const spaceVal = exp.line_spacing || (prop === "line_spacing" ? val : null);
      return (
        <div className="text-xs space-y-1">
          <p className="font-semibold text-slate-800">Quy chuẩn định dạng chữ:</p>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {Boolean(fontVal) && (
              <span className="bg-sky-50 px-2 py-0.5 rounded border border-sky-200">Phông: {String(fontVal)}</span>
            )}
            {Boolean(sizeVal) && (
              <span className="bg-sky-50 px-2 py-0.5 rounded border border-sky-200">Cỡ chữ: {String(sizeVal)}pt</span>
            )}
            {Boolean(spaceVal) && (
              <span className="bg-sky-50 px-2 py-0.5 rounded border border-sky-200">Giãn dòng: {String(spaceVal)}</span>
            )}
          </div>
        </div>
      );
    }
  }

  // Text-based criterion
  const reqText = exp.requirement_text || description || exp.description || (typeof exp.value === "string" ? exp.value : "");

  return (
    <div className="text-xs space-y-1">
      <p className="text-slate-800 whitespace-pre-wrap leading-relaxed font-normal">
        {String(reqText) || "Yêu cầu theo đề cương môn học."}
      </p>
    </div>
  );
}

export function FormattedActualValue({
  actualValue,
  ruleType,
}: {
  actualValue?: Record<string, unknown> | null;
  ruleType?: FormatRuleType;
}) {
  if (!actualValue) {
    return <span className="text-slate-400 italic">Chưa tìm thấy hoặc không có dữ liệu tương ứng</span>;
  }

  const isMeas = ruleType === "MEASUREMENT";

  if (isMeas) {
    if (actualValue.margins_cm) {
      const margins = actualValue.margins_cm as Array<Record<string, number>>;
      if (Array.isArray(margins) && margins.length > 0) {
        const m = margins[0];
        return (
          <div className="text-xs space-y-1">
            <span className="font-semibold text-slate-800">Số đo bóc tách từ file: </span>
            <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200 inline-block">
              Trên: {m.top}cm · Dưới: {m.bottom}cm · Trái: {m.left}cm · Phải: {m.right}cm
            </span>
          </div>
        );
      }
    }

    if (actualValue.page_count !== undefined) {
      return (
        <div className="text-xs">
          <span className="font-semibold text-slate-800">Số trang thực tế: </span>
          <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200">
            {String(actualValue.page_count)} trang
          </span>
        </div>
      );
    }

    if (actualValue.font_names || actualValue.font_sizes_pt) {
      const fonts = (actualValue.font_names as string[]) || [];
      const sizes = (actualValue.font_sizes_pt as number[]) || [];
      return (
        <div className="text-xs space-y-1">
          <span className="font-semibold text-slate-800">Phông chữ &amp; Cỡ chữ bóc tách: </span>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {fonts.length > 0 && <span className="bg-white px-2 py-0.5 rounded border border-slate-200">Phông: {fonts.slice(0, 3).join(", ")}</span>}
            {sizes.length > 0 && <span className="bg-white px-2 py-0.5 rounded border border-slate-200">Cỡ chữ: {sizes.slice(0, 4).join(", ")}pt</span>}
          </div>
        </div>
      );
    }
  }

  // Text-based actual value
  if (actualValue.detected) {
    const loc = actualValue.location ? ` (${actualValue.location})` : "";
    return (
      <div className="text-xs space-y-1">
        <p className="text-slate-800 leading-relaxed font-normal">
          {String(actualValue.detected)}{loc}
        </p>
      </div>
    );
  }

  if (actualValue.headings && Array.isArray(actualValue.headings)) {
    return (
      <div className="text-xs space-y-1">
        <span className="font-semibold text-slate-700">Đề mục phát hiện: </span>
        <span className="text-slate-800">{actualValue.headings.slice(0, 5).join(" → ")}</span>
      </div>
    );
  }

  if (actualValue.cover_fields && Array.isArray(actualValue.cover_fields)) {
    return (
      <div className="text-xs space-y-1">
        <span className="font-semibold text-slate-700">Trường bìa nhận diện: </span>
        <span className="text-slate-800">{actualValue.cover_fields.join(", ")}</span>
      </div>
    );
  }

  if (actualValue.has_table !== undefined) {
    return (
      <div className="text-xs">
        <span className="font-semibold text-slate-800">Thực tế bài nộp: </span>
        <span>{actualValue.has_table ? "Đã có bảng phân công đóng góp thành viên" : "Không tìm thấy bảng phân công"}</span>
      </div>
    );
  }

  return (
    <div className="text-xs text-slate-800">
      {JSON.stringify(actualValue).replace(/[{}\[\]"]/g, " ").trim()}
    </div>
  );
}

export function StructuredContentEditor({
  ruleType,
  expectedValue,
  onChange,
}: {
  ruleType: FormatRuleType;
  expectedValue: Record<string, unknown>;
  name: string;
  onChange: (val: Record<string, unknown>) => void;
}) {
  const isMeasurement = ruleType === "MEASUREMENT";
  const prop = (expectedValue?.property as string) || "margins_cm";

  // 1. GIAO DIỆN CHO TIÊU CHÍ ĐO LƯỜNG (MEASUREMENT)
  if (isMeasurement) {
    const val = (expectedValue?.value as Record<string, number>) || {};

    return (
      <div className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-xs font-bold text-slate-700">
            Loại thông số kỹ thuật:
            <select
              value={prop}
              onChange={(e) => {
                const newProp = e.target.value;
                if (newProp === "margins_cm") {
                  onChange({ ...expectedValue, property: "margins_cm", value: { top: 2.5, bottom: 2.5, left: 3.0, right: 2.0 } });
                } else if (newProp === "page_count") {
                  onChange({ ...expectedValue, property: "page_count", min_pages: 15, max_pages: 40, value: 40 });
                } else if (newProp === "font_name") {
                  onChange({ ...expectedValue, property: "font_name", font_name: "Times New Roman", font_size_pt: 13, line_spacing: 1.3 });
                }
              }}
              className="block mt-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-normal"
            >
              <option value="margins_cm">Căn lề trang (cm)</option>
              <option value="font_name">Phông chữ &amp; Cỡ chữ &amp; Giãn dòng</option>
              <option value="page_count">Dung lượng số trang</option>
            </select>
          </label>
        </div>

        {prop === "margins_cm" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
            <div>
              <label className="text-[11px] text-slate-600 font-semibold block">Lề Trên (cm)</label>
              <input
                type="number"
                step="0.1"
                value={val.top ?? 2.5}
                onChange={(e) =>
                  onChange({
                    ...expectedValue,
                    property: "margins_cm",
                    value: { ...val, top: parseFloat(e.target.value) || 2.5 },
                  })
                }
                className="mt-1 w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-600 font-semibold block">Lề Dưới (cm)</label>
              <input
                type="number"
                step="0.1"
                value={val.bottom ?? 2.5}
                onChange={(e) =>
                  onChange({
                    ...expectedValue,
                    property: "margins_cm",
                    value: { ...val, bottom: parseFloat(e.target.value) || 2.5 },
                  })
                }
                className="mt-1 w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-600 font-semibold block">Lề Trái (cm)</label>
              <input
                type="number"
                step="0.1"
                value={val.left ?? 3.0}
                onChange={(e) =>
                  onChange({
                    ...expectedValue,
                    property: "margins_cm",
                    value: { ...val, left: parseFloat(e.target.value) || 3.0 },
                  })
                }
                className="mt-1 w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-600 font-semibold block">Lề Phải (cm)</label>
              <input
                type="number"
                step="0.1"
                value={val.right ?? 2.0}
                onChange={(e) =>
                  onChange({
                    ...expectedValue,
                    property: "margins_cm",
                    value: { ...val, right: parseFloat(e.target.value) || 2.0 },
                  })
                }
                className="mt-1 w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>
        )}

        {prop === "font_name" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
            <div>
              <label className="text-[11px] text-slate-600 font-semibold block">Tên phông</label>
              <input
                type="text"
                value={String(expectedValue.font_name || expectedValue.value || "Times New Roman")}
                onChange={(e) =>
                  onChange({
                    ...expectedValue,
                    property: "font_name",
                    font_name: e.target.value,
                    value: e.target.value,
                  })
                }
                className="mt-1 w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                placeholder="Times New Roman, Arial..."
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-600 font-semibold block">Cỡ chữ (pt)</label>
              <input
                type="number"
                step="0.5"
                value={Number(expectedValue.font_size_pt || 13)}
                onChange={(e) =>
                  onChange({
                    ...expectedValue,
                    font_size_pt: parseFloat(e.target.value) || 13,
                  })
                }
                className="mt-1 w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-600 font-semibold block">Giãn dòng (lines)</label>
              <input
                type="number"
                step="0.05"
                value={Number(expectedValue.line_spacing || 1.3)}
                onChange={(e) =>
                  onChange({
                    ...expectedValue,
                    line_spacing: parseFloat(e.target.value) || 1.3,
                  })
                }
                className="mt-1 w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>
        )}

        {prop === "page_count" && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-[11px] text-slate-600 font-semibold block">Số trang tối thiểu</label>
              <input
                type="number"
                value={Number(expectedValue.min_pages || 0)}
                onChange={(e) =>
                  onChange({
                    ...expectedValue,
                    property: "page_count",
                    min_pages: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="mt-1 w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-600 font-semibold block">Số trang tối đa</label>
              <input
                type="number"
                value={Number(expectedValue.max_pages || 0)}
                onChange={(e) =>
                  onChange({
                    ...expectedValue,
                    property: "page_count",
                    max_pages: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="mt-1 w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. GIAO DIỆN CHO TẤT CẢ TIÊU CHÍ XỬ LÝ BẰNG TEXT (Trang bìa, Bảng phân công, Khung đề cương, Mục lục, TLTK, v.v.)
  // Chỉ cần Textarea chứa nội dung quy định trích xuất từ quy chế!
  const currentText = String(expectedValue?.requirement_text || expectedValue?.description || expectedValue?.value || "");

  return (
    <div className="space-y-2 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
      <label className="text-xs font-bold text-slate-800 block">
        📄 Nội dung / Đoạn trích quy định từ quy chế môn học:
      </label>
      <textarea
        rows={4}
        value={currentText}
        onChange={(e) =>
          onChange({
            ...expectedValue,
            requirement_text: e.target.value,
            description: e.target.value,
          })
        }
        placeholder="Nhập hoặc dán nguyên văn đoạn văn bản yêu cầu từ quy định/đề cương..."
        className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-red-500 focus:border-red-500 leading-relaxed font-normal shadow-2xs"
      />
      <p className="text-[11px] text-slate-500">
        💡 Đoạn text này sẽ được đưa trực tiếp vào prompt AI để đối chiếu độc lập với toàn bộ nội dung bài nộp của sinh viên.
      </p>
    </div>
  );
}
