import fs from "node:fs/promises";
import { Presentation } from "file:///C:/Users/Nguyen%20Hoang%20Nhan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const workspace = "D:/TRACK_VNGF/academic-escalation-referee";
const deck = Presentation.create({ slideSize: { width: 640, height: 1050 } });
const slide = deck.slides.add();
slide.background.fill = "#F9FCFB";

const c = {
  ink: "#075C4A",
  body: "#477568",
  green: "#169C78",
  border: "#B9EBDC",
  pale: "#F4FBF8",
  header: "#E8F7F1",
  card: "#EFF9F5",
  white: "#FFFFFF",
  blue: "#4058B8",
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
    fontSize: style.fontSize ?? 18,
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

function addIconCircle(name, x, y, size = 68) {
  addShape(`${name} badge`, "ellipse", { left: x, top: y, width: size, height: size }, c.green, c.green, 0);
}

function addChatIcon(x, y) {
  addShape("Response chat outline", "roundRect", { left: x + 18, top: y + 19, width: 34, height: 26 }, "none", c.white, 2.5);
  addShape("Response chat dot one", "ellipse", { left: x + 27, top: y + 30, width: 4, height: 4 }, c.white, c.white, 0);
  addShape("Response chat dot two", "ellipse", { left: x + 34, top: y + 30, width: 4, height: 4 }, c.white, c.white, 0);
  addShape("Response chat dot three", "ellipse", { left: x + 41, top: y + 30, width: 4, height: 4 }, c.white, c.white, 0);
}

function addDocumentIcon(prefix, x, y) {
  addShape(`${prefix} document outline`, "roundRect", { left: x + 23, top: y + 16, width: 27, height: 37 }, "none", c.white, 2.3);
  addShape(`${prefix} document line one`, "rect", { left: x + 29, top: y + 27, width: 15, height: 2 }, c.white, c.white, 0);
  addShape(`${prefix} document line two`, "rect", { left: x + 29, top: y + 34, width: 15, height: 2 }, c.white, c.white, 0);
  addShape(`${prefix} document line three`, "rect", { left: x + 29, top: y + 41, width: 11, height: 2 }, c.white, c.white, 0);
}

function addPeopleIcon(x, y) {
  addShape("Decision center head", "ellipse", { left: x + 29, top: y + 15, width: 12, height: 12 }, c.white, c.white, 0);
  addShape("Decision left head", "ellipse", { left: x + 16, top: y + 22, width: 9, height: 9 }, c.white, c.white, 0);
  addShape("Decision right head", "ellipse", { left: x + 45, top: y + 22, width: 9, height: 9 }, c.white, c.white, 0);
  addShape("Decision center shoulders", "roundRect", { left: x + 24, top: y + 31, width: 22, height: 16 }, c.white, c.white, 0);
  addShape("Decision left shoulders", "roundRect", { left: x + 12, top: y + 34, width: 14, height: 12 }, c.white, c.white, 0);
  addShape("Decision right shoulders", "roundRect", { left: x + 44, top: y + 34, width: 14, height: 12 }, c.white, c.white, 0);
}

function addOutputCard(name, title, detail, top, iconType) {
  const x = 38;
  const y = top;
  addShape(`${name} card`, "roundRect", { left: x, top: y, width: 564, height: 148 }, c.card, "#D5EFE5", 1.3);
  const iconX = x + 24;
  const iconY = y + 39;
  addIconCircle(name, iconX, iconY);
  if (iconType === "chat") addChatIcon(iconX, iconY);
  if (iconType === "document") addDocumentIcon(name, iconX, iconY);
  if (iconType === "people") addPeopleIcon(iconX, iconY);
  addText(`${name} title`, title, { left: x + 113, top: y + 27, width: 424, height: 32 }, { fontSize: 21, bold: true, color: c.ink });
  addText(`${name} detail`, detail, { left: x + 113, top: y + 64, width: 424, height: 61 }, { fontSize: 16, color: c.body, lineSpacing: 1.08 });
}

// Standalone output panel with a pale green header and four stacked outcomes.
addShape("Output panel", "roundRect", { left: 16, top: 18, width: 608, height: 1014 }, c.pale, c.border, 2.0);
addShape("Output header round top", "roundRect", { left: 18, top: 20, width: 604, height: 190 }, c.header, c.header, 0);
addShape("Output header square base", "rect", { left: 18, top: 112, width: 604, height: 96 }, c.header, c.header, 0);

addIconCircle("Output heading icon", 38, 38, 62);
addText("Output checkmark", "✓", { left: 38, top: 38, width: 62, height: 60 }, { fontSize: 31, bold: true, color: c.white, alignment: "center" });
addText("Output heading", "Đầu ra", { left: 121, top: 44, width: 450, height: 47 }, { fontSize: 30, bold: true, color: c.ink });
addText("Output description", "Kết quả và phản hồi được trả về cho người dùng\nkèm theo căn cứ minh bạch.", { left: 36, top: 112, width: 565, height: 62 }, { fontSize: 16.5, color: c.body, lineSpacing: 1.08 });

addOutputCard("Response", "Trả lời câu hỏi / yêu cầu", "Rõ ràng, dễ hiểu, kèm theo điều khoản quy chế liên quan.", 228, "chat");
addOutputCard("Policy basis", "Căn cứ quy chế", "Đường dẫn hoặc trích dẫn điều khoản cụ thể.", 392, "document");
addOutputCard("Decision", "Xác nhận quyết định", "Từ AI (tự động) hoặc giảng viên trong trường hợp cần xem xét.", 556, "people");
addOutputCard("Activity log", "Lưu nhật ký hoạt động", "Đảm bảo minh bạch và dễ truy vết.", 720, "document");

// Continuation arrow enters the output panel from the left.
slide.shapes.add({
  geometry: "connector",
  kind: "straight",
  position: { left: 0, top: 484, width: 17, height: 0 },
  line: { style: "solid", fill: c.blue, width: 2.2 },
  tail: { type: "triangle", width: "sm", length: "sm" },
}).bringToFront();

const png = await slide.export({ format: "png", scale: 1 });
await fs.writeFile(`${workspace}/deliverables/aer-output-panel.png`, new Uint8Array(await png.arrayBuffer()));
