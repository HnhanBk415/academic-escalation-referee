import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "file:///C:/Users/Nguyen%20Hoang%20Nhan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const workspace = "D:/TRACK_VNGF/academic-escalation-referee";
const buildDir = `${workspace}/.codex_build`;
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slide = deck.slides.add();
slide.background.fill = "#F8FAFF";

const c = {
  ink: "#18235B",
  body: "#40517A",
  muted: "#65749A",
  blue: "#3196F4",
  blueLine: "#C7E2FF",
  paleBlue: "#EFF7FF",
  violet: "#7659F6",
  violetLine: "#D7D0FF",
  paleViolet: "#F3F1FF",
  green: "#169C78",
  greenLine: "#B9EBDC",
  paleGreen: "#ECFAF5",
  white: "#FFFFFF",
  border: "#E0E7F2",
};

function addText(name, text, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox", name, position,
    fill: "none", line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: "Arial",
    fontSize: style.fontSize ?? 16,
    bold: style.bold ?? false,
    color: style.color ?? c.body,
    alignment: style.alignment ?? "left",
    verticalAlignment: "middle",
    wrap: "square",
    autoFit: "shrinkText",
    lineSpacing: style.lineSpacing ?? 1.04,
    insets: 0,
  };
  return shape;
}

function addShape(name, geometry, position, fill, lineFill = fill, lineWidth = 1.2) {
  return slide.shapes.add({
    geometry, name, position, fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

function addComparePanel(name, x, accent, tint, eyebrow, title, detail) {
  const panel = addShape(`${name} panel`, "roundRect", { left: x, top: 143, width: 505, height: 140 }, c.white, c.border, 1.2);
  addShape(`${name} accent`, "roundRect", { left: x, top: 143, width: 8, height: 140 }, accent, accent, 0);
  addText(`${name} eyebrow`, eyebrow, { left: x + 25, top: 155, width: 455, height: 23 }, { fontSize: 14, bold: true, color: accent });
  addText(`${name} title`, title, { left: x + 25, top: 181, width: 455, height: 29 }, { fontSize: 20, bold: true, color: c.ink });
  addText(`${name} detail`, detail, { left: x + 25, top: 215, width: 455, height: 52 }, { fontSize: 15.5, color: c.body, lineSpacing: 1.05 });
  return panel;
}

function addMetricCard(name, x, title, unit, method, tint, accent) {
  const panel = addShape(`${name} panel`, "roundRect", { left: x, top: 320, width: 376, height: 240 }, c.white, c.border, 1.1);
  addText(`${name} title`, title, { left: x + 20, top: 337, width: 336, height: 48 }, { fontSize: 18, bold: true, color: c.ink, lineSpacing: 0.98 });

  const valueY = 396;
  const valueWidth = 155;
  addShape(`${name} before tile`, "roundRect", { left: x + 20, top: valueY, width: valueWidth, height: 67 }, "#F1F6FD", "#DFE8F3", 1);
  addText(`${name} before label`, "TRƯỚC", { left: x + 29, top: valueY + 7, width: 136, height: 19 }, { fontSize: 12.5, bold: true, color: c.muted, alignment: "center" });
  addText(`${name} before value`, "Chưa có baseline", { left: x + 25, top: valueY + 28, width: 144, height: 29 }, { fontSize: 14, bold: true, color: c.ink, alignment: "center" });

  addText(`${name} comparison arrow`, "→", { left: x + 180, top: valueY + 17, width: 25, height: 32 }, { fontSize: 23, bold: true, color: accent, alignment: "center" });

  addShape(`${name} after tile`, "roundRect", { left: x + 221, top: valueY, width: valueWidth, height: 67 }, tint, tint, 1);
  addText(`${name} after label`, "SAU PILOT", { left: x + 230, top: valueY + 7, width: 136, height: 19 }, { fontSize: 12.5, bold: true, color: accent, alignment: "center" });
  addText(`${name} after value`, "Chưa có pilot", { left: x + 226, top: valueY + 28, width: 144, height: 29 }, { fontSize: 14, bold: true, color: accent, alignment: "center" });

  addText(`${name} method`, method, { left: x + 20, top: 477, width: 336, height: 62 }, { fontSize: 13.8, color: c.body, lineSpacing: 1.04 });
  return panel;
}

addText("Eyebrow", "AER AI REFEREE", { left: 58, top: 23, width: 260, height: 22 }, { fontSize: 14, bold: true, color: c.blue });
addText("Title", "Kế hoạch đo lường tác động của AER", { left: 58, top: 48, width: 1160, height: 48 }, { fontSize: 36, bold: true, color: c.ink });
addText("Subtitle", "Chưa có dữ liệu triển khai — cần đo baseline và pilot theo cùng một cách.", { left: 60, top: 99, width: 1120, height: 29 }, { fontSize: 18, color: c.muted });

const before = addComparePanel(
  "Before AER",
  58,
  c.blue,
  c.paleBlue,
  "BASELINE",
  "Quy trình hiện tại",
  "Ghi nhận thời điểm nhận yêu cầu, phản hồi và mức giảng viên tham gia.",
);
const after = addComparePanel(
  "After AER",
  717,
  c.violet,
  c.paleViolet,
  "PILOT AER",
  "AI hỗ trợ, giảng viên giữ quyền quyết định",
  "AI xử lý ca đủ căn cứ. Ngoại lệ và trường hợp chưa rõ chuyển giảng viên xem xét.",
);
slide.shapes.connect(before, after, { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: c.violet, width: 2.3 }, tail: { type: "triangle", width: "sm", length: "sm" } }).bringToFront();

addMetricCard(
  "Response time",
  58,
  "Thời gian đến phản hồi có ích",
  "phút",
  "Từ lúc gửi yêu cầu đến phản hồi đầu tiên có ích.",
  c.paleBlue,
  c.blue,
);
addMetricCard(
  "No lecturer escalation",
  452,
  "Yêu cầu không cần giảng viên",
  "%",
  "Số yêu cầu không chuyển giảng viên trên tổng yêu cầu đủ điều kiện.",
  c.paleGreen,
  c.green,
);
addMetricCard(
  "Route and evidence accuracy",
  846,
  "Độ chính xác hướng xử lý",
  "ca/20",
  "Chấm cùng bộ kiểm thử 20 ca bằng một rubric; đây là test nội bộ, không phải pilot.",
  c.paleViolet,
  c.violet,
);

addShape("Measurement note panel", "roundRect", { left: 58, top: 584, width: 1164, height: 92 }, c.paleViolet, c.violetLine, 1.1);
addShape("Measurement note badge", "ellipse", { left: 76, top: 600, width: 46, height: 46 }, c.violet, c.violet, 0);
addText("Measurement note symbol", "i", { left: 76, top: 601, width: 46, height: 44 }, { fontSize: 25, bold: true, color: c.white, alignment: "center" });
addText("Measurement note heading", "Đo cùng điều kiện", { left: 139, top: 591, width: 1026, height: 27 }, { fontSize: 16, bold: true, color: c.ink });
addText("Measurement note detail", "Các ô chưa có dữ liệu baseline/pilot. 20 ca là bộ kiểm thử nội bộ, không phải kết quả thực tế. Đo hai giai đoạn trên cùng nhóm yêu cầu, kỳ quan sát và rubric.", { left: 139, top: 620, width: 1035, height: 43 }, { fontSize: 14.5, color: c.body, lineSpacing: 1.04 });

slide.speakerNotes.text = "Đây là khung đo lường, không phải kết quả triển khai. Bộ đánh giá harness/datasets/evaluation.jsonl hiện có 20 ca thuộc 5 nhóm: routine (6), missing_fact (4), out_of_policy (4), authority (4), suspicious (2). Dùng cùng bộ ca và cùng rubric để chấm hướng xử lý/căn cứ. Với thời gian phản hồi, so sánh baseline và pilot trong các nhóm môn học, loại yêu cầu và khoảng quan sát tương đương; lấy mốc từ QUESTION_SUBMITTED đến sự kiện phản hồi tương ứng trong Audit Trail. Tỷ lệ không cần giảng viên = số yêu cầu đủ điều kiện không chuyển ESCALATE / tổng yêu cầu đủ điều kiện.";

const preview = await deck.export({ slide, format: "png", scale: 1 });
await fs.writeFile(`${buildDir}/impact-before-after-slide.png`, new Uint8Array(await preview.arrayBuffer()));
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(`${buildDir}/impact-before-after-draft.pptx`);
