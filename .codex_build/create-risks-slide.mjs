import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "file:///C:/Users/Nguyen%20Hoang%20Nhan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const workspace = "D:/TRACK_VNGF/academic-escalation-referee";
const buildDir = workspace + "/.codex_build";
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slide = deck.slides.add();
slide.background.fill = "#F8FAFF";

const c = {
  ink: "#18235B", body: "#40517A", muted: "#65749A", blue: "#3196F4",
  blueLine: "#C9E2FF", paleBlue: "#EFF7FF", violet: "#7659F6",
  violetLine: "#D8D1FF", paleViolet: "#F3F1FF", green: "#169C78",
  greenLine: "#B9EBDC", paleGreen: "#ECFAF5", amber: "#C77912",
  amberLine: "#F6D49B", paleAmber: "#FFF7E9", red: "#D74766",
  redLine: "#F4C8D2", paleRed: "#FFF1F4", white: "#FFFFFF",
  border: "#DFE7F2",
};

function text(name, value, pos, style = {}) {
  const shape = slide.shapes.add({ geometry: "textbox", name, position: pos, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  shape.text = value;
  shape.text.style = {
    typeface: "Arial", fontSize: style.fontSize || 14, bold: style.bold || false,
    color: style.color || c.body, alignment: style.alignment || "left",
    verticalAlignment: "middle", wrap: "square", autoFit: "shrinkText",
    lineSpacing: style.lineSpacing || 1.02, insets: 0,
  };
  return shape;
}

function shape(name, geometry, pos, fill, stroke, width) {
  return slide.shapes.add({ geometry, name, position: pos, fill, line: { style: "solid", fill: stroke || fill, width: width === undefined ? 1 : width } });
}

function pill(name, label, x, y, w, fill, color, stroke) {
  shape(name + " bg", "roundRect", { left: x, top: y, width: w, height: 22 }, fill, stroke || fill, 0.8);
  text(name + " label", label, { left: x + 7, top: y + 1, width: w - 14, height: 20 }, { fontSize: 10.8, bold: true, color, alignment: "center" });
}

function cell(name, x, y, w, h, accent) {
  shape(name + " bg", "roundRect", { left: x, top: y, width: w, height: h }, c.white, c.border, 0.9);
  shape(name + " accent", "roundRect", { left: x, top: y, width: 5, height: h }, accent, accent, 0);
}

function addRow(index, y, accent, tint, label, risk, next) {
  const rowH = 92;
  cell("Row " + index + " category", 48, y, 178, rowH, accent);
  shape("Row " + index + " category tint", "roundRect", { left: 56, top: y + 1, width: 168, height: rowH - 2 }, tint, tint, 0);
  text("Row " + index + " category label", label, { left: 68, top: y + 11, width: 145, height: 67 }, { fontSize: 15, bold: true, color: accent, lineSpacing: 1.0 });

  cell("Row " + index + " risk", 239, y, 496, rowH, accent);
  text("Row " + index + " risk text", risk, { left: 256, top: y + 11, width: 462, height: 70 }, { fontSize: 13.1, color: c.body, lineSpacing: 1.02 });

  cell("Row " + index + " next", 748, y, 484, rowH, c.green);
  text("Row " + index + " next text", next, { left: 765, top: y + 11, width: 450, height: 70 }, { fontSize: 13.1, color: c.body, lineSpacing: 1.02 });
}

text("Eyebrow", "AER AI REFEREE  •  RỦI RO & QUẢN TRỊ", { left: 50, top: 22, width: 450, height: 22 }, { fontSize: 14, bold: true, color: c.blue });
text("Title", "Giới hạn, rủi ro & hướng xử lý tiếp theo", { left: 50, top: 48, width: 1170, height: 43 }, { fontSize: 34, bold: true, color: c.ink });
text("Subtitle", "Các điểm cần kiểm soát trước khi mở rộng từ bản demo sang vận hành thực tế.", { left: 52, top: 96, width: 1160, height: 25 }, { fontSize: 16.5, color: c.muted });

shape("Table header", "roundRect", { left: 48, top: 141, width: 1184, height: 40 }, c.ink, c.ink, 0);
text("Header category", "KHU VỰC", { left: 66, top: 149, width: 145, height: 23 }, { fontSize: 12, bold: true, color: c.white });
text("Header limit", "GIỚI HẠN / RỦI RO HIỆN TẠI", { left: 256, top: 149, width: 460, height: 23 }, { fontSize: 12, bold: true, color: c.white });
text("Header direction", "HƯỚNG XỬ LÝ ĐỀ XUẤT", { left: 765, top: 149, width: 450, height: 23 }, { fontSize: 12, bold: true, color: c.white });

addRow(
  1, 190, c.red, c.paleRed, "AI &\nnhà cung cấp",
  "Gemini cần API key, mạng và quota. Khi AI không khả dụng, hệ thống đánh dấu AI_UNAVAILABLE và chuyển ca sang ESCALATE; không thể bảo đảm trả lời tự động.",
  "Theo dõi health, lỗi, quota và độ trễ; bổ sung retry có giới hạn/cảnh báo; giữ đường lui an toàn sang giảng viên khi AI lỗi.",
);
addRow(
  2, 290, c.amber, c.paleAmber, "Quy chế,\nRAG & OCR",
  "RAG chỉ dựa trên tài liệu đã nạp; bộ demo dùng tài liệu mẫu. PDF scan/OCR có thể trích sai; nội dung thiếu hoặc cũ làm giảm độ tin cậy. OCR confidence thấp cần người xác nhận.",
  "Dùng kho quy chế chính thức và chủ tài liệu; quản lý phiên bản/ngày hiệu lực; duyệt kết quả OCR thấp rồi mới re-index/công bố.",
);
addRow(
  3, 390, c.blue, c.paleBlue, "File &\nlưu trữ",
  "File tải lên và ảnh crop review lưu trên local filesystem. Repo chưa cấu hình object storage/backup cho cloud; nếu dùng ổ đĩa tạm, redeploy có thể làm mất file.",
  "Chuyển file sang storage bền vững; bổ sung backup/restore, retention và kiểm soát quyền; kiểm tra dữ liệu sau redeploy.",
);
addRow(
  4, 490, c.violet, c.paleViolet, "Vận hành &\nđánh giá",
  "Local demo có role switch; luồng case hiện gắn reviewer lecturer-01. Bộ harness tĩnh giúp kiểm tra luồng nhưng chưa thay cho pilot trên câu hỏi thực tế.",
  "Provision tài khoản thật và phân công nhiều reviewer; chạy pilot có giám sát, đánh giá route, citation, thời gian phản hồi và tỷ lệ escalation.",
);

shape("Next steps panel", "roundRect", { left: 48, top: 597, width: 1184, height: 98 }, c.paleViolet, c.violetLine, 1.0);
text("Next steps heading", "ƯU TIÊN ĐỀ XUẤT TRƯỚC KHI MỞ RỘNG", { left: 68, top: 607, width: 520, height: 20 }, { fontSize: 12.3, bold: true, color: c.violet });
text("Next steps chain", "Nguồn quy chế chính thức  →  lưu trữ bền vững  →  phân công reviewer thật  →  pilot & đánh giá thực tế", { left: 68, top: 631, width: 1135, height: 26 }, { fontSize: 15, bold: true, color: c.ink });
text("Safety note", "Guardrail hiện có: AI_UNAVAILABLE / NO_POLICY → ESCALATE; quyết định cuối vẫn do giảng viên.", { left: 68, top: 663, width: 1135, height: 21 }, { fontSize: 12.6, color: c.body });

slide.speakerNotes.text = "Căn cứ từ backend/app/ai/factory.py, backend/app/services/questions.py (_safe_ai_failure), backend/app/core/config.py (timeout/concurrency, local_document_storage_dir, AUTH_MODE), backend/app/ingestion/local_processing.py (confidence review), backend/app/api/routes/documents.py (_store_upload), backend/app/services/cases.py (_validate_reviewer), harness/datasets/evaluation.jsonl và docker/Render deployment config. Các hướng xử lý trên là khuyến nghị, không mô tả tính năng đã triển khai. Repo đã có fallback AI_UNAVAILABLE -> ESCALATE và quy trình review OCR confidence thấp. Tài liệu demo là sample docs; không có tích hợp LMS/SIS được xác nhận. Upload/crop hiện lưu local; chưa thấy cấu hình persistent object storage hoặc backup cloud trong repo. Case reviewer hiện giới hạn lecturer-01. Harness có bộ scenario tĩnh, chưa có dữ liệu pilot thực địa.";

const preview = await deck.export({ slide, format: "png", scale: 1 });
await fs.writeFile(buildDir + "/aer-limitations-risks-preview.png", new Uint8Array(await preview.arrayBuffer()));
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(buildDir + "/aer-limitations-risks-draft.pptx");
