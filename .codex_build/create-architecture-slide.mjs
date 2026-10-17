import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "file:///C:/Users/Nguyen%20Hoang%20Nhan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const workspace = "D:/TRACK_VNGF/academic-escalation-referee";
const buildDir = workspace + "/.codex_build";
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slide = deck.slides.add();
slide.background.fill = "#F7F9FE";

const c = {
  ink: "#18235B", body: "#40517A", muted: "#65749A", blue: "#3196F4",
  blueLine: "#C9E2FF", paleBlue: "#EFF7FF", violet: "#7659F6",
  violetLine: "#D8D1FF", paleViolet: "#F3F1FF", green: "#169C78",
  greenLine: "#B9EBDC", paleGreen: "#ECFAF5", amber: "#C77912",
  amberLine: "#F6D49B", paleAmber: "#FFF7E9", white: "#FFFFFF",
  border: "#DFE7F2", soft: "#F5F7FB",
};

function text(name, value, pos, style) {
  const shape = slide.shapes.add({ geometry: "textbox", name, position: pos, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  shape.text = value;
  shape.text.style = {
    typeface: "Arial", fontSize: style.fontSize || 15, bold: style.bold || false,
    color: style.color || c.body, alignment: style.alignment || "left",
    verticalAlignment: "middle", wrap: "square", autoFit: "shrinkText",
    lineSpacing: style.lineSpacing || 1.02, insets: 0,
  };
  return shape;
}

function shape(name, geometry, pos, fill, stroke, width) {
  return slide.shapes.add({ geometry, name, position: pos, fill, line: { style: "solid", fill: stroke || fill, width: width === undefined ? 1 : width } });
}

function card(name, x, y, w, h, accent, tint) {
  shape(name + " card", "roundRect", { left: x, top: y, width: w, height: h }, c.white, c.border, 1.1);
  shape(name + " bar", "roundRect", { left: x, top: y, width: 6, height: h }, accent, accent, 0);
  if (tint) shape(name + " tint", "roundRect", { left: x + 8, top: y + 1, width: w - 10, height: h - 2 }, tint, tint, 0);
}

function badge(name, label, x, y, w, fill, color, stroke) {
  shape(name + " bg", "roundRect", { left: x, top: y, width: w, height: 24 }, fill, stroke || fill, 0.8);
  text(name + " label", label, { left: x + 8, top: y + 1, width: w - 16, height: 21 }, { fontSize: 11.5, bold: true, color, alignment: "center" });
}

text("Eyebrow", "AER AI REFEREE  •  SYSTEM DESIGN", { left: 50, top: 23, width: 410, height: 22 }, { fontSize: 14, bold: true, color: c.blue });
text("Title", "Kiến trúc hệ thống & mô hình triển khai", { left: 50, top: 48, width: 1165, height: 43 }, { fontSize: 34, bold: true, color: c.ink });
text("Subtitle", "Phân biệt phần mềm đã có trong repo, cấu hình triển khai và phần demo / giả lập.", { left: 52, top: 96, width: 1160, height: 25 }, { fontSize: 16.5, color: c.muted });

shape("Architecture panel", "roundRect", { left: 48, top: 140, width: 795, height: 480 }, c.white, c.border, 1.1);
text("Architecture heading", "KIẾN TRÚC ỨNG DỤNG", { left: 68, top: 151, width: 340, height: 24 }, { fontSize: 14, bold: true, color: c.ink });
badge("Implemented badge", "ĐÃ CÓ TRONG CODE", 654, 151, 166, c.paleBlue, c.blue, c.blueLine);

card("Actors", 68, 190, 150, 100, c.blue, null);
text("Actors overline", "ACTORS", { left: 82, top: 199, width: 118, height: 17 }, { fontSize: 11.5, bold: true, color: c.blue });
text("Actors title", "Người dùng", { left: 82, top: 217, width: 122, height: 24 }, { fontSize: 17, bold: true, color: c.ink });
text("Actors body", "Sinh viên • Giảng viên\nPhòng Đào tạo", { left: 82, top: 242, width: 124, height: 33 }, { fontSize: 12.5, color: c.body });

card("Web app", 248, 190, 190, 100, c.blue, null);
text("Web app overline", "WEB APP", { left: 264, top: 199, width: 156, height: 17 }, { fontSize: 11.5, bold: true, color: c.blue });
text("Web app title", "React + TypeScript", { left: 264, top: 217, width: 164, height: 24 }, { fontSize: 16.5, bold: true, color: c.ink });
text("Web app body", "Gửi câu hỏi • lịch sử\nInbox giảng viên", { left: 264, top: 243, width: 164, height: 33 }, { fontSize: 12.5, color: c.body });

card("API", 485, 190, 325, 100, c.violet, null);
text("API overline", "API / ORCHESTRATION", { left: 502, top: 199, width: 286, height: 17 }, { fontSize: 11.5, bold: true, color: c.violet });
text("API title", "FastAPI • REST", { left: 502, top: 217, width: 286, height: 25 }, { fontSize: 17.5, bold: true, color: c.ink });
text("API body", "Xác thực • tiếp nhận • điều phối", { left: 502, top: 245, width: 286, height: 25 }, { fontSize: 13, color: c.body });
text("Arrow actors web", "→", { left: 220, top: 221, width: 24, height: 30 }, { fontSize: 23, bold: true, color: c.blue, alignment: "center" });
text("Arrow web api", "→", { left: 442, top: 221, width: 30, height: 30 }, { fontSize: 23, bold: true, color: c.violet, alignment: "center" });

card("Data store", 68, 320, 360, 116, c.blue, null);
text("Data overline", "LƯU TRỮ • HẠ TẦNG THẬT", { left: 84, top: 329, width: 328, height: 18 }, { fontSize: 11.5, bold: true, color: c.blue });
text("Data title", "PostgreSQL 16 + pgvector", { left: 84, top: 349, width: 328, height: 25 }, { fontSize: 17, bold: true, color: c.ink });
text("Data body", "Câu hỏi • hồ sơ • tài liệu • chunks vector • audit.\nDB thật trong Docker Compose; nội dung hiện là dữ liệu mẫu.", { left: 84, top: 378, width: 326, height: 48 }, { fontSize: 12.8, color: c.body, lineSpacing: 1.0 });

card("Business services", 475, 320, 335, 157, c.violet, null);
text("Services overline", "BACKEND SERVICES • ĐÃ IMPLEMENT", { left: 492, top: 329, width: 300, height: 18 }, { fontSize: 11.2, bold: true, color: c.violet });
text("Services title", "Xử lý nghiệp vụ", { left: 492, top: 349, width: 300, height: 26 }, { fontSize: 18, bold: true, color: c.ink });
text("Services body", "• Câu hỏi → ANSWER / CLARIFY / ESCALATE\n• RAG + trích dẫn điều khoản\n• Hồ sơ, ngoại lệ và Audit Trail", { left: 492, top: 380, width: 300, height: 77 }, { fontSize: 13, color: c.body, lineSpacing: 1.02 });
text("API to services", "↓", { left: 632, top: 290, width: 30, height: 30 }, { fontSize: 21, bold: true, color: c.violet, alignment: "center" });
text("Services to data", "←", { left: 430, top: 351, width: 40, height: 30 }, { fontSize: 22, bold: true, color: c.blue, alignment: "center" });

card("AI providers", 68, 454, 360, 144, c.green, null);
text("AI overline", "AI PROVIDER • CHỌN THEO CẤU HÌNH", { left: 84, top: 461, width: 328, height: 18 }, { fontSize: 11.2, bold: true, color: c.green });
shape("Gemini row", "roundRect", { left: 84, top: 484, width: 328, height: 42 }, c.paleGreen, c.greenLine, 0.9);
text("Gemini label", "Gemini API • dịch vụ thật", { left: 94, top: 487, width: 308, height: 17 }, { fontSize: 12.4, bold: true, color: c.green });
text("Gemini detail", "Chỉ dùng khi AI_MODE=gemini và có API key.", { left: 94, top: 504, width: 308, height: 17 }, { fontSize: 11.8, color: c.body });
shape("Fake row", "roundRect", { left: 84, top: 534, width: 328, height: 42 }, c.paleAmber, c.amberLine, 0.9);
text("Fake label", "FakeProvider • mô phỏng dev/test", { left: 94, top: 537, width: 308, height: 17 }, { fontSize: 12.3, bold: true, color: c.amber });
text("Fake detail", "Quy tắc xác định; không phải Gemini thật.", { left: 94, top: 554, width: 308, height: 17 }, { fontSize: 11.8, color: c.body });
text("AI note", "Fake mode hiện dùng truy xuất từ khóa.", { left: 84, top: 580, width: 328, height: 15 }, { fontSize: 11, color: c.muted });
text("Services to AI", "←", { left: 430, top: 506, width: 40, height: 30 }, { fontSize: 22, bold: true, color: c.green, alignment: "center" });

card("Human review", 475, 495, 335, 103, c.green, null);
text("Human overline", "HUMAN-IN-THE-LOOP • CÓ LUỒNG DUYỆT", { left: 492, top: 501, width: 300, height: 18 }, { fontSize: 11.1, bold: true, color: c.green });
text("Human title", "Giảng viên giữ quyết định cuối", { left: 492, top: 520, width: 300, height: 24 }, { fontSize: 15.5, bold: true, color: c.ink });
text("Human body", "Case ESCALATE → inbox → duyệt / từ chối / hỏi thêm; ghi audit. Reviewer hiện dùng tài khoản demo lecturer-01.", { left: 492, top: 547, width: 300, height: 42 }, { fontSize: 11.8, color: c.body, lineSpacing: 1.0 });
text("Escalation arrow", "↓", { left: 632, top: 474, width: 30, height: 21 }, { fontSize: 17, bold: true, color: c.green, alignment: "center" });

shape("Deployment panel", "roundRect", { left: 865, top: 140, width: 367, height: 480 }, c.white, c.border, 1.1);
text("Deployment heading", "MÔ HÌNH TRIỂN KHAI", { left: 885, top: 151, width: 320, height: 24 }, { fontSize: 14, bold: true, color: c.ink });

shape("Local deployment card", "roundRect", { left: 885, top: 190, width: 327, height: 188 }, c.paleBlue, c.blueLine, 1.1);
badge("Local badge", "LOCAL / DEMO", 902, 202, 120, c.blue, c.white, c.blue);
text("Local title", "Docker Compose", { left: 902, top: 232, width: 286, height: 27 }, { fontSize: 18, bold: true, color: c.ink });
text("Local stack", "web  •  React build + Nginx\napi   •  FastAPI\ndb    •  PostgreSQL 16 + pgvector", { left: 902, top: 264, width: 286, height: 65 }, { fontSize: 13, color: c.body, lineSpacing: 1.05 });
shape("Local demo note bg", "roundRect", { left: 902, top: 336, width: 293, height: 29 }, c.paleAmber, c.amberLine, 0.7);
text("Local demo note", "Mặc định: AI fake • role switch • dữ liệu seed", { left: 911, top: 339, width: 275, height: 22 }, { fontSize: 11.3, bold: true, color: c.amber, alignment: "center" });

shape("Production deployment card", "roundRect", { left: 885, top: 394, width: 327, height: 205 }, c.white, c.amberLine, 1.2);
badge("Production badge", "PRODUCTION TARGET", 902, 406, 164, c.paleAmber, c.amber, c.amberLine);
text("Production title", "Vercel → Render → PostgreSQL", { left: 902, top: 436, width: 292, height: 27 }, { fontSize: 15.7, bold: true, color: c.ink });
text("Production stack", "Web: Vercel  →  API: Render\nDB: PostgreSQL có pgvector\nAI_MODE=gemini • AUTH_MODE=password", { left: 902, top: 468, width: 292, height: 63 }, { fontSize: 12.7, color: c.body, lineSpacing: 1.04 });
shape("Production caveat bg", "roundRect", { left: 902, top: 538, width: 293, height: 47 }, c.paleAmber, c.amberLine, 0.7);
text("Production caveat", "Repo có cấu hình deployment; chưa xác nhận cloud đang chạy/live.", { left: 911, top: 542, width: 275, height: 39 }, { fontSize: 11.7, bold: true, color: c.amber, alignment: "center" });

shape("Legend panel", "roundRect", { left: 48, top: 637, width: 1184, height: 64 }, c.white, c.border, 1.0);
badge("Legend implemented", "CÓ CODE / HẠ TẦNG LOCAL", 62, 645, 227, c.paleBlue, c.blue, c.blueLine);
badge("Legend simulated", "GIẢ LẬP: AI fake + data seed", 300, 645, 240, c.paleAmber, c.amber, c.amberLine);
badge("Legend cloud", "CLOUD: cấu hình có, live chưa xác minh", 551, 645, 300, c.soft, c.muted, c.border);
text("Data caveat", "Tài khoản, môn học, policy docs đang là seed/demo; chưa thấy kết nối LMS/SIS trong repo.", { left: 62, top: 674, width: 1146, height: 18 }, { fontSize: 12.5, color: c.body });

slide.speakerNotes.text = "Phân loại dựa trên README.md, PROJECT_OVERVIEW.md, DEPLOYMENT.md, docker-compose.yml, render.yaml, backend/app/core/config.py, backend/app/ai/factory.py, backend/app/ai/fake.py, backend/app/services/cases.py, data/demo-config.json. React frontend, FastAPI backend, nghiệp vụ, human decision flow, audit và PostgreSQL/pgvector support có trong repo. Docker Compose định nghĩa 3 service web/api/postgres cho local. AI_MODE mặc định fake; Gemini chỉ chạy khi cấu hình AI_MODE=gemini và có key. FakeProvider là provider deterministic cho dev/test; fake mode dùng keyword retrieval. Tài khoản/course/group và tài liệu sample được seed/demo. Human decision flow có code nhưng reviewer validation hiện ràng buộc lecturer-01. render.yaml + DEPLOYMENT.md cấu hình mục tiêu Render API + Vercel web + DB ngoài có pgvector; chưa có bằng chứng trong repo rằng cloud đang live. Không thấy tích hợp LMS/SIS trong cấu hình đã rà.";

const preview = await deck.export({ slide, format: "png", scale: 1 });
await fs.writeFile(buildDir + "/architecture-deployment-preview.png", new Uint8Array(await preview.arrayBuffer()));
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(buildDir + "/architecture-deployment-draft.pptx");
