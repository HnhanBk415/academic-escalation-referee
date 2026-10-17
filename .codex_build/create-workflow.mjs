import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "file:///C:/Users/Nguyen%20Hoang%20Nhan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const workspace = "D:/TRACK_VNGF/academic-escalation-referee";
const buildDir = `${workspace}/.codex_build`;
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slide = deck.slides.add();
slide.background.fill = "#F7F5EF";

const c = {
  ink: "#18324A",
  body: "#526371",
  muted: "#687985",
  line: "#AAB8C4",
  inputFill: "#E3EBF4",
  processFill: "#E7EDF3",
  humanFill: "#F4D9CB",
  human: "#C9653B",
  reworkFill: "#EFE8DB",
  outputFill: "#DDECE5",
  outputInk: "#315D4D",
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
    fontSize: style.fontSize ?? 20,
    bold: style.bold ?? false,
    color: style.color ?? c.body,
    alignment: style.alignment ?? "center",
    verticalAlignment: style.verticalAlignment ?? "middle",
    wrap: "square",
    autoFit: "shrinkText",
    lineSpacing: style.lineSpacing ?? 1,
    insets: 0,
  };
  return box;
}

function addNode(name, geometry, position, fill, lineFill = fill, lineWidth = 1.5) {
  return slide.shapes.add({
    geometry,
    name,
    position,
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

addText(
  "Slide title",
  "Workflow xử lý và phê duyệt",
  { left: 80, top: 68, width: 1120, height: 68 },
  { fontSize: 52, bold: true, color: c.ink, alignment: "left" },
);
addText(
  "Slide subtitle",
  "Con người quyết định đầu ra. Nếu chưa đạt, họ sửa hoặc yêu cầu xử lý lại.",
  { left: 82, top: 145, width: 1100, height: 42 },
  { fontSize: 24, color: c.body, alignment: "left" },
);

const input = addNode("Đầu vào", "ellipse", { left: 62, top: 276, width: 188, height: 112 }, c.inputFill);
const process = addNode("Xử lý", "rect", { left: 324, top: 264, width: 246, height: 136 }, c.processFill, "#CCD8E2", 1.5);
const decision = addNode("Con người phê duyệt", "diamond", { left: 660, top: 244, width: 220, height: 176 }, c.humanFill, c.human, 2.2);
const output = addNode("Đầu ra", "ellipse", { left: 985, top: 276, width: 235, height: 112 }, c.outputFill);
const rework = addNode("Chỉnh sửa hoặc xử lý lại", "rect", { left: 641, top: 530, width: 258, height: 92 }, c.reworkFill, "#D8CDBB", 1.5);

addText("Input heading", "ĐẦU VÀO", { left: 76, top: 288, width: 160, height: 30 }, { fontSize: 21, bold: true, color: c.ink });
addText("Input detail", "Dữ liệu / tài liệu\nYêu cầu cần xử lý", { left: 77, top: 319, width: 158, height: 54 }, { fontSize: 17, color: c.body, lineSpacing: 1.05 });
addText("Process heading", "XỬ LÝ", { left: 340, top: 280, width: 214, height: 30 }, { fontSize: 22, bold: true, color: c.ink });
addText("Process detail", "Phân tích và tổng hợp\nĐưa ra gợi ý", { left: 342, top: 313, width: 210, height: 64 }, { fontSize: 18, color: c.body, lineSpacing: 1.1 });
addText("Decision text", "CON NGƯỜI\nPHÊ DUYỆT?", { left: 693, top: 290, width: 154, height: 82 }, { fontSize: 23, bold: true, color: c.human, lineSpacing: 0.98 });
addText("Output heading", "ĐẦU RA", { left: 1005, top: 288, width: 195, height: 30 }, { fontSize: 21, bold: true, color: c.outputInk });
addText("Output detail", "Kết quả được duyệt\nSẵn sàng sử dụng", { left: 1005, top: 319, width: 195, height: 54 }, { fontSize: 17, color: c.body, lineSpacing: 1.05 });
addText("Rework heading", "CHƯA ĐẠT", { left: 658, top: 538, width: 224, height: 30 }, { fontSize: 20, bold: true, color: c.ink });
addText("Rework detail", "Sửa hoặc yêu cầu xử lý lại", { left: 653, top: 569, width: 234, height: 34 }, { fontSize: 17, color: c.body });

const arrow = { style: "solid", fill: c.line, width: 2.5 };
slide.shapes.connect(input, process, {
  kind: "straight", fromSide: "right", toSide: "left", line: arrow,
  tail: { type: "triangle", width: "sm", length: "sm" },
});
slide.shapes.connect(process, decision, {
  kind: "straight", fromSide: "right", toSide: "left", line: arrow,
  tail: { type: "triangle", width: "sm", length: "sm" },
});
slide.shapes.connect(decision, output, {
  kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: c.human, width: 2.8 },
  tail: { type: "triangle", width: "sm", length: "sm" },
});
slide.shapes.connect(decision, rework, {
  kind: "straight", fromSide: "bottom", toSide: "top", line: { style: "solid", fill: c.human, width: 2.5 },
  tail: { type: "triangle", width: "sm", length: "sm" },
});
slide.shapes.connect(rework, process, {
  kind: "elbow", fromSide: "left", toSide: "bottom", line: { style: "solid", fill: c.line, width: 2.3 },
  tail: { type: "triangle", width: "sm", length: "sm" },
});

addText("Approved branch label", "CÓ", { left: 918, top: 292, width: 60, height: 28 }, { fontSize: 17, bold: true, color: c.outputInk });
addText("Rework branch label", "CHƯA", { left: 870, top: 447, width: 76, height: 28 }, { fontSize: 17, bold: true, color: c.human });
addText("Loopback label", "CHỈNH SỬA / GỬI LẠI", { left: 361, top: 585, width: 257, height: 30 }, { fontSize: 16, bold: true, color: c.muted });

const preview = await deck.export({ slide, format: "png", scale: 1 });
await fs.writeFile(`${buildDir}/workflow-slide.png`, new Uint8Array(await preview.arrayBuffer()));
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(`${buildDir}/workflow-draft.pptx`);
