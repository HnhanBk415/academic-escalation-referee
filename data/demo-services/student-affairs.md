# Phòng Công tác Sinh viên — dữ liệu chuẩn bị sau MVP

> **DỮ LIỆU GIẢ LẬP — KHÔNG CHÍNH THỨC**  
> Phiên bản: `DEMO-STUDENT-AFFAIRS-POLICY-v1` · Service dự kiến: `student_affairs` · Đơn vị dự kiến: Phòng Công tác Sinh viên.  
> **Chưa thuộc phạm vi MVP 3 giờ** theo `MVP_SERVICE_ROUTING_DECISIONS.md`. Tài liệu này chỉ là dữ liệu giả lập để mở rộng sau hackathon; ứng dụng hiện tại không được tuyên bố đã hỗ trợ service này.

## Tình huống dự kiến sau MVP

| Intent dự kiến | Dữ kiện tối thiểu | Cách xử lý dự kiến |
|---|---|---|
| Hỏi cách xem điểm rèn luyện | Học kỳ, nếu câu hỏi cần kết quả theo kỳ | Trả hướng dẫn mẫu kèm nguồn/version; không đưa ra điểm số. |
| Báo thiếu hoặc sai kết quả rèn luyện | Học kỳ và mô tả ngắn | Tạo hồ sơ rà soát cho nhân viên; không tự chấm hay sửa điểm. |
| Tra tình trạng hồ sơ sinh viên | Mã hồ sơ `DEMO-*` | Chỉ đọc trạng thái từ bản ghi mẫu. |
| Hỏi đầu mối hỗ trợ | Không cần | Trả `DEMO-STUDENT-AFFAIRS-DESK`, không đưa liên hệ thật. |

Trong MVP hiện tại, yêu cầu thuộc các intent này đi vào `triage_desk` với reason code `SERVICE_NOT_YET_CATALOGED`; bộ phận điều phối xác định đầu mối phù hợp. Không tự route sang `student_affairs` như một service đang hoạt động.

## FAQ mô phỏng cho giai đoạn sau

**Làm sao xem điểm rèn luyện?**  
Khi dịch vụ được triển khai, sinh viên gửi học kỳ cần tra cứu để được hướng dẫn tới đầu mối phụ trách. Hệ thống chưa có cơ sở dữ liệu điểm thật, nên không hiển thị hoặc suy đoán điểm.

**Kết quả rèn luyện của tôi chưa hiện thì sao?**  
Gửi học kỳ và mô tả ngắn để nhân viên rà soát. Hồ sơ được ghi nhận với mã mẫu và trạng thái xử lý; không đồng nghĩa điểm đã được điều chỉnh.

**Tôi có thể xin xác nhận kết quả qua chatbot không?**  
Không. Chatbot không cấp xác nhận/chứng từ chính thức. Nhân viên phụ trách quyết định theo quy trình thật sau MVP.

## Bản ghi mẫu cho thiết kế và kiểm thử sau MVP

| Mã hồ sơ | Sinh viên giả lập | Loại yêu cầu | Học kỳ mẫu | Trạng thái | Điểm số |
|---|---|---|---|---|---|
| `DEMO-SA-REQ-001` | `demo-student-01` | Rà soát kết quả rèn luyện chưa hiển thị | `DEMO-TERM-01` | `PROCESSING` | Không có dữ liệu điểm. |

Không dùng tên thật, MSSV thật, điểm thật hoặc quy chế trường chưa được duyệt. Khi service được bổ sung sau MVP, Service Catalog phải xác định đơn vị nhận, required fields, role, SLA, policy source/version và các hành động mock được phép trước khi trả lời tự động.
