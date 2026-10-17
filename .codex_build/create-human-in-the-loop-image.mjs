import fs from "node:fs/promises";
import { Presentation } from "file:///C:/Users/Nguyen%20Hoang%20Nhan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const workspace = "D:/TRACK_VNGF/academic-escalation-referee";
const deck = Presentation.create({ slideSize: { width: 1100, height: 900 } });
const slide = deck.slides.add();
slide.background.fill = "#F8FAFF";

const c = {
  ink: "#18235B",
  body: "#40517A",
  muted: "#65749A",
  white: "#FFFFFF",
  violet: "#7659F6",
  violetLine: "#D7D0FF",
  paleViolet: "#F3F1FF",
  green: "#169C78",
  greenLine: "#B9EBDC",
  paleGreen: "#ECFAF5",
  red: "#D93459",
  redLine: "#FFC8D4",
  paleRed: "#FFF0F3",
};

function addText(name, text, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox", name, position,
    fill: "none", line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: "Arial",
    fontSize: style.fontSize ?? 18,
    bold: style.bold ?? false,
    color: style.color ?? c.body,
    alignment: style.alignment ?? "left",
    verticalAlignment: "middle",
    wrap: "square",
    autoFit: "shrinkText",
    lineSpacing: style.lineSpacing ?? 1.05,
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

function addBadge(name, text, x, y, size, fill, fontSize = 21) {
  addShape(name, "ellipse", { left: x, top: y, width: size, height: size }, fill, fill, 0);
  addText(`${name} text`, text, { left: x, top: y + 1, width: size, height: size - 2 }, {
    fontSize, bold: true, color: c.white, alignment: "center",
  });
}

function addStep(name, number, title, detail, y) {
  const node = addShape(name, "roundRect", { left: 55, top: y, width: 990, height: 108 }, c.white, c.violetLine, 1.8);
  addBadge(`${name} number`, number, 84, y + 22, 64, c.violet, 23);
  addText(`${name} title`, title, { left: 174, top: y + 17, width: 825, height: 34 }, { fontSize: 23, bold: true, color: c.ink });
  addText(`${name} detail`, detail, { left: 174, top: y + 53, width: 825, height: 35 }, { fontSize: 18, color: c.muted });
  return node;
}

// Standalone crop of the processing workflow.
addShape("Workflow frame", "roundRect", { left: 12, top: 12, width: 1076, height: 876 }, "#FBFAFF", c.violetLine, 2.2);
addBadge("AI badge", "AI", 42, 38, 72, c.violet, 26);
addText("Processing title", "Xử lý", { left: 140, top: 39, width: 860, height: 46 }, { fontSize: 36, bold: true, color: c.ink });
addText("Human in the loop subtitle", "Human-in-the-loop: AI thẩm định, giảng viên can thiệp khi cần.", { left: 140, top: 88, width: 880, height: 34 }, { fontSize: 20, color: c.muted });

const step1 = addStep("Step 1", "01", "Phân tích yêu cầu", "Nhận diện nội dung, môn học và ý định của sinh viên.", 150);
const step2 = addStep("Step 2", "02", "Đối chiếu quy chế", "Tra cứu điều khoản liên quan, điều kiện và ngoại lệ đã duyệt.", 284);
const step3 = addStep("Step 3", "03", "Tổng hợp hướng xử lý", "Chuẩn bị câu trả lời có căn cứ hoặc xác định cần hỏi thêm.", 418);

const arrowhead = { type: "triangle", width: "sm", length: "sm" };
const stepLine = { style: "solid", fill: c.violet, width: 2.8 };
slide.shapes.connect(step1, step2, { kind: "straight", fromSide: "bottom", toSide: "top", line: stepLine, tail: arrowhead }).bringToFront();
slide.shapes.connect(step2, step3, { kind: "straight", fromSide: "bottom", toSide: "top", line: stepLine, tail: arrowhead }).bringToFront();

const decision = addShape("Lecturer review decision", "diamond", { left: 400, top: 558, width: 300, height: 132 }, c.paleViolet, c.violetLine, 2.2);
addText("Decision question", "Giảng viên\nxem xét?", { left: 458, top: 594, width: 184, height: 57 }, { fontSize: 22, bold: true, color: c.ink, alignment: "center", lineSpacing: 0.98 });
slide.shapes.connect(step3, decision, { kind: "straight", fromSide: "bottom", toSide: "top", line: stepLine, tail: arrowhead }).bringToFront();

const auto = addShape("Automatic handling", "roundRect", { left: 54, top: 746, width: 462, height: 116 }, c.paleGreen, c.greenLine, 1.8);
addBadge("AI handling badge", "AI", 76, 772, 62, c.green, 21);
addText("AI handling title", "AI xử lý theo quy chế", { left: 160, top: 756, width: 295, height: 31 }, { fontSize: 21, bold: true, color: "#08745A" });
addText("AI handling detail", "Trả lời, hỏi bổ sung hoặc nêu lý do ngoài phạm vi.", { left: 160, top: 790, width: 320, height: 51 }, { fontSize: 17, color: c.body, lineSpacing: 1.03 });

const human = addShape("Human review", "roundRect", { left: 584, top: 746, width: 462, height: 116 }, c.paleRed, c.redLine, 1.8);
addBadge("Lecturer badge", "GV", 606, 772, 62, c.red, 19);
addText("Lecturer review title", "Giảng viên xem xét", { left: 690, top: 756, width: 316, height: 31 }, { fontSize: 21, bold: true, color: c.red });
addText("Lecturer review detail", "Đánh giá trường hợp đặc biệt và đưa ra quyết định cuối cùng.", { left: 690, top: 790, width: 320, height: 51 }, { fontSize: 17, color: c.body, lineSpacing: 1.03 });

slide.shapes.connect(decision, auto, { kind: "elbow", fromSide: "left", toSide: "top", line: { style: "solid", fill: c.green, width: 3 }, tail: arrowhead }).bringToFront();
slide.shapes.connect(decision, human, { kind: "elbow", fromSide: "right", toSide: "top", line: { style: "solid", fill: c.red, width: 3 }, tail: arrowhead }).bringToFront();
addText("No branch", "KHÔNG", { left: 76, top: 708, width: 115, height: 26 }, { fontSize: 17, bold: true, color: c.green, alignment: "center" });
addText("Yes branch", "CÓ", { left: 914, top: 708, width: 72, height: 26 }, { fontSize: 17, bold: true, color: c.red, alignment: "center" });

const png = await slide.export({ format: "png", scale: 1 });
await fs.writeFile(`${workspace}/deliverables/aer-human-in-the-loop.png`, new Uint8Array(await png.arrayBuffer()));
