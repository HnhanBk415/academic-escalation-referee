# Prompt sửa Frontend AER — Đợt 2 (6 prompt)

> Chạy **lần lượt** từ Prompt 1 → 6, mỗi prompt một phiên/lượt riêng. Chỉ copy phần trong khung code.
> Sau mỗi prompt:
> - `cd frontend && npm run build`
> - Prompt có sửa backend (3, 4, 5, 6): `cd backend && python -m pytest -q`
> - `docker compose up -d --build web api` rồi kiểm tra tay theo mục "Kiểm tra chấp nhận"
> - Commit trước khi sang prompt tiếp theo.
>
> Thứ tự: 1 (nền tảng layout/cỡ chữ) → 2 (nhãn tiếng Việt + trang Hỏi đáp) → 3 (hàng chờ giảng viên + badge) → 3B (chế độ đọc) → 4 (Verify) → 5 (Tiếp nhận quy định) → 5B (sửa sót frontend) → 5C (backend: trả lời sai do lớp cập nhật) → 6 (backend: trích dẫn + migration).

---

## PROMPT 1 — Responsive: cỡ chữ co giãn, bề rộng trang, header cố định, icon trong nút

```
Bối cảnh: frontend/ là React + Vite + TS. Styling = Tailwind CDN (cấu hình trong frontend/index.html, có token màu Material 3 như --surface, --primary...) + frontend/src/styles.css. Component dùng chung ở frontend/src/components/ui/ (Button, IconButton, Chip, Card, Badge, Modal). Layout chính: frontend/src/App.tsx (Routes), frontend/src/components/AppHeader.tsx, frontend/src/pages/WorkspacePage.tsx, frontend/src/components/WorkspaceRail.tsx. KHÔNG thêm thư viện mới. KHÔNG đổi logic/API.

VẤN ĐỀ ĐÃ XÁC MINH:
(a) Người dùng dùng màn 1920×1080, Windows scale 125% → viewport CSS chỉ rộng 1536px. Chữ quá nhỏ: body cố định 14px (styles.css dòng ~95 `font-size: 14px`), có 207 chỗ `text-xs` (12px), 56 chỗ `text-[11px]`, 20 chỗ `text-[10px]`, 1 chỗ `text-[9px]`, 21 chỗ `text-[12px]`, 7 chỗ `text-[13px]`. Người dùng phải zoom trình duyệt 125% mới đọc thoải mái.
(b) Hai bên trang trống nhiều vì nội dung bị giới hạn cứng: Trang chủ max-w-6xl (1152px), Audit/Verify max-w-7xl (1280px), trang Hỏi đáp max-w-[880px], trang hàng chờ GV/Ngoại lệ/Tiếp nhận cũng bọc trong max-w-7xl.
(c) Header (AppHeader) là position static → cuộn xuống là mất thanh điều hướng.
(d) Icon trong nút bị rớt xuống dòng riêng (vd nút "Mở hàng chờ thẩm định →", "▶ Chạy toàn bộ Verify", "Trích xuất & Rà soát →", "Làm mới", "Quay lại", "Lưu cập nhật quy định"). Nguyên nhân: nơi gọi truyền icon CHUNG trong children của <Button>, Button bọc children trong <span> thường; Tailwind preflight đặt `svg { display:block }` nên icon chiếm nguyên một dòng trong span.

YÊU CẦU:

1. Cỡ chữ co giãn (fluid root font-size) trong styles.css:
   html { font-size: clamp(15px, calc(0.5vw + 9.5px), 19px); }
   → ~15.9px ở viewport 1280, ~17.2px ở 1536, ~19px ở 1920. Body dùng 1rem. Bỏ `font-size: 14px` cố định.
   Vì Tailwind dùng rem nên text-xs/text-sm/padding/gap/h-10... sẽ tự to theo.

2. Thay TOÀN BỘ cỡ chữ px cứng trong .tsx bằng thang rem (grep `text-\[\d+px\]`):
   text-[9px], text-[10px], text-[11px] → text-xs (0.75rem); text-[12px] → text-xs; text-[13px] → text-sm.
   Sau đổi, không còn chỗ nào hiển thị dưới ~13px thực tế ở viewport 1536. Kích thước khác ghi px cứng (h-[18px], min-w-[18px], w-[210px], rounded-[24px]...) đổi sang rem tương ứng (chia 16) để co giãn đồng bộ.
   Giữ thang chữ: tiêu đề trang text-2xl font-normal, tiêu đề card text-base font-medium, body text-sm/text-base, phụ chú text-xs. Không dùng font-weight > 600.

3. Bề rộng trang — tạo component layout dùng chung frontend/src/components/ui/PageContainer.tsx với 2 biến thể:
   - variant="wide" (trang dạng danh sách/bảng: Hồ sơ câu hỏi, Hàng chờ GV, Ngoại lệ, Audit Log, Verify Harness, Tiếp nhận quy định): width 100%, max-width 112rem, padding ngang clamp(1rem, 3vw, 3rem).
   - variant="reading" (Trang chủ, Hỏi đáp): max-width 72rem (thay 880px/1152px hiện tại), căn giữa, padding ngang như trên. Riêng cột đọc nội dung câu trả lời/chi tiết có thể giữ max-width ~48rem cho dễ đọc.
   Áp PageContainer cho mọi route trong App.tsx và WorkspacePage.tsx, xóa các max-w-6xl / max-w-7xl / max-w-[880px] bọc trang hiện có. Workspace vẫn chừa chỗ cho rail bên trái (padding-left ~5.5rem ở ≥768px).

4. Header cố định: AppHeader dùng `sticky top-0 z-40` với nền --surface-dim (đặc, không trong suốt) và đường viền dưới mảnh. Kiểm tra mọi panel 2 cột (Hồ sơ câu hỏi, Hàng chờ GV) có chiều cao = 100vh − chiều cao header, cuộn bên trong từng cột, không bị header che.

5. Sửa Button (components/ui/Button.tsx) để chống lỗi icon rớt dòng ở gốc:
   - Phần children bọc trong <span className="inline-flex items-center gap-2 whitespace-nowrap">.
   - Thêm `[&_svg]:shrink-0 [&_svg]:inline-block` cho button.
   - Sau đó rà soát MỌI nơi gọi <Button>/<IconButton> đang nhét icon (lucide hoặc ký tự "→", "▶", "←") trong children: chuyển icon sang prop `icon` (+ `iconPosition="right"` cho mũi tên đi tiếp). Xóa ký tự trang trí "→", "▶" dạng text trong nhãn nút.
   - Nút không được xuống dòng ở viewport ≥768px.

6. Đồng bộ đầu trang: mọi trang trong workspace có cùng cấu trúc tiêu đề (component PageHeader hiện có hoặc tạo mới trong ui/): tiêu đề text-2xl font-normal + 1 dòng mô tả ngắn (tùy chọn) + vùng hành động bên phải.
   - Hàng chờ giảng viên (LecturerInboxView) hiện KHÔNG có tiêu đề → thêm "Câu hỏi cần duyệt".
   - Trang Tiếp nhận quy định đang bị "khung lồng khung" (WorkspacePage bọc 1 card trắng, bên trong DocumentProcessingPage lại có card xanh) → bỏ card bọc ngoài trong WorkspacePage.tsx, chỉ giữ một cấp card.
   - Tên nhóm bị cắt (vd "Nhóm 01 - CO3…" trong hàng chờ, "Sinh viên · Nhóm 01 - …" trong chi tiết) → cho phép xuống dòng hoặc hiển thị tên ngắn "Nhóm 01", tooltip tên đầy đủ.

Kiểm tra chấp nhận:
- Ở viewport 1536×864 (zoom 100%) chữ thân bài ~17px, đọc thoải mái không cần zoom; ở 1280 và 1920 bố cục vẫn cân đối.
- Không còn khoảng trống lớn hai bên ở các trang danh sách/bảng; không có cuộn ngang trang ở 768/1280/1536/1920 (document.documentElement.scrollWidth === clientWidth).
- Cuộn xuống ở mọi trang header vẫn hiển thị.
- grep `text-\[\d+px\]` trong frontend/src trả về 0 kết quả.
- Không nút nào có icon nằm trên dòng riêng.
- npm run build pass.
```

---

## PROMPT 2 — Nhãn tiếng Việt thay mã kỹ thuật + làm lại phần kết quả trang Hỏi đáp

```
Tiếp nối Prompt 1 (đã có cỡ chữ rem, PageContainer, Button sửa icon). Dùng token Material 3 và components trong frontend/src/components/ui/. KHÔNG đổi logic/API.

VẤN ĐỀ ĐÃ XÁC MINH:
(a) Nhiều chỗ hiển thị mã kỹ thuật thô thay vì tiếng Việt:
   - Badge trạng thái hồ sơ sinh viên (StudentHistoryView.tsx): "auto_replied", "pending_lecturer"...
   - Hàng chờ giảng viên (LecturerInboxView.tsx): badge "AUTHORITY_REQUIRED" (uncertainty_type) và badge này còn ĐÈ lên chữ tiêu đề dòng; ô "Chủ đề quy định" hiện "COURSE_REGISTRATI…" (policy_topic bị cắt).
   - Ngoại lệ (ExceptionsView.tsx): chủ đề "CAMPUS_LIFE".
   - Chi tiết hồ sơ: ô "Nhóm" hiện "group-a" thay vì tên nhóm.
   - Audit Log (AuditPage.tsx): loại sự kiện "ANSWER_RETURNED", "REFEREE_DECIDED", "EVIDENCE_RETRIEVED", "CONTEXT_RESOLVED", "QUESTION_SUBMITTED", "CASE_ESCALATED"... (chỉ "Hủy nháp" đã dịch).
   - Modal Hủy ở Tiếp nhận quy định có chữ "(DISCARDED)".
   - Verify: "Over-escalation Rate", "Under-escalation Rate", "Routing Evaluation" trộn Anh–Việt.
(b) Trang Hỏi đáp (StudentSubmitView.tsx):
   - Ô nhập câu hỏi được điền sẵn GIÁ TRỊ THẬT "Hạn chót để sinh viên được phép xin hủy môn học mà không bị ghi điểm F là khi nào?" (lấy từ QUICK_CHIPS[0].prompt) → sinh viên dễ gửi nhầm.
   - Khi focus, ô nhập có 2 lớp viền (viền textarea mặc định nằm trong viền container).
   - Phần tiến trình + kết quả trả lời vẫn dùng style CŨ: thanh tiến trình màu đỏ, dải tiêu đề chữ hoa đỏ "ĐÃ ĐỐI CHIẾU THÀNH CÔNG • Trực tiếp từ quy chế hiện hành (AI Trả lời tự động)", mã "Req: req_9f7c…" hiển thị nổi bật, icon cân đỏ cạnh "Kết luận quy chế chính thức".

YÊU CẦU:

1. Tạo frontend/src/utils/labels.ts — MỘT nguồn duy nhất cho mọi nhãn hiển thị (mở rộng/tái sử dụng utils/formatters.ts hiện có, không trùng lặp):
   - routeLabel(route): ANSWER "Đã trả lời", CLARIFY "Cần làm rõ", ESCALATE "Chuyển giảng viên", REJECT "Từ chối".
   - studentCaseStatusLabel(key): auto_replied "AI đã trả lời", pending_lecturer "Chờ giảng viên", approved "Đã phê duyệt", rejected "Bị từ chối", out_of_scope "Ngoài phạm vi", need_info "Cần bổ sung"... (đọc đủ các key trong StudentHistoryView để map hết).
   - uncertaintyLabel(type): AUTHORITY_REQUIRED "Cần thẩm quyền GV", MISSING_FACT "Thiếu dữ kiện", OUT_OF_POLICY "Ngoài quy chế", ... (grep backend/app/core/enums.py để lấy đủ giá trị).
   - policyTopicLabel(topic): GROUP_MEMBERSHIP "Thành viên nhóm", GRADING_RUBRIC "Rubric chấm điểm", SUBMISSION_DEADLINE "Hạn nộp bài", AI_USAGE "Sử dụng AI", GRADE_APPEAL "Phúc khảo điểm", COURSE_REGISTRATION "Đăng ký/Hủy môn", CAMPUS_LIFE "Đời sống sinh viên", SECURITY "Bảo mật", GENERAL "Chung" (lấy đủ từ backend/app/core/policy_topics.py).
   - auditEventLabel(type): dịch mọi event_type có trong backend (grep `event_type=` trong backend/app) sang tiếng Việt ngắn gọn, vd QUESTION_SUBMITTED "Gửi câu hỏi", CONTEXT_RESOLVED "Xác định ngữ cảnh", EVIDENCE_RETRIEVED "Truy xuất quy chế", REFEREE_DECIDED "AI phân luồng", ANSWER_RETURNED "Trả lời sinh viên", CASE_ESCALATED "Chuyển giảng viên", POLICY_UPDATE_SAVED "Lưu quy định", POLICY_DRAFT_DISCARDED "Hủy nháp"...
   - groupLabel(groupId, catalog): trả tên nhóm từ catalog (vd "Nhóm 01"), fallback groupId.
   - Mọi hàm: giá trị lạ → hiển thị dạng "Khác" kèm title chứa mã gốc (không bao giờ in mã thô ra UI).
   Áp dụng ở tất cả nơi nêu trong (a). Badge dùng component Badge với màu tonal theo nhóm nghĩa (xanh lá = đã trả lời/đạt, vàng = chờ/cần làm rõ, xanh dương = chuyển GV, đỏ = từ chối/lỗi). Trong hàng chờ GV, badge không được đè lên tiêu đề (dùng flex, badge shrink-0, tiêu đề min-w-0 truncate).
   Verify: đổi "Over-escalation Rate" → "Tỷ lệ chuyển thừa", "Under-escalation Rate" → "Tỷ lệ bỏ sót", "Chi tiết kết quả phân luồng (Routing Evaluation)" → "Kết quả từng ca kiểm thử". Modal Hủy bỏ chữ "(DISCARDED)".

2. Ô nhập trang Hỏi đáp:
   - Giá trị ban đầu = "" (rỗng). Placeholder: "Nhập câu hỏi về quy chế môn học, vd: Nhóm đồ án được tối đa bao nhiêu thành viên?". Chỉ khi bấm chip gợi ý mới điền nội dung.
   - Chỉ một vòng focus: textarea `border-0 outline-none ring-0 bg-transparent resize-none`, container dùng `focus-within:ring-2 focus-within:ring-[var(--primary)]`.
   - Nút gửi bị vô hiệu khi ô rỗng.

3. Làm lại phần tiến trình + kết quả (giữ NGUYÊN nội dung/thông tin, chỉ đổi trình bày theo Material 3):
   - Tiến trình 3 bước: stepper ngang màu --primary (bước xong: chấm tròn tô --primary + icon check; bước hiện tại: viền --primary; chưa tới: viền --outline). Bỏ toàn bộ màu đỏ.
   - Card kết quả: đầu card là 1 dòng gồm Badge route (dùng routeLabel) + câu ngắn "Trả lời tự động từ quy chế hiện hành" (chữ thường, không in hoa, không đỏ). Mã request chuyển xuống chân card dạng chữ nhỏ màu --on-surface-variant với nút copy, không nổi bật.
   - "Kết luận" là đoạn văn bản thường cỡ text-base, phần số liệu quan trọng có thể in đậm (font-medium), không đổi màu đỏ.
   - Trích dẫn: danh sách card phẳng có tên tài liệu, tiêu đề mục, đoạn trích (tối đa 3 dòng, có "Xem thêm").
   - Trạng thái CLARIFY/ESCALATE/REJECT dùng cùng khung card, chỉ khác Badge và nội dung hướng dẫn.
   - Rà soát cả StudentHistoryView (panel chi tiết) và LecturerInboxView: bỏ mọi tiêu đề chữ HOA kiểu eyebrow (grep `uppercase`, `tracking-wide`, `tracking-widest`), bỏ màu đỏ trang trí.

Kiểm tra chấp nhận:
- Không còn chuỗi dạng MÃ_HOA hoặc snake_case hiển thị cho người dùng ở: Hồ sơ câu hỏi, Hàng chờ GV, Ngoại lệ, Audit Log, Verify, Tiếp nhận quy định.
- Vào trang Hỏi đáp: ô nhập trống, có placeholder; focus chỉ có một viền.
- Gửi "Một nhóm đồ án được có bao nhiêu thành viên?" → kết quả hiện đúng như cũ nhưng không còn chữ hoa đỏ/thanh đỏ.
- grep `uppercase` trong frontend/src/pages chỉ còn ở header cột bảng (nếu có).
- npm run build pass.
```

---

## PROMPT 3 — Hàng chờ giảng viên + badge số theo tài khoản

```
Bối cảnh: FastAPI backend (backend/), React frontend (frontend/). AUTH_MODE=demo: danh tính qua header X-Demo-Actor-ID (frontend/src/api/client.ts). Tài khoản demo: student-a1 (group-a), student-b1 (group-b), lecturer-01.

VẤN ĐỀ ĐÃ XÁC MINH:
(a) frontend/src/pages/LecturerInboxView.tsx, hàm loadCases(): gọi GET /api/v1/cases?status=UNDER_REVIEW rồi gọi thêm N request GET /api/v1/cases/{id} (hiện 24 request) chỉ để lấy original_question, actor_id, group_name, course_id, policy_topic, citations. Trong lúc chờ, UI hiện "Tất cả (0)" + vùng trống vài giây (không có loading state), lỗi từng request bị nuốt (catch → null).
(b) Tiêu đề mỗi dòng là `d.decision_question` — chuỗi chung "Giảng viên có xem xét và phê duyệt yêu cầu này không?" giống hệt nhau cho mọi hồ sơ → giảng viên không phân biệt được.
(c) Mở một hồ sơ trong hàng chờ không đổi URL (trang Hồ sơ câu hỏi của sinh viên thì đã có /workspace/history/:questionId) → F5 mất lựa chọn, Back không hoạt động.
(d) Badge số trên WorkspaceRail sai: App.tsx gọi GET /api/v1/questions/counts; backend dashboard_counts() (backend/app/services/questions.py ~dòng 1094) đếm TOÀN HỆ THỐNG: pending_questions = mọi case chưa DECIDED/CANCELLED, under_review_cases = mọi case UNDER_REVIEW. Kết quả: sinh viên A chỉ có 3 câu hỏi nhưng badge "Xem các câu đã hỏi" hiện 24.

YÊU CẦU:

Backend
1. Mở rộng CaseSummary (backend/app/schemas/cases.py) và list_cases (backend/app/services/cases.py) để trả thêm: original_question, actor_id, course_id, group_id, group_name, policy_topic. Dùng JOIN/selectinload trong MỘT truy vấn (không N+1). Giữ tương thích các trường cũ.
2. dashboard_counts nhận actor hiện tại (truyền CurrentActor từ route /questions/counts):
   - Nếu actor là STUDENT: pending_questions = số câu hỏi CỦA actor đó đang chờ (case chưa DECIDED/CANCELLED hoặc câu hỏi đang CLARIFY chờ sinh viên trả lời); under_review_cases = 0.
   - Nếu actor là LECTURER: under_review_cases = số case UNDER_REVIEW được giao cho actor (assigned_reviewer_id == actor.id, hoặc chưa giao); pending_questions = 0.
   - Viết test cho 2 trường hợp.

Frontend
3. LecturerInboxView:
   - Chỉ gọi 1 request danh sách (dùng các trường mới), bỏ vòng lặp gọi chi tiết. Chi tiết (citations, ai_summary...) chỉ tải khi mở một hồ sơ.
   - Tiêu đề dòng = original_question (1 dòng, ellipsis). Dòng phụ: tên SV/nhóm (groupLabel) · môn · chủ đề (policyTopicLabel từ utils/labels.ts nếu đã có từ Prompt 2). decision_question chỉ hiện trong panel chi tiết.
   - Loading: hiện 6 dòng skeleton (khối xám nhạt animate-pulse) thay vì "Tất cả (0)"; chip đếm hiện "–" khi đang tải. Lỗi tải → banner lỗi + nút "Thử lại".
   - Route: /workspace/inbox/:caseId. Bấm dòng → navigate; F5 giữ hồ sơ đang mở; Back quay lại danh sách full width; Esc đóng chi tiết. Làm giống cơ chế đã có ở StudentHistoryView (đọc code đó để tái sử dụng hành vi, tách hook dùng chung nếu hợp lý, vd hooks/useMasterDetailRoute.ts).
   - Sau khi giảng viên ra quyết định: bỏ hồ sơ khỏi danh sách, tự chọn hồ sơ kế tiếp (nếu có), gọi onDecisionMade để badge cập nhật.
4. App.tsx: refreshCounts gọi lại ngay khi đổi tài khoản, sau khi gửi câu hỏi, sau khi GV ra quyết định. Đảm bảo setDemoActorId được gọi TRƯỚC mọi request của trang con khi khởi động (hiện setDemoActorId nằm trong useEffect của App, mà useEffect của component con chạy trước cha → request đầu tiên có thể đi với actor sai). Cách sửa: gọi setDemoActorId đồng bộ khi khởi tạo state (trong getInitialAccount) và trong handleSelectAccount, không chỉ trong effect.

Kiểm tra chấp nhận:
- Hàng chờ GV tải bằng 1 request danh sách (xem tab Network), có skeleton khi tải, mỗi dòng hiện câu hỏi gốc khác nhau.
- Mở hồ sơ → URL /workspace/inbox/<id>; F5 vẫn mở đúng hồ sơ; Back quay lại danh sách.
- Đăng nhập SV A: badge = số câu hỏi đang chờ của A (không phải 24). SV B chưa hỏi gì → không có badge. GV: badge = số case UNDER_REVIEW.
- pytest + npm run build pass.
```

---

## PROMPT 3B — "Phóng to" thành chế độ đọc thật sự (chạy SAU Prompt 3)

```
Bối cảnh: frontend/ React + Vite + TS, Tailwind CDN + token Material 3, cỡ chữ gốc đã co giãn theo rem (Prompt 1). Hai trang master–detail kiểu Gmail: frontend/src/pages/StudentHistoryView.tsx (Hồ sơ câu hỏi của sinh viên) và frontend/src/pages/LecturerInboxView.tsx (Câu hỏi cần duyệt của giảng viên). Cả hai có state isMaximized lưu localStorage và nút "Phóng to/Thu nhỏ".

VẤN ĐỀ ĐÃ XÁC MINH:
Nút "Phóng to" hiện chỉ ẩn cột danh sách bên trái, KHÔNG làm nội dung dễ đọc hơn:
- Cột chi tiết khi phóng to bị giới hạn max-w-[48rem] (StudentHistoryView.tsx ~dòng 520, LecturerInboxView.tsx ~dòng 471) — còn hẹp hơn hoặc bằng lúc chưa phóng to.
- Cỡ chữ, khoảng cách dòng giữ nguyên.
- Thanh tìm kiếm + hàng chip lọc trạng thái phía trên vẫn hiện, rail tính năng bên trái vẫn hiện → vẫn rối mắt.

YÊU CẦU — đổi "Phóng to" thành "Chế độ đọc":
1. Tạo component dùng chung frontend/src/components/ReadingMode.tsx (hoặc hook useReadingMode + wrapper) dùng cho CẢ HAI trang, không viết lặp.
2. Khi bật chế độ đọc:
   - Ẩn: cột danh sách, thanh tìm kiếm, hàng chip lọc, WorkspaceRail (thêm prop/context để WorkspacePage ẩn rail). Header app vẫn giữ.
   - Thanh công cụ trên cùng của panel đọc (sticky ngay dưới header): nút "← Quay lại danh sách", nút "Thoát chế độ đọc" (icon Minimize2, phím Esc), bộ chỉnh cỡ chữ 3 mức "A− / A / A+" (segmented button), nút "‹ Câu trước" / "Câu sau ›" để đọc lần lượt mà không cần thoát (phím j/k), và vị trí "3/24".
   - Vùng nội dung: căn giữa, bề rộng cột chữ ~68ch (khoảng 44–48rem tùy cỡ chữ) cho phần văn bản (câu hỏi, câu trả lời, kết luận, lý do); các khối dạng lưới (thông tin case: mã, nhóm, ngày, trạng thái; stepper tiến trình) được rộng hơn tới ~64rem.
   - Chữ: cỡ chữ nội dung tăng theo mức đã chọn — A−: 1rem, A (mặc định): 1.125rem, A+: 1.25rem; line-height 1.75; khoảng cách đoạn 1em. Tiêu đề câu hỏi tăng tương ứng (text-2xl → text-3xl ở A+). Áp bằng CSS variable (vd --reading-font-size) trên container, các phần tử con dùng em/rem tương đối để tăng đồng bộ — không sửa từng class.
   - Trích dẫn quy chế: hiện đầy đủ nội dung (không cắt 3 dòng), font như nội dung, có viền trái nhạt (border-left, không bo góc) để phân biệt với câu trả lời.
   - Với LecturerInboxView: form quyết định (Phê duyệt/Từ chối/…, lý do, tạo ngoại lệ) vẫn hiện bên dưới nội dung, cùng bề rộng cột, để giảng viên đọc xong ra quyết định luôn.
3. Lưu lựa chọn: trạng thái bật/tắt và mức cỡ chữ lưu localStorage (bọc try/catch), dùng chung khóa cho cả hai trang. Thêm query ?read=1 vào URL khi đang ở chế độ đọc để F5/Back giữ đúng trạng thái.
4. Chuyển tiếp mượt: transition 150–200ms khi ẩn/hiện danh sách; tôn trọng prefers-reduced-motion.
5. Màn hình < 768px: mặc định luôn ở dạng một cột (danh sách → chi tiết), nút chế độ đọc chỉ còn bộ chỉnh cỡ chữ.
6. Đổi nhãn nút từ "Phóng to/Thu nhỏ" thành "Chế độ đọc" / "Thoát chế độ đọc", có tooltip phím tắt.

Kiểm tra chấp nhận:
- Bật chế độ đọc ở Hồ sơ câu hỏi và Hàng chờ GV: danh sách, ô tìm kiếm, chip lọc, rail đều ẩn; chữ nội dung to hơn rõ rệt so với lúc thường; dòng chữ không dài quá ~70 ký tự.
- A−/A/A+ đổi cỡ chữ ngay, giữ sau F5.
- j/k hoặc nút Câu trước/Câu sau chuyển hồ sơ mà vẫn ở chế độ đọc; Esc thoát.
- Giảng viên ra quyết định được ngay trong chế độ đọc.
- Không cuộn ngang ở 768/1280/1536/1920; npm run build pass.
```

---

## PROMPT 4 — Verify Harness: tách dữ liệu test khỏi hàng chờ + ô "Tổng thời gian xử lý" dạng ô vuông

```
Bối cảnh: frontend/src/pages/VerifyPage.tsx chạy 16 ca kiểm thử bằng POST /api/v1/questions. Backend FastAPI ở backend/. Demo actor qua header X-Demo-Actor-ID (frontend/src/api/client.ts — hàm api() hiện LUÔN ghi đè header X-Demo-Actor-ID bằng demoActorId toàn cục). Danh sách actor seed lấy từ data/demo-config.json (backend/app/db/seed.py).

VẤN ĐỀ ĐÃ XÁC MINH:
(a) VerifyPage gửi câu hỏi không kèm actor_id → backend lưu dưới "demo-student" (schema QuestionCreate mặc định actor_id="demo-student"). Mỗi lần chạy tạo ~6 case ESCALATE mới → hàng chờ giảng viên bị đầy bởi dữ liệu test (hiện 24 case, phần lớn từ Verify).
(b) Ô "Tổng thời gian xử lý" hiển thị bar chart 16 cột nhìn xấu, số "28257 ms" khó đọc.

YÊU CẦU:

Backend
1. Thêm actor hệ thống "verify-harness" (role STUDENT, display_name "Verify Harness") vào data/demo-config.json và fallback config trong backend/app/db/seed.py. Không thêm vào nhóm nào (verify luôn gửi group_id tường minh).
2. Loại dữ liệu verify khỏi luồng nghiệp vụ mặc định:
   - list_cases (/api/v1/cases), dashboard_counts (/api/v1/questions/counts), list_questions_response khi không truyền actor_id: mặc định LOẠI các case/câu hỏi có actor_id == "verify-harness". Thêm query param include_verify: bool = False cho /api/v1/cases để xem khi cần.
   - Audit log vẫn ghi đầy đủ (không lọc).
   - Định nghĩa hằng số VERIFY_ACTOR_ID ở một chỗ (vd backend/app/core/constants.py) và dùng lại.
   - Test: tạo câu hỏi ESCALATE bằng verify-harness → không xuất hiện trong /api/v1/cases mặc định và không làm tăng counts.

Frontend
3. client.ts: api() chỉ set X-Demo-Actor-ID khi init.headers CHƯA có header đó (cho phép ghi đè từng request).
4. VerifyPage: mọi request gửi header X-Demo-Actor-ID: "verify-harness" và body actor_id: "verify-harness". Không đổi danh sách CASES, tiêu chí PASS/FAIL.
5. Thay thẻ "Tổng thời gian xử lý" bằng thiết kế Ô VUÔNG (đã chốt với người dùng):
   - Dòng số chính: tổng thời gian định dạng giây 1 chữ số thập phân, dấu phẩy kiểu Việt ("28,3 s"); bên phải nhỏ "/ 90 s mục tiêu".
   - Dòng phụ: "TB 1,8 s · chậm nhất #008 (4,3 s)".
   - Lưới 16 ô vuông: grid 8 cột × 2 hàng, gap 0.25rem, ô aspect-square bo 0.25rem, trong ô ghi số ca 2 chữ số ("01".."16") font mono cỡ text-xs.
   - Màu ô theo độ trễ (tonal, chữ dùng tông đậm cùng họ màu): < 2 s xanh lá nhạt; 2–5 s vàng nhạt; > 5 s đỏ nhạt. Chưa chạy: --surface-container, chữ mờ. Đang chạy: viền --primary + animate-pulse.
   - Ca FAIL: thêm viền 2px màu --error (bất kể màu nền).
   - Hover/focus ô: tooltip "verify_008 · 4.312 ms · PASS". Ô là button có aria-label tương tự; bấm vào ô → cuộn tới dòng tương ứng trong bảng và highlight dòng 2 giây.
   - Chú thích 3 màu nhỏ bên dưới lưới: "< 2 s", "2–5 s", "> 5 s".
   - Xóa hoàn toàn bar chart cũ (và CSS liên quan nếu còn trong styles.css).
   - Thẻ phải vừa khít ở mọi bề rộng (min-w-0), không tràn.
6. Nút "Chạy toàn bộ Verify": icon Play qua prop icon (không phải ký tự ▶).

Kiểm tra chấp nhận:
- Chạy Verify 16/16 → số hồ sơ trong hàng chờ giảng viên KHÔNG tăng; badge GV không tăng.
- Thẻ thời gian hiện 16 ô màu đúng ngưỡng, ca FAIL có viền đỏ, hover có tooltip, bấm ô cuộn tới dòng bảng.
- Không tràn ở 768/1280/1536/1920.
- pytest + npm run build pass.
```

---

## PROMPT 5 — Tiếp nhận quy định: phát hiện xung đột với quy chế gốc + sửa thanh bước sau khi Hủy

```
Bối cảnh: Tính năng "Tiếp nhận quy định" của giảng viên.
- Frontend: frontend/src/pages/DocumentProcessingPage.tsx (luồng 3 bước, state `step` khai báo ~dòng 91; các handler hủy ~dòng 224 và discardDraft ~dòng 267; resetAll ~dòng 353; render thanh bước ~dòng 400–470).
- Backend: backend/app/ingestion/local_processing.py (_detect_conflicts ~dòng 483, detect_conflicts, finalize với resolutions REPLACE/KEEP_OLD/KEEP_BOTH), schema ConflictItem/ExistingConflictItem trong backend/app/schemas/documents.py.
- Có 2 tầng dữ liệu quy chế:
  * Quy chế GỐC: Document status ACTIVE được ingest từ thư mục data (scan_and_sync_documents), chunk trong document_chunks, KHÔNG có bản ghi PolicyUpdate. Chunk của tài liệu upload thì có chunk_metadata.source_kind = "POLICY_UPDATE" và retrieval_eligible = False.
  * Lớp CẬP NHẬT: bảng policy_updates (status ACTIVE), tạo khi giảng viên lưu tài liệu upload. Khi trả lời, lớp cập nhật liên quan được ưu tiên hơn quy chế gốc (backend/app/services/questions.py: _applicable_policy_update).

VẤN ĐỀ ĐÃ XÁC MINH:
(a) _detect_conflicts chỉ so đoạn mới với PolicyUpdate ACTIVE. Sau khi reset demo, policy_updates trống → KHÔNG BAO GIỜ báo xung đột, kể cả khi đoạn mới mâu thuẫn trực tiếp quy chế gốc. Ví dụ đã thử: dán "Rubric chấm điểm đồ án CO3001: báo cáo chiếm 25%, sản phẩm chiếm 45%, trình bày chiếm 20%, hợp tác nhóm chiếm 10%." trong khi quy chế gốc CO3001 ghi báo cáo 30%, sản phẩm 40% → UI báo "Không phát hiện xung đột với quy định hiện hành".
(b) Sau khi bấm "Hủy, không lưu" → xác nhận: form quay về bước nhập liệu nhưng THANH BƯỚC vẫn hiển thị bước 3 đang chọn và bước 1, 2 có dấu tích.

YÊU CẦU:

Backend
1. _detect_conflicts so với CẢ HAI tầng:
   - Tầng cập nhật: giữ logic hiện tại.
   - Tầng gốc: lấy DocumentChunk của các Document cùng course_id, status ACTIVE, KHÔNG phải tài liệu upload (chunk_metadata.source_kind != "POLICY_UPDATE"). Một chunk gốc khớp với đoạn mới khi: topic của đoạn mới (infer_policy_topic) khác "GENERAL" VÀ topic đó nằm trong policy_topics_in_text(chunk gốc) VÀ policy_token_overlap(đoạn mới, chunk gốc) ≥ 0.2. Với topic GENERAL: chỉ khớp khi overlap ≥ 0.5.
   - Chỉ trả tối đa 2 chunk gốc khớp nhất cho mỗi đoạn mới (sắp theo overlap giảm dần). Cắt nội dung chunk gốc hiển thị: lấy đoạn/câu chứa nhiều token trùng nhất (±300 ký tự) thay vì cả chunk 600 từ.
   - Mở rộng ExistingConflictItem: thêm `source_kind: Literal["POLICY_UPDATE", "BASE_DOCUMENT"]`, `chunk_id: str | None`, `document_id`; policy_update_id thành Optional.
2. Finalize với xung đột tầng gốc:
   - REPLACE ("Dùng bản mới"): tạo PolicyUpdate operation "REPLACE" (không SUPERSEDED gì vì gốc không phải PolicyUpdate), ghi audit kèm base chunk_id bị ghi đè. Không sửa/xóa dữ liệu gốc.
   - KEEP_OLD ("Giữ quy chế gốc"): không tạo PolicyUpdate cho đoạn đó.
   - KEEP_BOTH không áp dụng cho xung đột tầng gốc (vì lớp cập nhật luôn được ưu tiên khi trả lời nên "giữ cả hai" thực chất là thay thế) → nếu nhận KEEP_BOTH cho đoạn chỉ xung đột tầng gốc thì xử lý như REPLACE.
   - Đoạn xung đột với cả hai tầng: áp dụng hành động cho cả hai như mô tả.
3. Test trong backend/tests/test_local_document_processing.py:
   - DB không có PolicyUpdate, quy chế gốc có rubric 30/40/20/10 → upload rubric 25/45/20/10 → /conflicts trả 1 xung đột với source_kind BASE_DOCUMENT.
   - Upload đoạn không liên quan (vd "Lịch bảo vệ đồ án vào tuần 15") → không báo xung đột với chunk rubric.
   - REPLACE → hỏi "Rubric chấm điểm thế nào?" trả lời theo 25/45; KEEP_OLD → vẫn trả lời 30/40.

Frontend
4. Bảng so sánh xung đột: mỗi cặp hiển thị nhãn nguồn của cột trái: "Quy chế gốc · <tên tài liệu>" hoặc "Bản cập nhật · <tên tài liệu> · <ngày>". Với xung đột tầng gốc chỉ hiện 2 lựa chọn: "Dùng bản mới" / "Giữ quy chế gốc". Giữ diff highlight theo từ.
5. Sửa thanh bước sau khi Hủy: tìm nguyên nhân (state step/isCompleted/conflicts không reset đồng bộ ở MỌI đường hủy — handler ~dòng 224, discardDraft ~267, resetAll ~353, và onConfirm của Modal có thể giữ closure cũ). Gộp thành MỘT hàm resetToStart() reset toàn bộ state (step=1, processing=null, conflicts, resolutions, selected, draft, cropUrl, file, text, summary, error) và dùng ở mọi nơi. Thanh bước tính trạng thái chỉ từ `step` (+ processing.status khi COMPLETED).
6. Thông báo sau khi hủy: "Đã hủy bản nháp" (bỏ "thành công").

Kiểm tra chấp nhận:
- Reset demo → dán rubric 25/45/20/10 → bước 3 hiện 1 xung đột với "Quy chế gốc", có 2 lựa chọn; chọn "Dùng bản mới" → Lưu → sinh viên hỏi rubric nhận câu trả lời 25%/45%.
- Dán nội dung không liên quan → "Không phát hiện xung đột".
- Hủy ở bước 2 hoặc 3 → thanh bước trở về bước 1, không còn dấu tích.
- pytest + npm run build pass.
```

---

## PROMPT 5B — Sửa các chỗ còn sót sau Prompt 1–5 (frontend)

```
Bối cảnh: frontend/ React + Vite + TS, Tailwind CDN + token Material 3, nhãn tiếng Việt tập trung ở frontend/src/utils/labels.ts. Chỉ sửa frontend, KHÔNG đổi API.

Các lỗi còn sót đã xác minh trên bản hiện tại:

1. Tiếp nhận quy định — bảng xung đột chỉ hiện MỘT nguồn cũ:
   frontend/src/pages/DocumentProcessingPage.tsx ~dòng 900: `const existing = conflict.existing[0];` → chỉ render phần tử đầu. API /conflicts thực tế trả nhiều mục (vd 1 "POLICY_UPDATE" bản cập nhật 25/45 + 1 "BASE_DOCUMENT" quy chế gốc 30/40), nhưng UI chỉ hiện bản cập nhật, người dùng không thấy quy chế gốc.
   Sửa: render TẤT CẢ conflict.existing. Bố cục mỗi xung đột: cột phải "Bản mới tải lên"; cột trái là danh sách xếp chồng các nguồn cũ, mỗi nguồn có nhãn "Quy chế gốc · <tên tài liệu>" hoặc "Bản cập nhật · <tên tài liệu> · <ngày>" và diff riêng so với bản mới. Lựa chọn: nếu trong existing có ít nhất một POLICY_UPDATE → 3 lựa chọn (Dùng bản mới / Giữ bản cũ / Giữ cả hai); nếu chỉ có BASE_DOCUMENT → 2 lựa chọn (Dùng bản mới / Giữ quy chế gốc).
   Đồng thời: "Chủ đề: GRADING_RUBRIC" (~dòng 911) phải dùng policyTopicLabel(). KHÔNG chọn sẵn phương án mặc định — người dùng phải tự chọn từng xung đột thì nút "Lưu cập nhật quy định" mới bật (đúng yêu cầu Prompt 2 đợt 1).

2. Verify Harness — ô FAIL không có viền đỏ:
   frontend/src/pages/VerifyPage.tsx (~dòng 510–545): cellStyle có "border border-transparent" rồi nối thêm " border-2 !border-[var(--error)]" → computed border-width = 0px (đã đo bằng getComputedStyle), không thấy viền. Sửa: không dùng border cho trạng thái FAIL; dùng `ring-2 ring-inset ring-[var(--error)]` (ring không ảnh hưởng kích thước ô). Kiểm tra lại bằng getComputedStyle sau khi chạy.
   Thêm: dòng ~552 còn `text-[11px]` → đổi `text-xs`. Nhãn "Tỷ lệ Đạt (Pass Rate)" → "Tỷ lệ đạt".

3. Trang Hỏi đáp — ô nhập vẫn 2 lớp viền khi focus:
   frontend/src/pages/StudentSubmitView.tsx: khi focus, container có viền xanh và textarea bên trong vẫn có viền/ô riêng. Sửa textarea: `border-0 outline-none ring-0 shadow-none focus:ring-0 focus:outline-none bg-transparent resize-none` (Tailwind CDN có thể thêm style form mặc định — kiểm tra computed style), chỉ container có `focus-within:ring-2`.

4. Hồ sơ câu hỏi (StudentHistoryView) chưa có tiêu đề trang như các trang workspace khác (Prompt 1 mục 6): thêm PageHeader "Hồ sơ câu hỏi" phía trên thanh tìm kiếm (ẩn trong chế độ đọc).

5. Chuỗi đếm "6 / 6 hồ sơ" (StudentHistoryView) và "37 hồ sơ chờ duyệt" (LecturerInboxView) đang dùng font mono + giãn chữ trông rời rạc → dùng font thường text-sm màu --on-surface-variant, bỏ tracking.

6. Ô chọn môn ở trang Hỏi đáp hiện trống (không có option) nếu GET /api/v1/demo/catalog lỗi lúc tải (vd API đang khởi động) và không bao giờ thử lại. Sửa trong App.tsx: nếu tải catalog lỗi thì thử lại sau 3 giây (tối đa 5 lần); trong lúc chưa có catalog, ô chọn môn hiện trạng thái "Đang tải môn học…" (disabled) thay vì ô trống.

7. Stepper ở chi tiết hồ sơ sinh viên: câu hỏi AI trả lời tự động (route ANSWER) vẫn hiện bước "Chờ Thẩm định" có dấu tích như đã qua giảng viên. Sửa: với ANSWER chỉ hiện 3 bước "Gửi câu hỏi → AI đối soát quy chế → Hoàn tất"; bước "Giảng viên thẩm định" chỉ xuất hiện khi route ESCALATE.

Kiểm tra chấp nhận:
- Dán rubric 35/35/20/10 khi đang có cả rubric gốc (30/40) và một bản cập nhật → bảng xung đột hiện CẢ HAI nguồn cũ, chủ đề hiện "Rubric chấm điểm", nút Lưu chỉ bật sau khi chọn.
- Chạy Verify: ô FAIL có viền đỏ rõ.
- Focus ô hỏi: chỉ một viền.
- npm run build pass.
```

---

## PROMPT 5C — Backend: câu trả lời sai do lớp cập nhật quy định (chạy TRƯỚC Prompt 6)

```
Bối cảnh: backend/ FastAPI + SQLAlchemy. Trả lời câu hỏi ở backend/app/services/questions.py; chủ đề quy chế ở backend/app/core/policy_topics.py; xử lý tài liệu upload ở backend/app/ingestion/local_processing.py.

VẤN ĐỀ ĐÃ XÁC MINH (sau khi giảng viên upload 2 tài liệu, Verify chỉ còn 12/16):

(a) Bản cập nhật rubric "cướp" câu hỏi về số thành viên nhóm:
   DB có 1 PolicyUpdate ACTIVE, policy_topic = GRADING_RUBRIC, content "Rubric cham diem do an CO3001: bao cao chiem 25%, san pham chiem 45%, trinh bay chiem 20%, hop tac nhom chiem 10%."
   Hỏi "Một nhóm đồ án được có bao nhiêu thành viên?" → route ANSWER, reason ACTIVE_POLICY_UPDATE, câu trả lời là nội dung rubric ở trên (SAI).
   Nguyên nhân: _applicable_policy_update (~dòng 279) gộp update_topics = policy_topics_in_text(update_content) ∪ {update.policy_topic}. Vì nội dung rubric có chữ "nhom" (trong "hop tac nhom") nên policy_topics_in_text trả cả GROUP_MEMBERSHIP → khớp topic câu hỏi; token overlap ("nhom", "do", "an"...) vượt ngưỡng 0.40.

(b) Mọi câu hỏi khác bị chuyển giảng viên với reason CONFLICTING_ACTIVE_DOCUMENTS:
   Hỏi "Quy định số lượng sinh viên trong nhóm là gì?" (group-b) → ESCALATE, CONFLICTING_ACTIVE_DOCUMENTS.
   Nguyên nhân: _has_conflicting_documents (~dòng 386) coi 2 Document ACTIVE cùng title nhưng khác content_hash là "xung đột phiên bản". Mọi tài liệu upload đều có title mặc định "Quy định học phần" (DocumentProcessingPage) → chỉ cần upload 2 lần là toàn bộ học phần bị coi là xung đột. Tài liệu upload thực chất là LỚP CẬP NHẬT (chunk metadata source_kind = "POLICY_UPDATE", retrieval_eligible = false), đã có cơ chế xử lý xung đột riêng lúc lưu, không phải phiên bản thay thế quy chế gốc.

(c) Dữ liệu không nhất quán: Document "doc-df75049e79384853b609" (upload) đang ACTIVE nhưng không còn PolicyUpdate nào trỏ tới.

YÊU CẦU:
1. _applicable_policy_update: với update có policy_topic khác "GENERAL", CHỈ dùng policy_topic đã lưu (canonical) để so khớp với topic câu hỏi — không mở rộng bằng policy_topics_in_text(nội dung). Chỉ khi update.policy_topic == "GENERAL" mới suy luận thêm từ nội dung. Giữ ngưỡng relevance hiện có.
2. Áp dụng cùng nguyên tắc cho việc suy luận topic của bản cập nhật lúc lưu (_publish_policy_update dùng infer_policy_topic(chunk)): kiểm tra infer_policy_topic ưu tiên đúng — câu chứa "rubric", "chấm điểm", "%" phải ra GRADING_RUBRIC dù có chữ "nhóm". Thêm test cho policy_topics: "hợp tác nhóm chiếm 10%" trong ngữ cảnh rubric không được làm câu bị gán GROUP_MEMBERSHIP khi đã có tín hiệu rubric mạnh hơn.
3. _has_conflicting_documents: loại các Document là tài liệu upload của giảng viên (có bản ghi DocumentProcessing tương ứng, hoặc chunk có source_kind "POLICY_UPDATE") khỏi phép kiểm tra trùng title. Chỉ tài liệu quy chế gốc (ingest từ thư mục data) mới được kiểm tra xung đột phiên bản.
4. Tính nhất quán dữ liệu: nếu một Document upload ACTIVE không còn PolicyUpdate ACTIVE/SUPERSEDED nào → không ảnh hưởng trả lời (chunk của nó vốn retrieval_eligible=false). Không cần migration; chỉ đảm bảo code không dựa vào Document upload ACTIVE ở bất kỳ nhánh trả lời nào khác (grep DocumentStatus.ACTIVE trong services/questions.py và kiểm tra từng chỗ).
5. Test (backend/tests/): tạo 2 tài liệu upload cùng title "Quy định học phần", lưu cả hai → hỏi "Quy định số lượng sinh viên trong nhóm là gì?" vẫn ANSWER "3 đến 5"; có PolicyUpdate rubric 25/45 → hỏi số thành viên nhóm vẫn trả "3 đến 5" (không trả rubric); hỏi "Rubric chấm điểm báo cáo và sản phẩm như thế nào?" trả theo bản cập nhật 25%/45%.
6. Chạy toàn bộ pytest phải pass.

Lưu ý cho người chạy: sau khi sửa xong, bấm "Reset dữ liệu demo" (menu tài khoản) để xóa các tài liệu test, rồi chạy Verify Harness — kỳ vọng 16/16. (Nếu còn bản cập nhật rubric 25/45 thì ca verify_002 kỳ vọng "30%/40%" sẽ FAIL là đúng.)
```

---

## PROMPT 6 — Backend: trích dẫn không liên quan + khôi phục downgrade migration

```
Bối cảnh: backend/ FastAPI + SQLAlchemy + Alembic. Chỉ sửa backend, không đụng frontend.

VẤN ĐỀ ĐÃ XÁC MINH:
(a) Trích dẫn không liên quan:
   - backend/app/services/questions.py, hàm _build_question_response (~dòng 885): citations lấy `item for item in evidence if item["label"] in labels or question.route == Route.ESCALATE` → với route ESCALATE, TOÀN BỘ evidence được trả làm trích dẫn. Ví dụ: hỏi "Hạn chót xin hủy môn học…" (ESCALATE, không có quy định) vẫn kèm trích dẫn "Rubric đánh giá đồ án" và "Quy định sử dụng AI".
   - _load_evidence (~dòng 115) lấy chunk theo chunk_index + limit, không theo độ liên quan; với ANSWER, model đôi khi trả hết nhãn C1–C3 dù câu hỏi chỉ về số thành viên nhóm (kết quả hiện 3 trích dẫn: nhóm, rubric, AI).
(b) Commit 9a16d3e đã SỬA downgrade() của các migration cũ:
   - backend/migrations/versions/20261013_0009_restore_vector_rag.py: downgrade đổi từ raise NotImplementedError thành `pass` (âm thầm không làm gì).
   - backend/migrations/versions/20261013_0010_restore_hybrid_rag.py: downgrade giờ drop index/trigger/cột search_vector VÀ `op.drop_table("policy_versions")` → mất dữ liệu phiên bản quy định khi downgrade.
   - backend/migrations/versions/20261012_0006_local_document_processing.py: downgrade đổi sang batch_alter_table.
   Hãy xem backend/tests/test_migrations.py để hiểu vì sao commit đó sửa (có thể test yêu cầu downgrade chạy được).

YÊU CẦU:
1. Trích dẫn:
   - Với ESCALATE/CLARIFY/REJECT: chỉ trả citations có label nằm trong decision.citation_labels; nếu labels rỗng → citations rỗng. Bỏ điều kiện `or question.route == Route.ESCALATE`.
   - Với ANSWER: sau khi có labels từ model, lọc thêm: chỉ giữ citation có topic khớp topic câu hỏi (infer_policy_topic(question) ∈ policy_topics_in_text(chunk)) hoặc policy_token_overlap(question, chunk) ≥ 0.2; luôn giữ ít nhất 1 citation có điểm cao nhất nếu lọc hết (ANSWER bắt buộc có trích dẫn — xem điều kiện citOk trong frontend VerifyPage).
   - Kiểm tra màn chi tiết case của giảng viên (GET /api/v1/cases/{id}) dùng cùng logic lọc.
   - Test: câu "Một nhóm đồ án được có bao nhiêu thành viên?" chỉ có trích dẫn về thành viên nhóm; câu hủy môn (ESCALATE) không kèm trích dẫn rubric/AI.
   - Chạy lại 16 ca của harness (harness/ hoặc test tương đương trong backend/tests) phải vẫn đạt.
2. Migration:
   - Khôi phục downgrade của 0009 và 0010 về như trước commit 9a16d3e (`git show b1ef094:<path>`): raise NotImplementedError với thông điệp hướng dẫn khôi phục từ backup. Không được có downgrade drop bảng policy_versions.
   - 0006: chỉ giữ thay đổi nếu thực sự cần cho SQLite trong test; nếu giữ, đảm bảo trên PostgreSQL vẫn drop foreign key trước khi drop cột (hoặc chứng minh batch_alter_table xử lý đúng).
   - Nếu test_migrations.py cần downgrade toàn chuỗi, sửa TEST cho phù hợp (vd chỉ kiểm tra upgrade head + downgrade tới trước 0009), không sửa migration cũ để chiều test.
   - KHÔNG thêm migration mới cho việc này.
3. Chạy toàn bộ pytest phải pass.

Kiểm tra chấp nhận:
- Hỏi "Hạn chót để sinh viên được phép xin hủy môn học…" → hồ sơ chuyển GV, không kèm trích dẫn rubric/AI.
- Hỏi số thành viên nhóm → chỉ trích dẫn quy định nhóm.
- git diff b1ef094 -- backend/migrations/versions/20261013_0009_restore_vector_rag.py backend/migrations/versions/20261013_0010_restore_hybrid_rag.py → không còn khác biệt.
- pytest pass.
```
