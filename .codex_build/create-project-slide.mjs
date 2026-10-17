import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "file:///C:/Users/Nguyen%20Hoang%20Nhan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const workspace = "D:/TRACK_VNGF/academic-escalation-referee";
const buildDir = `${workspace}/.codex_build`;
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slide = deck.slides.add();
slide.background.fill = "#FFF1F3";

const palette = {
  ruby: "#BE123C",
  coral: "#E11D48",
  text: "#181416",
  body: "#5B5153",
  border: "#FFE1E5",
  pale: "#FFF8F9",
  green: "#059669",
  greenText: "#047857",
  amber: "#F59E0B",
  amberText: "#B45309",
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
    color: style.color ?? palette.body,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "top",
    wrap: "square",
    autoFit: "shrinkText",
    lineSpacing: style.lineSpacing ?? 1.08,
    insets: 0,
  };
  return box;
}

function addShape(name, geometry, position, fill, lineFill, lineWidth = 1) {
  return slide.shapes.add({
    geometry,
    name,
    position,
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
    borderRadius: geometry === "roundRect" ? 22 : undefined,
  });
}

const cardY = 34;
const cardHeight = 652;
const cardWidth = 285;
const cardXs = [34, 343, 652, 961];

const steps = [
  {
    number: "01",
    title: "Sinh viên gửi yêu cầu",
    body: "Chọn học phần cụ thể, gửi tình huống và câu hỏi về quy chế, hạn nộp hoặc tỷ lệ điểm.",
  },
  {
    number: "02",
    title: "Hệ thống tiếp nhận và thẩm định",
    body: "AI phân tích biểu mẫu, trích mã môn, đối chiếu điều khoản và kiểm tra dữ kiện học phần.",
  },
  {
    number: "03",
    title: "Phân luồng xử lý",
  },
  {
    number: "04",
    title: "Thông báo và theo dõi kết quả",
    body: "Sinh viên và giảng viên nhận thông báo kết quả kèm biên bản giải trình. Lịch sử được lưu minh bạch trong Audit Trail.",
  },
];

steps.forEach((step, index) => {
  const x = cardXs[index];
  addShape(
    `Step ${step.number} card`,
    "roundRect",
    { left: x, top: cardY, width: cardWidth, height: cardHeight },
    "#FFFFFF",
    index === 2 ? "#FFD0D8" : palette.border,
    index === 2 ? 1.4 : 1,
  ).shadow = "shadow-sm";

  addText(
    `Step ${step.number} number`,
    step.number,
    { left: x + 21, top: cardY + 21, width: 75, height: 54 },
    { fontSize: 42, bold: true, color: palette.coral, lineSpacing: 1 },
  );

  addShape(
    `Step ${step.number} marker`,
    "ellipse",
    { left: x + cardWidth - 33, top: cardY + 33, width: 11, height: 11 },
    index === 2 ? "#FFC9D2" : "#FFE1E5",
    index === 2 ? "#FFC9D2" : "#FFE1E5",
    0,
  );

  addText(
    `Step ${step.number} title`,
    step.title,
    { left: x + 21, top: cardY + 91, width: cardWidth - 42, height: index === 2 ? 42 : 58 },
    { fontSize: index === 2 ? 23 : 22, bold: true, color: palette.text, lineSpacing: 1 },
  );

  if (step.body) {
    addText(
      `Step ${step.number} description`,
      step.body,
      { left: x + 21, top: cardY + 158, width: cardWidth - 42, height: 188 },
      { fontSize: 18, color: palette.body, lineSpacing: 1.18 },
    );
  }

  if (index !== 2) {
    slide.shapes.add({
      geometry: "line",
      name: `Step ${step.number} footer divider`,
      position: { left: x + 21, top: cardY + 570, width: cardWidth - 42, height: 0 },
      fill: "none",
      line: { style: "solid", fill: "#F2E7E9", width: 1 },
    });
    addShape(
      `Step ${step.number} footer accent`,
      "roundRect",
      { left: x + 21, top: cardY + 589, width: 184, height: 7 },
      "#FFE4E8",
      "#FFE4E8",
      0,
    );
  }
});

const thirdX = cardXs[2];
addText(
  "Routing introduction",
  "Hệ thống AI xác định hướng xử lý phù hợp:",
  { left: thirdX + 21, top: cardY + 143, width: cardWidth - 42, height: 48 },
  { fontSize: 17, color: palette.body, lineSpacing: 1.08 },
);

const routes = [
  {
    y: cardY + 203,
    h: 91,
    color: palette.green,
    headingColor: palette.greenText,
    heading: "ĐỦ CĂN CỨ THEO QUY CHẾ",
    body: "AI trả lời theo chính sách môn học, kèm điều khoản trích dẫn.",
  },
  {
    y: cardY + 306,
    h: 91,
    color: palette.amber,
    headingColor: palette.amberText,
    heading: "THIẾU DỮ KIỆN / CHƯA RÕ",
    body: "Yêu cầu sinh viên bổ sung trong tối đa 2 lượt.",
  },
  {
    y: cardY + 409,
    h: 104,
    color: palette.coral,
    headingColor: palette.ruby,
    heading: "NGOÀI PHẠM VI HOẶC NGOẠI LỆ",
    body: "Giảng viên xem xét và đưa ra quyết định cuối cùng. SLA 48 giờ.",
  },
];

routes.forEach((route, index) => {
  const x = thirdX + 20;
  const width = cardWidth - 40;
  addShape(
    `Routing outcome ${index + 1}`,
    "roundRect",
    { left: x, top: route.y, width, height: route.h },
    "#FFF9FA",
    "#FFF1F3",
    0.8,
  ).borderRadius = 18;
  addShape(
    `Routing outcome ${index + 1} accent`,
    "roundRect",
    { left: x, top: route.y + 8, width: 5, height: route.h - 16 },
    route.color,
    route.color,
    0,
  ).borderRadius = 3;
  addText(
    `Routing outcome ${index + 1} heading`,
    route.heading,
    { left: x + 15, top: route.y + 11, width: width - 25, height: 25 },
    { fontSize: 14, bold: true, color: route.headingColor, lineSpacing: 1 },
  );
  addText(
    `Routing outcome ${index + 1} detail`,
    route.body,
    { left: x + 15, top: route.y + 38, width: width - 25, height: route.h - 45 },
    { fontSize: 16, color: palette.body, lineSpacing: 1.08 },
  );
});

slide.shapes.add({
  geometry: "line",
  name: "Step 03 footer divider",
  position: { left: thirdX + 21, top: cardY + 540, width: cardWidth - 42, height: 0 },
  fill: "none",
  line: { style: "solid", fill: "#F2E7E9", width: 1 },
});
addText(
  "Step 03 footer label",
  "XỬ LÝ ĐA LUỒNG THÔNG MINH",
  { left: thirdX + 21, top: cardY + 553, width: cardWidth - 42, height: 37 },
  { fontSize: 15, bold: true, color: palette.ruby, lineSpacing: 1 },
);

const preview = await deck.export({ slide, format: "png", scale: 1 });
await fs.writeFile(`${buildDir}/project-slide.png`, new Uint8Array(await preview.arrayBuffer()));
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(`${buildDir}/project-draft.pptx`);
