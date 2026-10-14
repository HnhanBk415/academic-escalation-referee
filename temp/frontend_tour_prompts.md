# Prompt thêm hướng dẫn sử dụng từng bước (product tour) — driver.js

> Chạy lần lượt **Prompt T1 → T2**, mỗi prompt một phiên/lượt riêng. Chỉ copy phần trong khung code.
> Sau mỗi prompt: `cd frontend && npm run build` → `docker compose up -d --build web` → kiểm tra tay → commit.
> Dùng **driver.js** (giấy phép MIT) thay cho Intro.js (AGPL-3.0) — cùng chức năng, không vướng giấy phép.

---

## PROMPT T1 — Hạ tầng tour + giao diện popover bo tròn + tour khung ứng dụng

```
Bối cảnh: frontend/ là React + Vite + TypeScript, routing bằng react-router-dom (frontend/src/App.tsx), styling = Tailwind CDN + CSS token Material 3 trong frontend/src/styles.css (--surface, --surface-container, --primary, --on-surface, --on-surface-variant, --outline, --radius-*...), cỡ chữ gốc co giãn theo rem. Header: frontend/src/components/AppHeader.tsx; menu tài khoản demo: frontend/src/components/AccountSwitcher.tsx (SV Nguyễn Văn A, SV Trần Thị B, GV TS. Trần Minh Tuấn); thanh tính năng bên trái: frontend/src/components/WorkspaceRail.tsx. Component dùng chung ở frontend/src/components/ui/.

MỤC TIÊU: Thêm hướng dẫn từng bước (product tour) để người dùng mới hiểu cách dùng và cách test web demo. Khi vào một trang lần đầu, tour của trang đó tự hiện; có nút để xem lại bất cứ lúc nào.

YÊU CẦU:

1. Thư viện: cài driver.js (MIT), PIN phiên bản chính xác 1.x mới nhất ổn định trong package.json (không dùng "latest" hay "^"). Import CSS gốc "driver.js/dist/driver.css" một lần ở main.tsx. KHÔNG dùng Intro.js.

2. Kiến trúc (không viết lặp ở từng trang):
   - frontend/src/tour/tourSteps.ts: khai báo bước tour theo key trang: "home", "ask", "history", "inbox", "exceptions", "documents", "audit", "verify", và "app-shell" (tour chung về khung app). Mỗi bước: { element: string (selector `[data-tour="..."]`), title, description, side?, align? }. Nội dung bước cụ thể của từng trang sẽ bổ sung ở Prompt T2; ở prompt này chỉ cần "app-shell" + 1–2 bước mẫu cho mỗi trang để kiểm thử.
   - frontend/src/tour/useTour.ts: hook nhận pageKey, trả về { startTour, hasSeen }. Dùng `driver({...})` cấu hình chung (mục 4). Bỏ qua bước có element không tồn tại trong DOM tại thời điểm chạy (lọc trước khi drive), để tour không vỡ khi dữ liệu trống.
   - frontend/src/tour/TourContext.tsx: provider ở App, biết route hiện tại → pageKey (map pathname: "/" → home, "/workspace/ask" → ask, "/workspace/history*" → history, "/workspace/inbox*" → inbox, "/workspace/exceptions" → exceptions, "/workspace/documents" → documents, "/audit" → audit, "/verify" → verify).
   - Gắn mốc bằng thuộc tính `data-tour="..."` trên phần tử (KHÔNG dùng class Tailwind hay id ngẫu nhiên làm selector).

3. Khi nào tour hiện:
   - Lần đầu mở mỗi trang (theo từng vai trò: key localStorage `aer_tour_seen:<role>:<pageKey>`, bọc try/catch) → tự chạy tour trang đó sau khi trang tải xong dữ liệu (chờ 600ms hoặc khi phần tử đầu tiên của tour đã render; tối đa chờ 3 giây).
   - Lần đầu mở app (chưa có key nào) → chạy "app-shell" trước, xong mới chạy tour trang hiện tại.
   - Không tự chạy khi đang ở chế độ đọc (?read=1) hoặc khi đang có Modal mở.
   - Màn hình < 768px: không tự chạy, nhưng vẫn cho chạy thủ công.

4. Nút xem lại hướng dẫn trong AppHeader (cạnh menu tài khoản): IconButton tròn icon `HelpCircle` (lucide-react), tooltip "Hướng dẫn trang này", data-tour="help-button". Bấm → menu nhỏ 3 mục: "Hướng dẫn trang này", "Giới thiệu giao diện chung", "Đặt lại tất cả hướng dẫn" (xóa mọi key aer_tour_seen:*, hiện toast/notice ngắn "Hướng dẫn sẽ hiện lại khi bạn mở từng trang").
   Thêm mục "Xem hướng dẫn sử dụng" trong menu tài khoản, phần "Công cụ demo", gọi cùng chức năng.

5. Cấu hình driver dùng chung:
   showProgress: true, progressText: "{{current}} / {{total}}", nextBtnText: "Tiếp", prevBtnText: "Quay lại", doneBtnText: "Đã hiểu", allowClose: true, overlayOpacity: 0.45, stagePadding: 6, stageRadius: 12, smoothScroll: true, animate: true (tắt animate nếu prefers-reduced-motion), popoverClass: "aer-tour-popover".
   onDestroyed → ghi key đã xem. Phím Esc đóng, ←/→ chuyển bước.

6. Giao diện popover BO TRÒN, đồng bộ Material 3 (yêu cầu bắt buộc của người dùng — không để góc vuông):
   Viết CSS override trong styles.css cho `.driver-popover.aer-tour-popover`:
   - border-radius: 1.25rem (20px); padding: 1.25rem 1.25rem 1rem; max-width: 22rem; background: var(--surface); color: var(--on-surface); border: 1px solid color-mix(in srgb, var(--outline) 40%, transparent); box-shadow nhẹ (0 8px 24px rgba(0,0,0,.12), 0 2px 6px rgba(0,0,0,.08)); font-family kế thừa (Roboto).
   - Tiêu đề `.driver-popover-title`: 1.0625rem, font-weight 500, màu var(--on-surface), margin-bottom .375rem.
   - Mô tả `.driver-popover-description`: .9375rem, line-height 1.6, màu var(--on-surface-variant).
   - Tiến độ `.driver-popover-progress-text`: .8125rem, màu var(--on-surface-variant).
   - Nút `.driver-popover-footer button`: dạng pill border-radius 999px, height 2.25rem, padding 0 1rem, font .875rem/500, BỎ text-shadow mặc định của driver.js; nút "Tiếp/Đã hiểu" = filled (bg var(--primary), chữ var(--on-primary)); nút "Quay lại" = tonal (bg var(--surface-container-high), chữ var(--on-surface)); hover đậm hơn nhẹ; focus-visible ring 2px var(--primary).
   - Nút đóng `.driver-popover-close-btn`: tròn 2rem, góc trên phải, màu var(--on-surface-variant), hover nền var(--surface-container).
   - Mũi tên `.driver-popover-arrow` cùng màu nền popover (chỉnh các biến/viền mũi tên theo side để khớp màu --surface).
   - Vùng highlight (stage) bo góc 12px (stageRadius ở mục 5).
   - Không dùng gradient, emoji.

7. Tour "app-shell" (6 bước, nội dung tiếng Việt, ngắn gọn):
   (1) data-tour="app-logo" — "Chào mừng đến AER" — "AER giúp sinh viên tra cứu quy chế môn học. Câu hỏi vượt thẩm quyền AI sẽ được chuyển tới giảng viên duyệt."
   (2) data-tour="main-nav" — "Các khu vực chính" — "Trang chủ giới thiệu hệ thống; Không gian làm việc là nơi hỏi đáp và duyệt hồ sơ; Audit Log ghi lại mọi bước xử lý; Verify Harness chạy bộ kiểm thử tự động."
   (3) data-tour="account-switcher" — "Đổi vai trò để test" — "Bản demo không cần đăng nhập. Chọn Sinh viên A, Sinh viên B hoặc Giảng viên để xem hệ thống từ mỗi phía."
   (4) data-tour="workspace-rail" (chỉ khi đang ở /workspace/*) — "Tính năng theo vai trò" — "Rê chuột vào mép trái để mở menu. Sinh viên: Hỏi đáp, Xem các câu đã hỏi. Giảng viên: Câu hỏi cần duyệt, Ngoại lệ đã duyệt, Tải quy chế."
   (5) data-tour="help-button" — "Xem lại hướng dẫn" — "Bấm vào đây bất cứ lúc nào để xem lại hướng dẫn của trang đang mở."
   (6) data-tour="account-switcher" — "Reset dữ liệu demo" — "Trong menu tài khoản có mục Reset dữ liệu demo để đưa hệ thống về trạng thái ban đầu trước khi test lại."

Kiểm tra chấp nhận:
- Mở app lần đầu (xóa localStorage): tour app-shell chạy, xong chuyển sang tour trang hiện tại; F5 không chạy lại.
- Nút ? trong header chạy lại tour trang hiện tại; "Đặt lại tất cả hướng dẫn" làm tour hiện lại khi mở từng trang.
- Popover bo tròn rõ (~20px), nút dạng pill, màu theo token, không còn góc vuông/viền mặc định của driver.js.
- Bước có phần tử không tồn tại bị bỏ qua, tour không lỗi; không có lỗi console.
- npm run build pass.
```

---

## PROMPT T3 — Sửa lỗi tour không ghi nhớ "đã xem" (chạy SAU T1, T2)

```
Bối cảnh: tour dùng driver.js 1.9.0 (MIT). Code: frontend/src/tour/TourContext.tsx (runTour, auto-run trong useEffect, chain "app-shell" → tour trang), frontend/src/tour/tourSteps.ts, frontend/src/tour/useTour.ts, test frontend/src/tour/tour.test.ts. Chỉ sửa frontend, không đổi nội dung bước tour và giao diện popover.

LỖI ĐÃ XÁC MINH TRÊN TRÌNH DUYỆT:
- Đi hết các bước và bấm "Đã hiểu" ở bước cuối → popover/overlay biến mất nhưng KHÔNG ghi key `aer_tour_seen:<role>:<pageKey>` (đã theo dõi Storage.prototype.setItem: không có lệnh ghi nào). Bấm nút X (đóng) thì có ghi.
- Hậu quả nghiêm trọng ở vai trò Giảng viên: key "app-shell" không bao giờ được lưu → MỌI trang (inbox, exceptions, documents, audit) đều tự chạy lại tour "Chào mừng đến AER" 6 bước, và tour riêng của trang không bao giờ hiện (chain onComplete nằm trong onDestroyed nên cũng không chạy). Với sinh viên, F5 sau khi bấm "Đã hiểu" cũng hiện lại tour.
- Phân tích: trong driver.js 1.9.0 (dist/driver.js.mjs, hàm destroy), onDestroyed chỉ được gọi khi state còn __activeElement và __activeStep; driver.js giữ state ở module toàn cục (dùng chung giữa mọi instance tạo bằng driver()). runTour tạo instance mới mỗi lần và auto-run có thể gọi runTour từ nhiều lần chạy effect → state/config bị ghi đè, khiến destroy ở bước cuối không còn active step và bỏ qua onDestroyed.

YÊU CẦU:
1. Không dựa vào onDestroyed để ghi trạng thái. Dùng hook onDestroyStarted: `onDestroyStarted: (_el, _step, { driver }) => { markTourSeen(...); driver.destroy(); }` (lưu ý: khi khai báo onDestroyStarted, driver.js KHÔNG tự destroy — phải gọi driver.destroy()). Đồng thời ghi key ngay khi người dùng tới bước cuối (onHighlightStarted của bước cuối) để chắc chắn.
2. Chuyển logic chain (app-shell xong → tour trang) sang một callback chạy SAU khi destroy hoàn tất (setTimeout 250ms sau driver.destroy() trong onDestroyStarted), không đặt trong onDestroyed.
3. Chỉ dùng MỘT instance driver cho cả app (tạo một lần trong TourProvider bằng useRef, đổi tour bằng `setConfig({...})` + `setSteps(steps)` rồi `drive()`), vì driver.js dùng state toàn cục. Trước khi chạy tour mới: nếu isActive() thì destroy() trước.
4. Auto-run: bảo đảm mỗi lần đổi route chỉ có tối đa một lần gọi runTour (dùng ref cờ "đang lên lịch"/"đang chạy"; hủy interval cũ khi effect chạy lại; không chạy nếu isActive()).
5. Nhỏ: ẩn nút "Quay lại" ở bước đầu tiên (driver.js: showButtons theo từng bước hoặc disableButtons + CSS ẩn nút disabled) thay vì hiện nút xám.
6. Thêm test vào tour.test.ts (vitest + jsdom, mock driver.js nếu cần) cho: hoàn thành tour bằng nút cuối → ghi key; đóng bằng X → ghi key; app-shell xong → tour trang được gọi đúng một lần.

Kiểm tra chấp nhận (làm tay trên trình duyệt):
- Xóa mọi key aer_tour_seen:* → mở /workspace/inbox bằng tài khoản Giảng viên → tour "Chào mừng" chạy, bấm Tiếp tới "Đã hiểu" → tour "Câu hỏi cần duyệt" tự chạy tiếp → bấm hết → F5 không hiện lại tour nào.
- Mở /workspace/exceptions, /workspace/documents: chỉ chạy tour riêng của trang (không lặp tour "Chào mừng").
- Làm tương tự với tài khoản Sinh viên ở /workspace/ask và /workspace/history.
- Kiểm tra localStorage có đủ key aer_tour_seen:lecturer:app-shell, :inbox, :exceptions, :documents.
- npm run build và vitest pass.
```

---

## PROMPT T2 — Nội dung tour cho từng trang (chạy SAU T1)

```
Tiếp nối Prompt T1 (đã có driver.js, frontend/src/tour/tourSteps.ts, useTour, TourContext, CSS popover bo tròn). Việc của prompt này: gắn `data-tour` vào các phần tử và viết đầy đủ bước tour cho từng trang trong tourSteps.ts. KHÔNG đổi logic/API, KHÔNG đổi giao diện ngoài việc thêm thuộc tính data-tour.

Quy tắc viết nội dung: tiếng Việt, câu ngắn, mỗi mô tả ≤ 2 câu, nói rõ "làm gì" và "để test điều gì". Không dùng emoji, không viết hoa toàn bộ. Nếu phần tử chỉ xuất hiện khi có dữ liệu (vd dòng đầu danh sách, panel chi tiết) thì vẫn khai báo bước — useTour sẽ tự bỏ qua khi không có.

1. Trang chủ "/" (HomePage.tsx) — pageKey "home":
   - home-hero — "Bắt đầu nhanh": "Nút này đưa bạn tới nơi làm việc chính của vai trò hiện tại."
   - home-steps — "Quy trình 3 bước": "Tóm tắt cách đặt câu hỏi để AI trả lời chính xác."
   - home-routing — "Cách AI phân luồng": "AI có 4 cách xử lý: trả lời trực tiếp, hỏi lại khi thiếu thông tin, chuyển giảng viên khi vượt thẩm quyền, từ chối khi yêu cầu bất thường."

2. Hỏi đáp "/workspace/ask" (StudentSubmitView.tsx) — pageKey "ask":
   - ask-course — "Chọn môn học": "Câu trả lời chỉ dựa trên quy chế của môn bạn chọn."
   - ask-group — "Chọn nhóm": "Mặc định là nhóm của tài khoản. Có thể đổi sang nhóm khác để test hai sinh viên cùng một nhóm."
   - ask-input — "Đặt câu hỏi": "Nhập câu hỏi rồi nhấn Enter để gửi, Shift+Enter để xuống dòng."
   - ask-suggestions — "Gợi ý nhanh": "Bấm một gợi ý để điền sẵn câu hỏi mẫu."
   - ask-progress — "Theo dõi xử lý": "Thanh tiến trình cho biết AI đang ở bước nào và câu hỏi được phân luồng ra sao."
   - ask-result — "Đọc kết quả": "Mỗi câu trả lời đều kèm trích dẫn quy chế. Nếu cần ngoại lệ, bấm Chuyển tiếp hồ sơ để gửi giảng viên."
   - ask-try — (gắn vào ô nhập, bước cuối) "Thử ngay": "Hỏi 'Nhóm em xin phép có 6 thành viên được không?' để xem một yêu cầu được chuyển giảng viên. Sau đó đổi sang tài khoản Giảng viên để duyệt."

3. Hồ sơ câu hỏi "/workspace/history" (StudentHistoryView.tsx) — pageKey "history":
   - history-search — "Tìm hồ sơ": "Tìm theo nội dung câu hỏi hoặc mã hồ sơ."
   - history-filters — "Lọc theo trạng thái": "Xem riêng các câu AI đã trả lời, đang chờ giảng viên, đã duyệt hoặc bị từ chối."
   - history-first-row — "Mở một hồ sơ": "Bấm vào một dòng để xem chi tiết bên phải. Phím j/k để chuyển câu, Esc để đóng."
   - history-reading-mode (nút Chế độ đọc trong panel chi tiết) — "Chế độ đọc": "Ẩn danh sách và phóng to chữ để đọc câu trả lời dễ hơn; chỉnh cỡ chữ bằng A−/A/A+."
   - history-refresh (nút Làm mới kết quả) — "Cập nhật kết quả": "Khi giảng viên đã duyệt, bấm để xem quyết định mới nhất."

4. Câu hỏi cần duyệt "/workspace/inbox" (LecturerInboxView.tsx) — pageKey "inbox":
   - inbox-filters — "Hàng chờ thẩm định": "Danh sách các câu hỏi AI đã chuyển lên vì vượt thẩm quyền."
   - inbox-first-row — "Mở hồ sơ": "Mỗi dòng là câu hỏi gốc của sinh viên kèm nhóm và chủ đề quy chế."
   - inbox-citations — "Căn cứ quy chế": "Các đoạn quy chế AI đã đối chiếu, dùng làm căn cứ khi quyết định."
   - inbox-decision — "Ra quyết định": "Chọn Phê duyệt, Từ chối, Cần thêm thông tin hoặc Chuyển tiếp, và ghi lý do bắt buộc."
   - inbox-exception — "Tạo ngoại lệ": "Khi phê duyệt có thể tạo ngoại lệ cho nhóm hoặc sinh viên; câu hỏi sau của họ sẽ được AI áp dụng ngoại lệ này."
   - inbox-sla — "Thời hạn xử lý": "Đồng hồ cho biết thời gian còn lại trước khi hồ sơ quá hạn."

5. Ngoại lệ đã duyệt "/workspace/exceptions" (ExceptionsView.tsx) — pageKey "exceptions":
   - exceptions-filters — "Lọc ngoại lệ": "Lọc theo phạm vi (toàn môn, nhóm, cá nhân) và trạng thái."
   - exceptions-table — "Danh sách ngoại lệ": "Mỗi ngoại lệ có chủ đề, nội dung và thời hạn hiệu lực."
   - exceptions-revoke (nút Thu hồi dòng đầu) — "Thu hồi": "Thu hồi khi điều kiện không còn; sinh viên hỏi lại sẽ nhận quy định chung."

6. Tiếp nhận quy định "/workspace/documents" (DocumentProcessingPage.tsx) — pageKey "documents":
   - docs-stepper — "Ba bước tiếp nhận": "Nhập nguồn tài liệu, rà soát phần nhận dạng chưa chắc chắn, rồi kiểm tra xung đột trước khi lưu."
   - docs-meta — "Thông tin tài liệu": "Đặt tiêu đề và phiên bản để phân biệt các lần cập nhật."
   - docs-upload — "Tải tệp": "Hỗ trợ PDF, Word, ảnh chụp. Ảnh và PDF scan được nhận dạng chữ tự động."
   - docs-text — "Hoặc dán văn bản": "Dán trực tiếp nội dung quy định nếu không có tệp."
   - docs-submit — "Trích xuất": "Hệ thống chưa lưu gì vào quy chế ở bước này; bạn có thể hủy bất cứ lúc nào."
   - docs-conflicts (chỉ có ở bước 3) — "Xử lý xung đột": "Nếu nội dung mới khác quy chế gốc hoặc bản cập nhật trước, chọn dùng bản mới hay giữ bản cũ cho từng đoạn."
   - docs-try — (gắn vào ô dán văn bản, bước cuối) "Thử ngay": "Dán 'Rubric đánh giá đồ án CO3001: báo cáo 35%, sản phẩm 35%, trình bày 20%, hợp tác nhóm 10%.' để thấy cảnh báo xung đột với rubric gốc."

7. Audit Log "/audit" (AuditPage.tsx) — pageKey "audit":
   - audit-search — "Tìm sự kiện": "Tìm theo mã hồ sơ, người thực hiện hoặc lý do."
   - audit-filters — "Lọc loại sự kiện": "Xem riêng các bước phân luồng, quyết định, ngoại lệ hoặc thay đổi quy định."
   - audit-table — "Nhật ký không sửa được": "Mỗi bước AI và con người đều được ghi lại để truy vết."
   - audit-expand (nút mở chi tiết dòng đầu) — "Xem chi tiết": "Mở để xem dữ liệu vào/ra của từng bước."

8. Verify Harness "/verify" (VerifyPage.tsx) — pageKey "verify":
   - verify-run — "Chạy kiểm thử": "Chạy 16 tình huống mẫu để kiểm tra AI phân luồng đúng. Dữ liệu test được tách riêng, không làm đầy hàng chờ giảng viên."
   - verify-metrics — "Chỉ số chính": "Tỷ lệ đạt, tỷ lệ chuyển thừa (câu thường bị đẩy lên giảng viên) và tỷ lệ bỏ sót (câu cần thẩm quyền nhưng AI tự trả lời)."
   - verify-latency — "Thời gian xử lý": "Mỗi ô là một ca: xanh dưới 2 giây, vàng 2–5 giây, đỏ trên 5 giây; viền đỏ là ca thất bại. Bấm ô để tới dòng tương ứng."
   - verify-table — "Kết quả từng ca": "So sánh phân luồng dự kiến và thực tế của từng câu hỏi."

9. Gắn data-tour tương ứng vào đúng phần tử trong các file đã nêu; với phần tử dạng danh sách chỉ gắn vào phần tử ĐẦU TIÊN (vd history-first-row, inbox-first-row). Tour của trang chỉ dành cho vai trò có quyền vào trang đó.

10. Một tour "kịch bản test" ngắn tùy chọn (pageKey "demo-scenario", chỉ chạy thủ công từ menu nút ? → mục mới "Kịch bản test nhanh"): 4 bước hướng dẫn chuỗi thao tác — (1) ở tài khoản Sinh viên A, gửi câu xin 6 thành viên; (2) đổi sang tài khoản Giảng viên; (3) mở hồ sơ trong Câu hỏi cần duyệt, phê duyệt kèm tạo ngoại lệ; (4) quay lại Sinh viên A, mở Hồ sơ câu hỏi và bấm Làm mới kết quả. Mỗi bước gắn vào phần tử liên quan đang có trên trang hiện tại (account-switcher, workspace-rail...), không tự điều hướng.

Kiểm tra chấp nhận:
- Mỗi trang (đăng nhập đúng vai trò) mở lần đầu đều tự chạy tour với đúng nội dung trên; trang trống dữ liệu vẫn chạy được (bỏ qua bước thiếu phần tử).
- grep `data-tour=` cho thấy đủ các mốc đã liệt kê.
- Không thay đổi hành vi nào khác của trang; npm run build pass.
```
