import fs from "node:fs/promises";
import { Presentation } from "file:///C:/Users/Nguyen%20Hoang%20Nhan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const workspace = "D:/TRACK_VNGF/academic-escalation-referee";
const deck = Presentation.create({ slideSize: { width: 650, height: 760 } });
const slide = deck.slides.add();
slide.background.fill = "#F9FCFF";

const c = {
  ink: "#173C72",
  body: "#526D94",
  blue: "#4299F4",
  border: "#B9DEFF",
  pale: "#F4F9FF",
  header: "#EAF5FF",
  white: "#FFFFFF",
};

function addShape(name, geometry, position, fill, lineFill = fill, lineWidth = 1) {
  return slide.shapes.add({
    geometry, name, position, fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

function addText(name, text, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox", name, position,
    fill: "none", line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: "Arial",
    fontSize: style.fontSize ?? 22,
    bold: style.bold ?? false,
    color: style.color ?? c.body,
    alignment: style.alignment ?? "left",
    verticalAlignment: "middle",
    wrap: "square",
    autoFit: "shrinkText",
    lineSpacing: style.lineSpacing ?? 1.08,
    insets: 0,
  };
  return shape;
}

// Tall, standalone crop matching the supplied input panel.
addShape("Input card", "roundRect", { left: 22, top: 22, width: 606, height: 738 }, c.pale, c.border, 2.2);
addShape("Input header round top", "roundRect", { left: 24, top: 24, width: 602, height: 254 }, c.header, c.header, 0);
addShape("Input header square base", "rect", { left: 24, top: 152, width: 602, height: 124 }, c.header, c.header, 0);

// Chat badge with a simple white message glyph.
addShape("Message badge", "ellipse", { left: 50, top: 40, width: 108, height: 108 }, c.blue, c.blue, 0);
addShape("Message bubble", "roundRect", { left: 81, top: 69, width: 49, height: 37 }, "none", c.white, 4);
addShape("Message tail", "triangle", { left: 82, top: 96, width: 19, height: 18, rotation: 198 }, c.white, c.white, 0);
addShape("Message tail inner", "triangle", { left: 87, top: 95, width: 13, height: 12, rotation: 198 }, c.blue, c.blue, 0);
addShape("Message dot 1", "ellipse", { left: 91, top: 85, width: 5, height: 5 }, c.white, c.white, 0);
addShape("Message dot 2", "ellipse", { left: 102, top: 85, width: 5, height: 5 }, c.white, c.white, 0);
addShape("Message dot 3", "ellipse", { left: 113, top: 85, width: 5, height: 5 }, c.white, c.white, 0);

addText("Heading", "Đầu vào", { left: 203, top: 54, width: 365, height: 60 }, { fontSize: 42, bold: true, color: c.ink });
addText("Description", "Người dùng chỉ cần đặt câu hỏi / yêu cầu\nliên quan đến học vụ.", { left: 60, top: 159, width: 530, height: 79 }, { fontSize: 25, color: c.body, lineSpacing: 1.17 });

// Example question card.
addShape("Example card", "roundRect", { left: 59, top: 307, width: 533, height: 209 }, c.white, c.border, 2.2);
addShape("User badge", "ellipse", { left: 80, top: 337, width: 80, height: 80 }, c.blue, c.blue, 0);
addShape("User head", "ellipse", { left: 109, top: 354, width: 22, height: 22 }, c.white, c.white, 0);
addShape("User shoulders", "roundRect", { left: 99, top: 381, width: 42, height: 23 }, c.white, c.white, 0);
addText("Example label", "Ví dụ:", { left: 192, top: 340, width: 340, height: 35 }, { fontSize: 27, bold: true, color: c.ink });
addText("Example question", "“Em có thể nộp bài trễ trong\ntrường hợp nào không?”", { left: 192, top: 385, width: 365, height: 89 }, { fontSize: 24, color: c.body, lineSpacing: 1.13 });

// Short connector stub indicates the next workflow stage.
slide.shapes.add({
  geometry: "connector",
  kind: "straight",
  position: { left: 628, top: 380, width: 22, height: 0 },
  line: { style: "solid", fill: c.blue, width: 2.5 },
  tail: { type: "triangle", width: "sm", length: "sm" },
}).bringToFront();

const png = await slide.export({ format: "png", scale: 1 });
await fs.writeFile(`${workspace}/deliverables/aer-input-panel.png`, new Uint8Array(await png.arrayBuffer()));
