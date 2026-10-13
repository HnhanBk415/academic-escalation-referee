# Prompt sửa Frontend AER — chia 5 bước

> Chạy **lần lượt** từng prompt trong Antigravity, mỗi prompt một phiên (hoặc một lượt) riêng.
> Sau mỗi bước: `cd frontend && npm run build`, build lại Docker (`docker compose up -d --build web api`) và kiểm tra tay trước khi sang bước tiếp theo.
> Thứ tự: 1 (bug nhỏ) → 2 (tính năng tiếp nhận quy định, có backend) → 3 (khung app mới) → 4 (trang Sinh viên) → 5 (trang Giảng viên + Audit/Verify).

---

## PROMPT 1 — Sửa lỗi bar chart tràn ở Verify Harness

```
Bối cảnh: Repo React + Vite + TypeScript tại frontend/. Styling dùng Tailwind CDN (index.html) + CSS thuần trong frontend/src/styles.css. KHÔNG thêm thư viện mới.

Lỗi: Ở trang Verify Harness (frontend/src/pages/VerifyPage.tsx), sau khi bấm "Chạy toàn bộ Verify", card "Tổng thời gian xử lý" vẽ bar chart 16 cột (verify_001..016). Các cột cuối (013–016) tràn ra ngoài viền phải của card và làm cả trang xuất hiện thanh cuộn ngang.

Nguyên nhân đã xác minh trong frontend/src/styles.css:
- .verify-summary-grid dùng grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)). Grid item mặc định min-width:auto nên card bị nội dung đẩy rộng ra.
- .metric-card là display:grid với cột ngầm định, không có min-width:0 / overflow.
- .bar-chart là flex với gap:6px; .bar-item có flex:1 nhưng KHÔNG có min-width:0, nên mỗi cột không thể co nhỏ hơn bề rộng nhãn .bar-label ("001", "016"...). 16 nhãn + 15 gap 6px > bề rộng nội dung card (~260px) → tràn.

Yêu cầu sửa (chỉ CSS + chút JSX trong VerifyPage.tsx):
1. .verify-summary-grid: dùng repeat(auto-fit, minmax(min(220px, 100%), 1fr)); thêm min-width:0 cho .metric-card và overflow:hidden.
2. .metric-card: grid-template-columns: minmax(0, 1fr).
3. .bar-chart: gap 2px, width 100%, min-width:0. .bar-item: min-width:0; flex: 1 1 0.
4. Nhãn trục X: chỉ hiển thị nhãn cho cột 1, 5, 10, 15 và cột cuối (các cột khác render nhãn rỗng nhưng vẫn giữ chiều cao để cột thẳng hàng). Tooltip title giữ nguyên "verify_0xx: N ms".
5. Đảm bảo bảng kết quả (.verify-table) không gây cuộn ngang toàn trang: chỉ .table-wrap được cuộn ngang khi màn hình hẹp. Cột "Nội dung câu hỏi" cho phép xuống dòng (white-space: normal), không ép min-width 240px ở cột đầu — giảm còn 160px.
6. Không thay đổi logic chạy test, tiêu chí PASS/FAIL, hay danh sách CASES.

Kiểm tra chấp nhận:
- Ở viewport 1280px, 1440px, 1920px và 768px: sau khi chạy đủ 16 case, toàn bộ 16 cột nằm trong card, không có thanh cuộn ngang ở cấp trang (document.documentElement.scrollWidth === clientWidth).
- npm run build pass.
```

---

## PROMPT 2 — Tiếp nhận quy định: Hủy bản nháp, phát hiện xung đột, nút quay lại

```
Bối cảnh: Hệ thống AER (FastAPI + SQLAlchemy async + PostgreSQL ở backend/, React ở frontend/). Tính năng "Tiếp nhận quy định" cho giảng viên:
- Frontend: frontend/src/pages/DocumentProcessingPage.tsx
- API: backend/app/api/routes/documents.py (các route /api/v1/documents/processing/...)
- Logic: backend/app/ingestion/local_processing.py
- Trả lời câu hỏi đọc các PolicyUpdate ACTIVE trong backend/app/services/questions.py (_load_policy_updates, _applicable_policy_update): ưu tiên ngoại lệ → bản cập nhật liên quan mới nhất (published_at desc) → quy định gốc.

HIỆN TRẠNG ĐÃ XÁC MINH (đừng giả định khác):
a) POST /processing/upload và /processing/text gọi create_processing(): NGAY LẬP TỨC ghi vào DB 3 bản ghi Document(status=PENDING), PolicyVersion(status=PENDING), DocumentProcessing(status=PROCESSING→REVIEW_REQUIRED/READY_TO_CONFIRM) + file trên đĩa. Các bản ghi này CHƯA được dùng để trả lời (chỉ được dùng sau finalize). Nhưng KHÔNG có API/nút nào để hủy → nháp bỏ dở tồn tại mãi (DB hiện có 3 nháp PENDING + 5 FAILED).
b) Chỉ khi bấm "Lưu cập nhật quy định" (POST /processing/{id}/finalize) thì mới ingest chunk + _publish_policy_update() tạo mỗi chunk một PolicyUpdate(operation="ADD", status=ACTIVE, scope COURSE, policy_topic=infer_policy_topic(chunk)).
c) KHÔNG có phát hiện xung đột: upload mới cùng chủ đề chỉ được thêm chồng lên (hiện DB có 3 PolicyUpdate ACTIVE cùng topic GRADING_RUBRIC). Hàm _legacy_publish_policy_update có logic REPLACE/SUPERSEDED nhưng không được dùng. Tham số supersedes_document_id có ở API nhưng frontend không gửi.
d) Frontend: sau khi có `processing` thì form upload biến mất, không có nút nào để quay lại/tải tài liệu khác; muốn upload tiếp phải đổi tab hoặc F5.

YÊU CẦU:

### Backend
1. Hủy bản nháp (đánh dấu, KHÔNG xóa):
   - Thêm route POST /api/v1/documents/processing/{processing_id}/discard (require_role LECTURER/ACADEMIC_AFFAIRS như các route khác).
   - Chỉ cho phép khi processing.status ∈ {PROCESSING, REVIEW_REQUIRED, READY_TO_CONFIRM, FAILED}; nếu COMPLETED trả 409 code "PROCESSING_ALREADY_PUBLISHED".
   - Đặt processing.status = "DISCARDED", Document.status = "DISCARDED", PolicyVersion.status = "DISCARDED" (các cột status là String nên không cần migration; thêm DISCARDED vào DocumentStatus enum trong backend/app/core/enums.py).
   - Ghi audit event "POLICY_DRAFT_DISCARDED" qua app.services.audit.add_audit_event.
   - Đảm bảo bản DISCARDED không bao giờ được dùng khi trả lời và không hiện trong danh sách tài liệu mặc định (kiểm tra list_documents_response và mọi chỗ query Document/PolicyVersion theo status).
   - update_review_item và finalize_processing phải từ chối processing DISCARDED (409).

2. Phát hiện xung đột trước khi lưu:
   - Thêm route GET /api/v1/documents/processing/{processing_id}/conflicts. Chỉ chạy khi không còn review item PENDING.
   - Cách tính: lấy văn bản sạch dự kiến (áp dụng confirmed_text giống finalize_processing — tách phần dựng clean_text thành hàm dùng chung `_build_clean_text(processing, items)`), chia đoạn bằng app.ingestion.chunking.chunk_text (KHÔNG embed, KHÔNG ghi DB). Với mỗi đoạn mới: topic = infer_policy_topic(đoạn). So với các PolicyUpdate ACTIVE cùng course_id, scope_type COURSE, scope_id = course_id, cùng policy_topic. Bỏ qua topic "GENERAL" trừ khi độ trùng token (tái sử dụng logic _policy_match_tokens trong services/questions.py — chuyển sang module dùng chung, ví dụ app/core/policy_topics.py) ≥ 0.5.
   - Trả về danh sách: [{ "new_chunk_index", "new_content", "policy_topic", "existing": [{ "policy_update_id", "content", "source_document_title", "published_at" }] }]. Nếu không có xung đột trả [].
   - Sửa finalize: body (tùy chọn) { "resolutions": [{ "new_chunk_index": int, "action": "REPLACE" | "KEEP_OLD" | "KEEP_BOTH" }] }.
     * REPLACE: các PolicyUpdate cũ trong "existing" của đoạn đó → status SUPERSEDED; PolicyUpdate mới có supersedes_policy_update_id trỏ tới bản cũ mới nhất, operation "REPLACE".
     * KEEP_OLD: KHÔNG tạo PolicyUpdate cho đoạn mới đó (chunk vẫn được lưu nhưng không thành lớp cập nhật).
     * KEEP_BOTH: hành vi như hiện tại (ADD).
     * Nếu có xung đột mà thiếu resolution cho bất kỳ đoạn xung đột nào → 422 code "CONFLICT_RESOLUTION_REQUIRED" kèm danh sách new_chunk_index còn thiếu.
     * Lưu ý thứ tự chunk: chunk_index của DocumentChunk sau ingest phải khớp với new_chunk_index lúc preview (cùng hàm chunk_text, cùng tham số). Viết test để khóa điều này.
   - Ghi audit event cho mỗi quyết định (input_snapshot gồm action, policy_topic, các id bị thay thế).
   - Xóa hàm _legacy_publish_policy_update nếu không còn dùng.

3. Test (backend/tests/test_local_document_processing.py): discard ở từng trạng thái; discard COMPLETED → 409; conflict được phát hiện khi upload lần 2 cùng topic; REPLACE làm bản cũ SUPERSEDED và câu hỏi sau đó chỉ thấy nội dung mới; KEEP_OLD không tạo PolicyUpdate; finalize thiếu resolution → 422. Chạy toàn bộ pytest phải pass.

### Frontend (DocumentProcessingPage.tsx + client types trong frontend/src/types)
4. Luồng 3 bước, có thanh bước ở trên: (1) Nguồn tài liệu → (2) Rà soát nhận dạng → (3) Kiểm tra xung đột & Lưu.
5. Bước 2 và 3 luôn có:
   - Nút "← Quay lại" (về bước trước; từ bước 2 về bước 1 thì hỏi xác nhận vì sẽ hủy nháp → gọi /discard).
   - Nút "Hủy, không lưu" (secondary/danger nhẹ) → modal xác nhận (không dùng window.confirm) → gọi /discard → reset state về bước 1 với form trống.
6. Bước 3: gọi /conflicts.
   - Không có xung đột: hiện "Không phát hiện xung đột với quy định đang hiệu lực" + preview văn bản sạch + nút "Lưu cập nhật quy định".
   - Có xung đột: mỗi cặp hiển thị dạng 2 cột "Đang hiệu lực" | "Bản mới tải lên" (tên tài liệu nguồn, ngày công bố, chủ đề), highlight phần chữ khác nhau (diff theo từ đơn giản, tự viết, không thêm thư viện). Dưới mỗi cặp là segmented control 3 lựa chọn: "Dùng bản mới (thay thế)", "Giữ bản cũ", "Giữ cả hai". Bộ đếm "Đã xử lý x/y xung đột". Nút Lưu chỉ bật khi đã chọn hết; gửi resolutions trong body finalize.
7. Sau khi lưu thành công: màn hình kết quả gồm tóm tắt (số đoạn thêm mới, số đoạn thay thế, số đoạn bỏ qua), nút tải TXT/JSON như cũ, và nút chính "Tải tài liệu khác" → reset về bước 1 (không cần đổi tab/F5).
8. Nếu upload lỗi (status FAILED) → hiện lỗi + nút "Thử lại" (quay về bước 1 giữ nguyên tiêu đề/phiên bản) và tự gọi /discard cho bản FAILED.
9. Giữ nguyên toàn bộ hành vi hiện có: upload PDF/DOCX/ảnh, nhập văn bản, ngưỡng 0.80, crop ảnh, giữ dự đoán/lưu chỉnh sửa, export.
10. Chỉ sửa giao diện ở mức cần thiết cho luồng mới (bước 5 sẽ restyle toàn bộ sau), dùng class CSS hiện có trong styles.css.

Kiểm tra chấp nhận:
- Upload → bấm Hủy → DB: document_processing.status = 'DISCARDED'; form trở về trống ngay, không cần F5.
- Upload file rubric mới khi đã có rubric ACTIVE → bước 3 hiện xung đột; chọn "Dùng bản mới" → bản cũ SUPERSEDED; hỏi "Rubric chấm điểm thế nào?" ở trang sinh viên trả lời theo nội dung mới.
- Sau khi lưu, bấm "Tải tài liệu khác" quay lại bước 1 ngay.
- pytest và npm run build đều pass.
```

---

## PROMPT 3 — Khung ứng dụng mới: Header ngang + Account switcher + Workspace rail (phong cách Gmail / Material 3)

```
Bối cảnh: frontend/ (React + Vite + TS, Tailwind CDN trong index.html + frontend/src/styles.css, icon lucide-react đã cài, react-router-dom đã cài và BrowserRouter đã bọc App trong main.tsx nhưng chưa dùng Routes). Nginx đã có try_files fallback về index.html nên dùng URL routes được. Backend chạy AUTH_MODE=demo: danh tính lấy từ header X-Demo-Actor-ID (frontend/src/api/client.ts → setDemoActorId). KHÔNG cần đăng nhập (yêu cầu cuộc thi là test trực tiếp).

MỤC TIÊU: Thay sidebar tối bên trái (frontend/src/components/Sidebar.tsx) bằng khung giao diện mới cho TẤT CẢ vai trò, phong cách Gmail / Material 3: nền sáng, bề mặt xám-xanh nhạt, pill bo tròn, ít đổ bóng, không gradient, không chữ hoa letter-spacing kiểu "eyebrow".

### 1. Design tokens (làm trước, trong styles.css :root)
- Màu: --surface #FFFFFF, --surface-dim #F6F8FC (nền app như Gmail), --surface-container #EAF1FB, --surface-container-high #DDE3EA, --on-surface #1F1F1F, --on-surface-variant #444746, --outline #C4C7C5, --primary #0B57D0, --on-primary #FFFFFF, --primary-container #D3E3FD, --error #B3261E, --success #146C2E, --warning #8C5000. Màu đỏ BK chỉ còn dùng cho logo.
- Bo góc: --radius-sm 8px, --radius-md 12px, --radius-lg 16px, --radius-xl 28px (pill).
- Font: đổi sang "Roboto" + "Roboto Mono" (Google Fonts, có subset vietnamese) trong index.html; bỏ Plus Jakarta Sans. Cỡ chữ: body 14px, label 12px/500, title 22px/400 (Material dùng weight nhẹ, KHÔNG dùng 800/900).
- Elevation: chỉ 2 mức shadow nhẹ; mặc định dùng nền màu khác nhau thay vì shadow.
- Tạo component dùng chung trong frontend/src/components/ui/: Button (filled / tonal / outlined / text), IconButton, Chip (filter chip, có trạng thái selected), Card, Badge (trạng thái route: ANSWER/CLARIFY/ESCALATE/REJECT dùng màu tonal), Modal (thay mọi window.confirm/alert/prompt). Các trang sau sẽ dùng các component này.

### 2. Header ngang (component mới frontend/src/components/AppHeader.tsx), cao 64px, nền --surface-dim, không viền đậm
- Trái: logo "AER" nhỏ + tên "AER System".
- Giữa-trái: các tab dạng pill (active = nền --primary-container, chữ đậm hơn):
  1. "Trang chủ" → route "/" (giữ nội dung HomePage hiện tại, sẽ viết lại sau)
  2. "Không gian làm việc" → route "/workspace/..." (xem mục 4)
  3. "Audit Log" → "/audit"
  4. "Verify Harness" → "/verify"
- Phải: Account switcher (mục 3).

### 3. Account switcher (giả lập, không có đăng nhập)
- Nút chip: avatar tròn chữ cái đầu (màu theo tài khoản) + 2 dòng "Tên / Vai trò" + chấm trạng thái nhỏ (xanh = AI online theo /health/ai đang poll trong App.tsx, xám = offline) + mũi tên.
- Bấm mở menu (popover kiểu Google account menu) gồm 3 tài khoản cố định:
  * "Nguyễn Văn A" — Sinh viên · Nhóm 01 (actor_id "student-a1", group "group-a", course "CO3001")
  * "Trần Thị B" — Sinh viên · Nhóm 02 (actor_id "student-b1", group "group-b", course "CO3001")
  * "TS. Trần Minh Tuấn" — Giảng viên (actor_id "lecturer-01")
  (các id này có sẵn trong data/demo-config.json)
- Chọn tài khoản → setDemoActorId(id), lưu lựa chọn vào localStorage (bọc try/catch), điều hướng về trang workspace mặc định của vai trò đó, refresh counts.
- Cuối menu có mục "Công cụ demo" → "Reset dữ liệu demo" (gọi POST /api/demo/reset như Sidebar hiện tại) với Modal xác nhận; sau khi xong reload. ĐÂY LÀ VỊ TRÍ MỚI CỦA NÚT RESET.
- BỎ vai trò "Phòng Đào tạo" khỏi UI (không xóa file OperationsPage.tsx, chỉ không route tới nữa). Bỏ LoginPage khỏi luồng: App không còn gọi /api/v1/auth/me để chặn màn hình; mặc định chọn student-a1. Giữ nguyên code access-token trong client.ts để không phá AUTH_MODE=password.

### 4. Workspace + rail tính năng nổi bên trái (theo mockup)
- Route: /workspace/:feature.
  * Sinh viên: "ask" (Hỏi đáp — StudentSubmitView), "history" (Hồ sơ câu hỏi — StudentHistoryView).
  * Giảng viên: "inbox" (Câu hỏi cần duyệt — LecturerInboxView), "exceptions" (Ngoại lệ đã duyệt — ExceptionsView), "documents" (Tiếp nhận quy định — DocumentProcessingPage).
  * Truy cập feature không thuộc vai trò hiện tại → redirect về feature mặc định của vai trò.
- Rail (component frontend/src/components/WorkspaceRail.tsx): khối pill dọc nổi, cách mép trái 12px, căn giữa theo chiều dọc vùng nội dung, nền --surface-container, bo --radius-xl.
  * Trạng thái thu gọn (rộng ~64px): chỉ hiện các icon tròn 40px, icon active có nền --primary-container.
  * Khi chuột tiến gần (vùng cảm ứng 96px từ mép trái) hoặc hover vào rail, hoặc rail nhận focus bàn phím (:focus-within) → mở rộng mượt (transition width 200ms) hiện nhãn bên cạnh mỗi icon: Sinh viên "Hỏi đáp", "Xem các câu đã hỏi"; Giảng viên "Câu hỏi cần duyệt", "Ngoại lệ đã duyệt", "Tải quy chế". Rời chuột ra → thu lại sau 300ms.
  * Rail nổi đè lên nội dung (position fixed/absolute), KHÔNG đẩy layout; nội dung workspace chừa padding-left 88px.
  * Có badge số trên icon (pendingCount cho "Xem các câu đã hỏi", queueCount cho "Câu hỏi cần duyệt") — lấy từ refreshCounts trong App.tsx.
  * Trên màn hình < 768px: rail chuyển thành thanh tab dưới đáy.
  * Có aria-label, tooltip, điều hướng bằng Tab/Enter.

### 5. Dọn dẹp
- Xóa Sidebar.tsx khỏi App (có thể xóa file). Xóa frontend/src/pages/LecturerPage.tsx (đã xác minh không được import ở đâu — kiểm tra lại bằng grep trước khi xóa).
- App.tsx chuyển từ state activeTab sang <Routes>. Nút Back/Forward của trình duyệt phải hoạt động.
- Chưa restyle nội dung bên trong từng trang ở bước này (làm ở Prompt 4 và 5), chỉ đảm bảo chúng render đúng trong khung mới, không bị che bởi header/rail, và không có cuộn ngang trang.

Kiểm tra chấp nhận:
- Đổi tài khoản A → B → Giảng viên: rail đổi tính năng đúng vai trò; URL đổi; F5 giữ nguyên tài khoản và trang.
- Hover gần mép trái thì rail bung ra hiện nhãn, rời ra thì thu lại.
- Reset demo chỉ còn ở menu tài khoản, có modal xác nhận.
- npm run build pass; không còn lỗi console.
```

---

## PROMPT 4 — Workspace Sinh viên: trang Hỏi đáp + trang Hồ sơ câu hỏi kiểu Gmail

```
Tiếp nối Prompt 3 (đã có AppHeader, account switcher, WorkspaceRail, design tokens Material 3 và components trong frontend/src/components/ui/). Dùng các component/token đó, không viết style mới lệch hệ thống.

### A. Sửa dữ liệu theo tài khoản (bug đã xác minh — làm trước)
1. frontend/src/pages/StudentHistoryView.tsx đang hard-code params.append("actor_id", "demo-student") → luôn lấy lịch sử của "demo-student". Sửa thành actor_id của tài khoản đang chọn (truyền từ App qua props/context).
2. POST /api/v1/questions trong StudentSubmitView.tsx không gửi actor_id; schema backend (backend/app/schemas/questions.py) mặc định actor_id="demo-student", và ở AUTH_MODE=demo hàm effective_actor_id trả giá trị gửi lên → mọi câu hỏi đều bị lưu dưới "demo-student" dù header X-Demo-Actor-ID là student-a1/b1. Sửa frontend gửi actor_id = tài khoản hiện tại. (Không sửa backend.)
3. Nhóm tự gán theo tài khoản: student-a1 → group-a, student-b1 → group-b (lấy từ catalog /api/v1/demo/catalog nếu có member_ids, fallback map cứng). Bỏ dropdown chọn nhóm; hiển thị nhóm dạng chip read-only.
4. StudentHistoryView có mảng INITIAL_DEMO_CASES (dữ liệu giả hiện khi DB trống). Xóa nó; khi rỗng hiện empty state thật: "Bạn chưa gửi câu hỏi nào" + nút "Đặt câu hỏi đầu tiên" → /workspace/ask.

### B. Trang Hỏi đáp (/workspace/ask) — theo mockup 1
- Bố cục từ trên xuống, căn giữa, max-width 880px:
  * Hàng 1: pill "Chọn môn" (dropdown dạng Material outlined select, bo --radius-xl) + chip nhóm read-only.
  * Hàng 2: ô hỏi lớn (textarea tự giãn, min 3 dòng, bo --radius-lg, nền --surface-container) với nút gửi dạng FAB nhỏ ở góc phải dưới; Enter gửi, Shift+Enter xuống dòng.
  * Dưới ô hỏi: hàng filter-chip "Gợi ý nhanh" (giữ nội dung gợi ý hiện có).
  * Phần kết quả/trả lời và tiến trình phân luồng: GIỮ NGUYÊN chức năng và nội dung như hiện tại (người dùng yêu cầu "phần này giữ như cũ"), chỉ đổi sang token/component mới.
- Bỏ các chi tiết "AI-gen": dòng eyebrow chữ hoa đỏ ("HỆ THỐNG PHÂN GIẢI & TRANH CHẤP HỌC VỤ • tự động hóa học vụ"), badge "Chế độ demo", chip breadcrumb "GV: ...", nhãn "Đang mở tiếp nhận", câu marketing thừa. Tiêu đề trang chỉ là "Hỏi đáp quy chế" (22px, weight 400).

### C. Trang Hồ sơ câu hỏi (/workspace/history) — theo mockup 3 & 4, hoạt động như Gmail/Outlook
1. Trạng thái mặc định (chưa chọn câu nào): danh sách chiếm TOÀN BỘ bề rộng (mockup 3).
   - Trên cùng: thanh tìm kiếm dạng pill (như ô search Gmail) + hàng filter-chip theo trạng thái (giữ các nhóm hiện có: Tất cả / AI phản hồi / Chờ giảng viên / Đã phê duyệt / Ngoài phạm vi / Bị từ chối / Cần bổ sung), mỗi chip có số đếm.
   - Mỗi dòng kiểu hàng email Gmail: cao ~56px, 1 dòng: [badge trạng thái tonal] [câu hỏi in đậm nếu có cập nhật chưa xem, cắt ellipsis] [tên môn, màu phụ] [thời gian căn phải: "09:06" nếu hôm nay, "13 thg 10" nếu khác ngày]. Hover nền --surface-container-high; dòng phân cách mảnh.
2. Bấm một câu → chuyển sang layout 2 cột (mockup 4): danh sách thu hẹp bên trái (~380px, dòng chuyển sang dạng 2 dòng), chi tiết bên phải. URL đổi thành /workspace/history/:questionId (F5 và Back hoạt động; Back quay lại danh sách full width).
3. Panel chi tiết có thanh công cụ trên cùng: nút "← Quay lại danh sách", nút "Phóng to" (icon maximize) → ẩn cột danh sách, chi tiết chiếm toàn bộ bề rộng với cột đọc max-width 760px cho dễ đọc; bấm lại (icon minimize) hoặc Esc để hiện lại danh sách. Trạng thái phóng to lưu vào localStorage (try/catch).
4. Nội dung chi tiết giữ toàn bộ thông tin hiện có (stepper tiến trình, mã case, nhóm, ngày gửi, trạng thái phân luồng, câu hỏi gốc, câu trả lời AI/giảng viên, trích dẫn quy chế, nút "Làm mới kết quả") nhưng trình bày lại theo Card Material, bỏ chữ hoa letter-spacing, bỏ mã hash dài (q_dee7fc...) khỏi vị trí nổi bật — chỉ hiện mã ngắn và cho copy mã đầy đủ qua icon.
5. Có phím tắt: j/k di chuyển câu, Enter mở, Esc đóng (không kích hoạt khi đang gõ trong input).

Kiểm tra chấp nhận:
- Đổi tài khoản A ↔ B thì danh sách lịch sử khác nhau; câu hỏi mới gửi từ B xuất hiện ở lịch sử của B, không ở A.
- Không còn dữ liệu giả khi DB trống.
- Flow danh sách → chi tiết → phóng to → thu nhỏ → quay lại hoạt động, kể cả bằng nút Back trình duyệt.
- Kiểm tra ở 1280px, 1440px, 768px; npm run build pass.
```

---

## PROMPT 5 — Workspace Giảng viên + Audit Log + Verify Harness theo hệ thống thiết kế mới

```
Tiếp nối Prompt 3 & 4. Dùng design tokens Material 3 và components trong frontend/src/components/ui/. Mục tiêu: các trang còn lại nhìn đồng bộ, "như do frontend dev chuyên nghiệp làm", bỏ dấu hiệu AI-gen.

Quy tắc chung "bỏ AI vibe" áp dụng cho MỌI trang:
- Bỏ dòng eyebrow chữ hoa có dấu gạch/màu đỏ (vd "— TỰ ĐỘNG HÓA KIỂM CHỨNG · AER-CORE · V2.4 · HARNESS.CHẾ", "GEMINI VISION · OCR REVIEW").
- Tiêu đề trang 22px weight 400, một câu mô tả ngắn tối đa 1 dòng (hoặc bỏ).
- Không dùng font-weight 800/900, không gradient, không shadow đậm, không emoji/ký tự trang trí (⚖, ▶, →) trong nút; dùng icon lucide-react.
- Không hard-code tên người/ID trong UI (vd "lecturer-01 · CO3001", "Online") — lấy từ tài khoản đang chọn.
- Thay mọi window.confirm / window.prompt / alert bằng Modal component.
- Trạng thái loading dùng skeleton, empty state có icon + 1 câu + hành động.

1. LecturerInboxView.tsx (/workspace/inbox): cùng mô hình Gmail như trang Hồ sơ của sinh viên (danh sách full width → bấm vào thì chia 2 cột → nút phóng to). Có filter-chip theo trạng thái case. Form quyết định (Phê duyệt / Từ chối / Cần thêm thông tin / Chuyển tiếp) dùng segmented button Material; ô lý do bắt buộc; khu "Tạo ngoại lệ" là một Card có thể thu gọn. Giữ nguyên toàn bộ API call và logic.
2. ExceptionsView.tsx (/workspace/exceptions): bảng dạng Material data table (header 12px/500 màu --on-surface-variant, dòng cao 52px, không viền dọc), nút "Thu hồi" là text button màu --error mở Modal nhập lý do.
3. DocumentProcessingPage.tsx (/workspace/documents): restyle luồng 3 bước đã làm ở Prompt 2 (stepper Material ngang, vùng drop file dạng outlined dashed bo --radius-lg, bảng so sánh xung đột 2 cột rõ ràng). KHÔNG thay đổi logic/API.
4. AuditPage.tsx (/audit): bảng Material + filter-chip theo event_type + ô tìm kiếm.
5. VerifyPage.tsx (/verify): 4 thẻ số liệu dạng Card phẳng (giữ sửa lỗi tràn ở Prompt 1), nút "Chạy toàn bộ" là filled button có icon Play; bảng kết quả Material; badge PASS/FAIL tonal; danh mục case (routine/authority/...) dùng chip nhỏ với nhãn tiếng Việt thay vì chữ thường tiếng Anh.
6. HomePage.tsx (/): giữ nội dung, chỉ áp token mới và bỏ các yếu tố AI-gen theo quy tắc chung (người dùng sẽ viết lại nội dung sau).
7. Sau khi mọi trang đã dùng token mới: xóa các class CSS không còn được dùng trong styles.css (grep từng class trước khi xóa).

Kiểm tra chấp nhận:
- Không còn window.confirm/prompt/alert (grep để chắc chắn).
- Không còn font-weight 800/900 và chuỗi "tracking-widest"/"uppercase" dùng cho eyebrow (grep).
- Mọi trang không có cuộn ngang ở 1280px/1440px/768px.
- Mọi luồng cũ vẫn hoạt động: giảng viên duyệt case → sinh viên thấy kết quả; thu hồi ngoại lệ; upload quy định có xung đột; chạy Verify 16/16.
- npm run build pass.
```
