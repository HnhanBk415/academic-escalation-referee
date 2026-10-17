# Phòng Công tác Sinh viên — policy tiếp nhận dịch vụ

> **TÀI LIỆU MÔ PHỎNG — KHÔNG PHẢI QUY ĐỊNH CHÍNH THỨC**  
> Service: `student_affairs` · Đơn vị chịu trách nhiệm: Phòng Công tác Sinh viên · Phiên bản: `SA-POLICY-v1`.  
> Dữ liệu và quy trình dưới đây chỉ dùng để minh họa cách tiếp nhận; không chứa điểm thật, không sửa kết quả thật và không thay thế hướng dẫn đã được trường phê duyệt.

## Phạm vi và quyết định xử lý

| Nhu cầu sau khi định tuyến | Dữ kiện cần có | Backend được làm | Trạng thái đúng |
|---|---|---|---|
| Hỏi cách xem điểm/kết quả rèn luyện | Chủ đề câu hỏi; học kỳ nếu cần tra cứu cá nhân | Trả lời giới hạn dữ liệu trong policy; không bịa điểm hoặc portal | `ANSWERED`, `NEEDS_INFO` hoặc `WAITING_FOR_STAFF` |
| Tra kết quả rèn luyện cá nhân | Học kỳ | Tạo yêu cầu để nhân viên kiểm tra; không đọc điểm từ hệ thống trường | `NEEDS_INFO` hoặc `WAITING_FOR_STAFF` |
| Báo kết quả thiếu/sai hoặc xin xem xét | Học kỳ và mô tả ngắn trong yêu cầu | Tạo hồ sơ cho nhân viên đánh giá; AI không chấm, sửa hoặc phê duyệt | `NEEDS_INFO` hoặc `WAITING_FOR_STAFF` |
| Hỏi/xin học bổng hoặc hỗ trợ sinh viên | Chủ đề; quy định đã duyệt nếu cần kết luận điều kiện | Chỉ trả lời nội dung có trong nguồn; còn thiếu nguồn thì chuyển nhân viên | `ANSWERED` hoặc `WAITING_FOR_STAFF` |
| Tra trạng thái hồ sơ | Mã `DEMO-SA-REQ-*` | Chỉ đọc hồ sơ thuộc chính người gửi | `COMPLETED` hoặc `WAITING_FOR_STAFF` |
| Hỏi đầu mối liên hệ | Không cần | Trả mã đầu mối mẫu, không giả làm thông tin liên hệ thật | `ANSWERED` |

## Điểm và kết quả rèn luyện

Kho dữ liệu hiện không có điểm rèn luyện cá nhân, thang chấm chính thức, lịch công bố theo học kỳ hoặc cổng tra cứu đã được xác minh. Vì vậy:

- Hỏi “điểm rèn luyện của em là bao nhiêu” không được trả điểm từ suy đoán hay từ hồ sơ người khác. Cần học kỳ để tạo yêu cầu cho nhân viên kiểm tra.
- Hỏi cách xem kết quả chỉ được trả lời trong phạm vi tài liệu này: ứng dụng chưa có nguồn đã duyệt để chỉ tên portal, đường dẫn hoặc các bước đăng nhập cụ thể. Khi cần hướng dẫn chính thức, chuyển Phòng Công tác Sinh viên.
- Báo thiếu, sai hoặc xin xem xét kết quả cần học kỳ; nội dung được chuyển nhân viên. Việc tiếp nhận không có nghĩa điểm đã được xác nhận hay điều chỉnh.
- Không tự tính điểm, áp dụng thang điểm, đánh giá hạnh kiểm hoặc quyết định khiếu nại.

## Học bổng và hỗ trợ sinh viên

Tài liệu hiện không có điều kiện học bổng, mức hỗ trợ, thời hạn nộp, hồ sơ cần nộp hoặc quy trình xét duyệt đã được phê duyệt. Không khẳng định người gửi đủ điều kiện, không hứa mức hỗ trợ và không tự tạo lịch hạn. Chuyển câu hỏi cần quyết định hoặc thông tin chính thức cho nhân viên Phòng Công tác Sinh viên.

## Tra trạng thái hồ sơ

Chỉ tra mã `DEMO-SA-REQ-*` và chỉ trả hồ sơ thuộc actor đang đăng nhập. Bản ghi `DEMO-SA-REQ-001` là dữ liệu mô phỏng có trạng thái `PROCESSING`; trạng thái này không phải kết quả về điểm. Mã không tồn tại hoặc không thuộc người gửi không được tiết lộ; chuyển nhân viên rà soát.

## Đầu mối và trách nhiệm

- Mã đầu mối mẫu: `DEMO-STUDENT-AFFAIRS-DESK`. Đây không phải số điện thoại, email hoặc địa chỉ thật.
- AI đề xuất service/intent và trích xuất học kỳ nếu người dùng nêu rõ. Backend kiểm tra catalog, trường bắt buộc, vai trò và quyền sở hữu hồ sơ.
- Yêu cầu về điểm rèn luyện, học bổng hoặc hỗ trợ thuộc Phòng Công tác Sinh viên; đăng ký/rút học phần và bảng điểm học vụ thuộc Phòng Đào tạo. Không định tuyến chỉ dựa trên từ “điểm”; phải xét chủ đề của yêu cầu.
- Khi policy không có câu trả lời hoặc cần nhân viên quyết định, giữ yêu cầu tại hàng đợi Phòng Công tác Sinh viên. Yêu cầu chưa xác định được dịch vụ phù hợp mới chuyển `triage_desk`.
- Mỗi yêu cầu hiển thị đơn vị nhận, trạng thái, bước tiếp theo, SLA, request ID và policy version nếu có; mọi audit chỉ dùng nội dung đã qua privacy gate.
