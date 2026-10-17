import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "file:///C:/Users/Nguyen%20Hoang%20Nhan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const workspace = "D:/TRACK_VNGF/academic-escalation-referee";
const buildDir = `${workspace}/.codex_build`;
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slide = deck.slides.add();
slide.background.fill = "#FFF7F8";

const c = {
  ink: "#24151A",
  body: "#5D4C52",
  muted: "#8B737B",
  border: "#F2DDE2",
  connector: "#C9AEB6",
  ruby: "#BE123C",
  coral: "#F43F5E",
  green: "#047857",
  amber: "#B45309",
  paleRose: "#FFF0F2",
  paleGreen: "#ECFDF5",
  paleAmber: "#FFFBEB",
  paleGray: "#F7F4F5",
  white: "#FFFFFF",
};

function addText(name, text, position, style = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = text;
  box.text.style = {
    typeface: "Arial",
    fontSize: style.fontSize ?? 18,
    bold: style.bold ?? false,
    color: style.color ?? c.body,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "middle",
    wrap: "square",
    autoFit: "shrinkText",
    lineSpacing: style.lineSpacing ?? 1,
    insets: 0,
  };
  return box;
}

function addNode(name, geometry, position, fill, lineFill = c.border, lineWidth = 1.4) {
  return slide.shapes.add({
    geometry,
    name,
    position,
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

function addBranchCard(name, label, detail, top, accent, fill) {
  const card = addNode(
    name,
    "roundRect",
    { left: 905, top, width: 316, height: 104 },
    c.white,
    c.border,
    1.3,
  );
  // Accent rail and soft branch tint make the routing outcomes scannable.
  addNode(`${name} accent`, "roundRect", { left: 905, top: top + 13, width: 6, height: 78 }, accent, accent, 0);
  addNode(`${name} tint`, "roundRect", { left: 923, top: top + 14, width: 276, height: 26 }, fill, fill, 0);
  addText(`${name} label`, label, { left: 937, top: top + 14, width: 260, height: 26 }, { fontSize: 14, bold: true, color: accent });
  addText(`${name} detail`, detail, { left: 928, top: top + 48, width: 275, height: 45 }, { fontSize: 16, color: c.body, lineSpacing: 1.03 });
  return card;
}

addText(
  "Slide title",
  "Workflow xử lý câu hỏi học thuật",
  { left: 58, top: 42, width: 1160, height: 58 },
  { fontSize: 40, bold: true, color: c.ruby },
);
addText(
  "Slide subtitle",
  "AI phân tích và phân luồng; giảng viên đưa ra quyết định khi có ngoại lệ.",
  { left: 60, top: 101, width: 1140, height: 34 },
  { fontSize: 20, color: c.body },
);

// Main intake and AI review sequence.
const input = addNode("Sinh viên gửi câu hỏi", "ellipse", { left: 54, top: 260, width: 192, height: 118 }, c.white, c.coral, 2);
const review = addNode("AI and RAG review", "roundRect", { left: 302, top: 248, width: 238, height: 142 }, c.white, c.border, 1.5);
const routing = addNode("AI routing decision", "diamond", { left: 600, top: 235, width: 205, height: 166 }, c.paleRose, c.ruby, 2.2);

addText("Input title", "SINH VIÊN", { left: 74, top: 279, width: 152, height: 27 }, { fontSize: 17, bold: true, color: c.ruby, alignment: "center" });
addText("Input detail", "Gửi câu hỏi\nvà thông tin học phần", { left: 75, top: 310, width: 150, height: 48 }, { fontSize: 16, color: c.body, alignment: "center", lineSpacing: 1.03 });
addText("Review title", "AI + RAG THẨM ĐỊNH", { left: 321, top: 266, width: 200, height: 28 }, { fontSize: 16, bold: true, color: c.ink, alignment: "center" });
addText("Review detail", "Trích xuất mã môn học\nĐối chiếu quy chế và\nngoại lệ đã được duyệt", { left: 325, top: 302, width: 192, height: 67 }, { fontSize: 16, color: c.body, alignment: "center", lineSpacing: 1.03 });
addText("Routing text", "AI\nPHÂN LUỒNG", { left: 630, top: 278, width: 145, height: 72 }, { fontSize: 21, bold: true, color: c.ruby, alignment: "center", lineSpacing: 0.98 });

const answer = addBranchCard("Policy answer", "ĐỦ CĂN CỨ THEO QUY CHẾ", "AI trả lời kèm điều khoản và trích dẫn nguồn.", 145, c.green, c.paleGreen);
const clarify = addBranchCard("Clarification", "THIẾU THÔNG TIN", "Yêu cầu sinh viên bổ sung; thẩm định lại tối đa 2 lượt.", 264, c.amber, c.paleAmber);
const human = addBranchCard("Lecturer review", "NGOẠI LỆ / CẦN XEM XÉT", "Giảng viên xem hồ sơ và quyết định: duyệt, từ chối, hỏi thêm hoặc chuyển tiếp. SLA 48 giờ.", 383, c.ruby, c.paleRose);
const outOfScope = addBranchCard("Out of scope", "NGOÀI PHẠM VI", "Lưu lý do và thông báo rõ trạng thái cho sinh viên.", 502, c.muted, c.paleGray);

// Directional connectors from intake through AI classification to each outcome.
const arrowLine = { style: "solid", fill: c.connector, width: 2.2 };
const arrow = { type: "triangle", width: "sm", length: "sm" };
slide.shapes.connect(input, review, { kind: "straight", fromSide: "right", toSide: "left", line: arrowLine, tail: arrow });
slide.shapes.connect(review, routing, { kind: "straight", fromSide: "right", toSide: "left", line: arrowLine, tail: arrow });
slide.shapes.connect(routing, answer, { kind: "elbow", fromSide: "right", toSide: "left", line: { style: "solid", fill: c.green, width: 2 }, tail: arrow });
slide.shapes.connect(routing, clarify, { kind: "elbow", fromSide: "right", toSide: "left", line: { style: "solid", fill: c.amber, width: 2 }, tail: arrow });
slide.shapes.connect(routing, human, { kind: "elbow", fromSide: "right", toSide: "left", line: { style: "solid", fill: c.ruby, width: 2.8 }, tail: arrow });
slide.shapes.connect(routing, outOfScope, { kind: "elbow", fromSide: "right", toSide: "left", line: { style: "solid", fill: c.muted, width: 2 }, tail: arrow });

addText("Answer branch", "CÓ", { left: 833, top: 169, width: 52, height: 24 }, { fontSize: 14, bold: true, color: c.green, alignment: "center" });
addText("Clarify branch", "THIẾU", { left: 833, top: 286, width: 58, height: 24 }, { fontSize: 14, bold: true, color: c.amber, alignment: "center" });
addText("Human branch", "NGOẠI LỆ", { left: 825, top: 405, width: 69, height: 24 }, { fontSize: 14, bold: true, color: c.ruby, alignment: "center" });
addText("Out of scope branch", "KHÔNG", { left: 833, top: 524, width: 58, height: 24 }, { fontSize: 14, bold: true, color: c.muted, alignment: "center" });

// Human authority and traceability are explicit in the footer.
addNode("Decision footer panel", "roundRect", { left: 55, top: 635, width: 1168, height: 48 }, c.white, c.border, 1.1);
addText(
  "Human decision footer",
  "GIẢNG VIÊN QUYẾT ĐỊNH TRƯỜNG HỢP NGOẠI LỆ   •   Mọi câu trả lời, quyết định và thời hạn được lưu trong lịch sử và Audit Trail",
  { left: 76, top: 644, width: 1126, height: 30 },
  { fontSize: 15, bold: true, color: c.ruby, alignment: "center" },
);

const preview = await deck.export({ slide, format: "png", scale: 1 });
await fs.writeFile(`${buildDir}/aer-workflow-slide.png`, new Uint8Array(await preview.arrayBuffer()));
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(`${buildDir}/aer-workflow-draft.pptx`);
