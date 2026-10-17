import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "file:///C:/Users/Nguyen%20Hoang%20Nhan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const workspace = "D:/TRACK_VNGF/academic-escalation-referee";
const buildDir = `${workspace}/.codex_build`;

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slide = deck.slides.add();
slide.background.fill = "#F7F5EF";

const colors = {
  ink: "#18324A",
  body: "#526371",
  muted: "#687985",
  connector: "#AAB8C4",
  blueFill: "#E3EBF4",
  blueFill2: "#DCE6F3",
  human: "#C9653B",
  outputFill: "#DDECE5",
  outputInk: "#315D4D",
};

function addText(name, text, position, style) {
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
    fontSize: style.fontSize,
    bold: style.bold ?? false,
    color: style.color,
    alignment: style.alignment ?? "center",
    verticalAlignment: style.verticalAlignment ?? "middle",
    wrap: "square",
    autoFit: "shrinkText",
    lineSpacing: style.lineSpacing ?? 1,
    insets: 0,
  };
  return box;
}

addText(
  "Slide title",
  "Đầu vào → Xử lý → Đầu ra",
  { left: 80, top: 74, width: 1120, height: 72 },
  { fontSize: 54, bold: true, color: colors.ink, alignment: "left" },
);

addText(
  "Slide subtitle",
  "Con người kiểm tra gợi ý và quyết định kết quả cuối cùng.",
  { left: 82, top: 154, width: 1080, height: 42 },
  { fontSize: 25, color: colors.body, alignment: "left" },
);

const centers = [215, 500, 785, 1070];
const nodeY = 276;
const nodeSize = 70;
const nodeColors = [colors.blueFill, colors.blueFill2, colors.human, colors.outputFill];
const numberColors = [colors.ink, colors.ink, "#FFFFFF", colors.outputInk];
const nodeNames = ["Input", "Processing", "Human decision", "Output"];
const nodes = centers.map((center, index) => {
  const node = slide.shapes.add({
    geometry: "ellipse",
    name: nodeNames[index],
    position: { left: center - nodeSize / 2, top: nodeY, width: nodeSize, height: nodeSize },
    fill: nodeColors[index],
    line: { style: "solid", fill: nodeColors[index], width: 1 },
  });
  node.text = `0${index + 1}`;
  node.text.style = {
    typeface: "Arial",
    fontSize: 22,
    bold: true,
    color: numberColors[index],
    alignment: "center",
    verticalAlignment: "middle",
    insets: 0,
  };
  return node;
});

for (let index = 0; index < nodes.length - 1; index += 1) {
  slide.shapes.connect(nodes[index], nodes[index + 1], {
    kind: "straight",
    fromSide: "right",
    toSide: "left",
    line: { style: "solid", fill: colors.connector, width: 2.5 },
    tail: { type: "triangle", width: "sm", length: "sm" },
  });
}

const labels = [
  { title: "ĐẦU VÀO", detail: "Dữ liệu\nTài liệu\nYêu cầu cần xử lý", color: colors.ink },
  { title: "XỬ LÝ", detail: "Phân tích\nTổng hợp\nĐề xuất kết quả", color: colors.ink },
  { title: "CON NGƯỜI\nRA QUYẾT ĐỊNH", detail: "Kiểm tra\nBổ sung ngữ cảnh\nDuyệt, sửa hoặc từ chối", color: colors.human },
  { title: "ĐẦU RA", detail: "Kết quả đã được duyệt\nvà sẵn sàng sử dụng", color: colors.outputInk },
];

labels.forEach((item, index) => {
  const left = centers[index] - 125;
  const titleHeight = index === 2 ? 58 : 40;
  addText(
    `Stage ${index + 1} heading`,
    item.title,
    { left, top: 365, width: 250, height: titleHeight },
    { fontSize: index === 2 ? 23 : 25, bold: true, color: item.color, lineSpacing: 0.95 },
  );
  addText(
    `Stage ${index + 1} detail`,
    item.detail,
    { left: left - 3, top: index === 2 ? 429 : 419, width: 256, height: 120 },
    { fontSize: 21, color: colors.body, lineSpacing: 1.12 },
  );
});

const png = await deck.export({ slide, format: "png", scale: 1 });
await writeBlob(`${buildDir}/slide-01.png`, png);
const draft = await PresentationFile.exportPptx(deck);
await draft.save(`${buildDir}/draft.pptx`);
