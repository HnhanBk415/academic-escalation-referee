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
  white: "#FFFFFF",
  blue: "#3196F4",
  blueLine: "#B8DCFF",
  paleBlue: "#EDF6FF",
  violet: "#7659F6",
  violetLine: "#D7D0FF",
  paleViolet: "#F3F1FF",
  green: "#169C78",
  greenLine: "#B9EBDC",
  paleGreen: "#EAF8F3",
  red: "#D93459",
  redLine: "#FFC8D4",
  paleRed: "#FFF0F3",
  grayLine: "#DCE5F1",
};

function addText(name, text, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: "Arial",
    fontSize: style.fontSize ?? 16,
    bold: style.bold ?? false,
    color: style.color ?? c.body,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "middle",
    wrap: "square",
    autoFit: "shrinkText",
    lineSpacing: style.lineSpacing ?? 1.03,
    insets: 0,
  };
  return shape;
}

function addShape(name, geometry, position, fill, lineFill = fill, lineWidth = 1.2) {
  return slide.shapes.add({
    geometry,
    name,
    position,
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

function addCircleBadge(name, label, x, y, size, fill, fontSize = 17) {
  const circle = addShape(name, "ellipse", { left: x, top: y, width: size, height: size }, fill, fill, 0);
  addText(`${name} label`, label, { left: x, top: y + 1, width: size, height: size - 2 }, {
    fontSize, bold: true, color: c.white, alignment: "center",
  });
  return circle;
}

function addStep(name, number, title, detail, top) {
  const card = addShape(name, "roundRect", { left: 356, top, width: 572, height: 62 }, c.white, c.violetLine, 1.3);
  addCircleBadge(`${name} number`, number, 372, top + 13, 36, c.violet, 15);
  addText(`${name} title`, title, { left: 425, top: top + 6, width: 474, height: 23 }, { fontSize: 17, bold: true, color: c.ink });
  addText(`${name} detail`, detail, { left: 425, top: top + 30, width: 474, height: 25 }, { fontSize: 14.5, color: c.muted });
  return card;
}

function addOutputItem(name, label, detail, top, symbol) {
  const card = addShape(name, "roundRect", { left: 990, top, width: 247, height: 68 }, "#F1FAF7", "#D4F0E7", 1.0);
  addCircleBadge(`${name} icon`, symbol, 1004, top + 13, 40, c.green, 17);
  addText(`${name} label`, label, { left: 1057, top: top + 8, width: 165, height: 24 }, { fontSize: 15.5, bold: true, color: "#075C4A" });
  addText(`${name} detail`, detail, { left: 1057, top: top + 32, width: 166, height: 29 }, { fontSize: 13.5, color: c.body, lineSpacing: 1.0 });
  return card;
}

// Header
addText("Project label", "AER AI REFEREE", { left: 420, top: 20, width: 440, height: 24 }, { fontSize: 15, bold: true, color: c.blue, alignment: "center" });
addText("Slide title", "Quy trình xử lý yêu cầu học vụ", { left: 115, top: 45, width: 1050, height: 48 }, { fontSize: 38, bold: true, color: c.ink, alignment: "center" });
addText("Slide subtitle", "AI phân tích và đối chiếu quy chế. Giảng viên quyết định các trường hợp cần xem xét.", { left: 110, top: 96, width: 1060, height: 34 }, { fontSize: 18, color: c.muted, alignment: "center" });

// Three-column layout, matching the user's reference.
const inputPanel = addShape("Input panel", "roundRect", { left: 24, top: 153, width: 286, height: 500 }, "#F5FAFF", c.blueLine, 1.3);
const processPanel = addShape("Processing panel", "roundRect", { left: 331, top: 153, width: 620, height: 500 }, "#FBFAFF", c.violetLine, 1.3);
const outputPanel = addShape("Output panel", "roundRect", { left: 972, top: 153, width: 284, height: 500 }, "#F6FCFA", c.greenLine, 1.3);

// Main column headers.
addCircleBadge("Input icon", "SV", 40, 169, 44, c.blue, 14);
addText("Input heading", "Đầu vào", { left: 96, top: 169, width: 190, height: 44 }, { fontSize: 26, bold: true, color: "#15477D" });
addCircleBadge("Process icon", "AI", 348, 169, 44, c.violet, 15);
addText("Process heading", "Xử lý", { left: 405, top: 166, width: 230, height: 36 }, { fontSize: 26, bold: true, color: c.ink });
addText("Process intro", "AI thẩm định yêu cầu qua ba bước", { left: 405, top: 200, width: 500, height: 25 }, { fontSize: 15, color: c.muted });
addCircleBadge("Output icon", "✓", 989, 169, 44, c.green, 21);
addText("Output heading", "Đầu ra", { left: 1047, top: 169, width: 185, height: 44 }, { fontSize: 26, bold: true, color: "#075C4A" });

// Input details.
addText("Input description", "Sinh viên gửi câu hỏi liên quan đến môn học, quy chế hoặc tình huống cá nhân.", { left: 42, top: 228, width: 250, height: 68 }, { fontSize: 15.5, color: "#315A8A", lineSpacing: 1.1 });
addShape("Example card", "roundRect", { left: 42, top: 314, width: 250, height: 153 }, c.white, c.blueLine, 1.2);
addCircleBadge("Example icon", "?", 54, 329, 36, c.blue, 20);
addText("Example heading", "Ví dụ câu hỏi", { left: 101, top: 330, width: 174, height: 25 }, { fontSize: 16, bold: true, color: "#15477D" });
addText("Example text", "“Em có thể nộp bài trễ trong trường hợp nào không?”", { left: 62, top: 369, width: 208, height: 76 }, { fontSize: 16, color: c.body, lineSpacing: 1.08 });
addText("Input fields heading", "Thông tin sinh viên gửi", { left: 45, top: 491, width: 235, height: 26 }, { fontSize: 15.5, bold: true, color: "#15477D" });
addText("Input fields detail", "Mã học phần\nCâu hỏi và mô tả tình huống\nThông tin bổ sung nếu cần", { left: 46, top: 523, width: 235, height: 85 }, { fontSize: 14.5, color: c.body, lineSpacing: 1.08 });

// Editable process steps and downward workflow connectors.
const step1 = addStep("Step 1 analysis", "01", "Phân tích yêu cầu", "Nhận diện nội dung, môn học và ý định của sinh viên.", 230);
const step2 = addStep("Step 2 policy", "02", "Đối chiếu quy chế", "Tra cứu điều khoản liên quan, điều kiện và ngoại lệ đã duyệt.", 306);
const step3 = addStep("Step 3 result", "03", "Tổng hợp hướng xử lý", "Chuẩn bị câu trả lời có căn cứ hoặc xác định cần hỏi thêm.", 382);

const flowArrow = { type: "triangle", width: "sm", length: "sm" };
const violetLine = { style: "solid", fill: c.violet, width: 2.1 };
slide.shapes.connect(step1, step2, { kind: "straight", fromSide: "bottom", toSide: "top", line: violetLine, tail: flowArrow }).bringToFront();
slide.shapes.connect(step2, step3, { kind: "straight", fromSide: "bottom", toSide: "top", line: violetLine, tail: flowArrow }).bringToFront();

const decision = addShape("Human review decision", "diamond", { left: 545, top: 461, width: 192, height: 87 }, c.paleViolet, c.violetLine, 1.8);
addText("Decision question", "Giảng viên\nxem xét?", { left: 569, top: 479, width: 144, height: 47 }, { fontSize: 16, bold: true, color: c.ink, alignment: "center", lineSpacing: 0.98 });
slide.shapes.connect(step3, decision, { kind: "straight", fromSide: "bottom", toSide: "top", line: violetLine, tail: flowArrow }).bringToFront();

const auto = addShape("AI automatic handling", "roundRect", { left: 354, top: 565, width: 269, height: 72 }, "#ECFAF5", c.greenLine, 1.2);
addCircleBadge("AI handling icon", "AI", 366, 580, 39, c.green, 13);
addText("AI handling heading", "AI xử lý theo quy chế", { left: 417, top: 571, width: 193, height: 24 }, { fontSize: 15.5, bold: true, color: "#08745A" });
addText("AI handling detail", "Trả lời, hỏi bổ sung hoặc nêu lý do ngoài phạm vi.", { left: 417, top: 596, width: 194, height: 30 }, { fontSize: 13.2, color: c.body, lineSpacing: 1.0 });

const human = addShape("Lecturer review handling", "roundRect", { left: 659, top: 565, width: 269, height: 72 }, c.paleRed, c.redLine, 1.4);
addCircleBadge("Lecturer icon", "GV", 671, 580, 39, c.red, 13);
addText("Lecturer heading", "Giảng viên xem xét", { left: 721, top: 571, width: 195, height: 24 }, { fontSize: 16, bold: true, color: c.red });
addText("Lecturer detail", "Ra quyết định cuối cùng. SLA 48 giờ.", { left: 721, top: 596, width: 196, height: 30 }, { fontSize: 13.7, color: c.body, lineSpacing: 1.0 });

slide.shapes.connect(decision, auto, { kind: "elbow", fromSide: "left", toSide: "top", line: { style: "solid", fill: c.green, width: 2.1 }, tail: flowArrow }).bringToFront();
slide.shapes.connect(decision, human, { kind: "elbow", fromSide: "right", toSide: "top", line: { style: "solid", fill: c.red, width: 2.3 }, tail: flowArrow }).bringToFront();
addText("No branch label", "KHÔNG", { left: 366, top: 540, width: 72, height: 20 }, { fontSize: 14, bold: true, color: c.green, alignment: "center" });
addText("Yes branch label", "CÓ", { left: 846, top: 540, width: 52, height: 20 }, { fontSize: 14, bold: true, color: c.red, alignment: "center" });

// Shared output panel.
addText("Output introduction", "Kết quả được gửi kèm căn cứ rõ ràng để sinh viên theo dõi.", { left: 991, top: 225, width: 246, height: 57 }, { fontSize: 14.5, color: "#28715F", lineSpacing: 1.06 });
addOutputItem("Output response", "Phản hồi yêu cầu", "Câu trả lời hoặc yêu cầu bổ sung.", 294, "?");
addOutputItem("Output policy basis", "Căn cứ quy chế", "Điều khoản được trích dẫn cụ thể.", 370, "§");
addOutputItem("Output decision", "Kết quả quyết định", "AI xử lý thường lệ, giảng viên chốt ngoại lệ.", 446, "GV");
addOutputItem("Output history", "Lịch sử hoạt động", "Trạng thái và thời hạn trong Audit Trail.", 522, "L");

// Cross-column connectors, like the reference slide.
slide.shapes.connect(inputPanel, processPanel, { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: c.blue, width: 2.5 }, tail: flowArrow }).bringToFront();
slide.shapes.connect(processPanel, outputPanel, { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: "#4458C6", width: 2.5 }, tail: flowArrow }).bringToFront();

addShape("Decision authority footer", "roundRect", { left: 24, top: 665, width: 1232, height: 38 }, c.paleViolet, c.violetLine, 1.0);
addCircleBadge("Footer authority icon", "!", 39, 671, 27, c.violet, 17);
addText("Decision authority text", "Giảng viên giữ quyền quyết định cuối cùng với ngoại lệ và trường hợp cần thẩm quyền.", { left: 81, top: 669, width: 1140, height: 30 }, { fontSize: 15, bold: true, color: c.ink, alignment: "center" });

const preview = await deck.export({ slide, format: "png", scale: 1 });
await fs.writeFile(`${buildDir}/aer-workflow-v2-slide.png`, new Uint8Array(await preview.arrayBuffer()));
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(`${buildDir}/aer-workflow-v2-draft.pptx`);
