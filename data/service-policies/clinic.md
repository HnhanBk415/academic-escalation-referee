# Trạm Y tế — policy tiếp nhận dịch vụ

> **TÀI LIỆU MÔ PHỎNG — KHÔNG PHẢI QUY ĐỊNH CHÍNH THỨC**  
> Service: `clinic` · Đơn vị chịu trách nhiệm: Trạm Y tế · Phiên bản: `CLINIC-POLICY-v3`.  
> Giờ và đầu mối bên dưới là dữ liệu mẫu, không phải thông tin của một cơ sở y tế thật hoặc lời khuyên y khoa.

## Phạm vi và quyết định xử lý

| Nhu cầu sau khi định tuyến | Dữ kiện cần có | Backend được làm | Trạng thái đúng |
|---|---|---|---|
| Hỏi giờ tiếp nhận | Không cần | Trả lời đúng mục “Giờ tiếp nhận” kèm nguồn/version | `ANSWERED` |
| Hỏi đầu mối liên hệ | Không cần | Trả đầu mối mẫu kèm nguồn/version | `ANSWERED` |
| Yêu cầu đặt lịch | Khung giờ mong muốn | Ghi nhận yêu cầu để nhân viên xác nhận; chưa tạo lịch hẹn | `NEEDS_INFO` hoặc `WAITING_FOR_STAFF` |
| Yêu cầu hủy lịch | Mã lịch `DEMO-CLINIC-APT-*` | Ghi nhận yêu cầu để nhân viên xác nhận; chưa đổi trạng thái lịch | `NEEDS_INFO` hoặc `WAITING_FOR_STAFF` |
| Hỏi trạng thái lịch | Mã lịch `DEMO-CLINIC-APT-*` | Chỉ đọc bản ghi thuộc chính sinh viên | `NEEDS_INFO`, `COMPLETED` hoặc `WAITING_FOR_STAFF` |
| Nội dung triệu chứng, thuốc, chẩn đoán, cấp cứu | Không hỏi thêm dữ kiện y tế | Hiển thị thông điệp an toàn cố định, che nội dung sức khỏe trước AI và lưu trữ | `SAFETY_MESSAGE` |

## Giờ tiếp nhận

Theo dữ liệu mẫu, giờ tiếp nhận là thứ Hai đến thứ Sáu, 08:00–11:00 và 13:00–16:00. Đây không phải giờ làm việc thực tế của trường.

## Liên hệ

Đầu mối mẫu là `DEMO-CLINIC-DESK`. Mã này không phải số điện thoại, email hoặc địa chỉ có thể liên hệ thực tế.

## Đặt lịch

Sinh viên chỉ cần nêu khung giờ mong muốn, ví dụ “thứ Ba 09:00”. Nếu thiếu, hệ thống hỏi khung giờ. Khi đã đủ, hệ thống chuyển yêu cầu đến Trạm Y tế để nhân viên xác nhận. **Chưa có lịch hẹn mới** ở bước này; không trả mã lịch giả hoặc thông báo “đặt lịch thành công”. Không yêu cầu mô tả triệu chứng.

## Hủy lịch

Sinh viên cung cấp mã lịch mẫu. Hệ thống ghi nhận yêu cầu hủy và chuyển nhân viên. Bản ghi lịch chưa đổi sang `CANCELLED` chỉ vì yêu cầu đã được tiếp nhận; không thông báo đã hủy khi chưa có kết quả xác minh.

## Tra trạng thái lịch

Hệ thống chỉ đọc lịch mẫu thuộc sinh viên đang đăng nhập. `CONFIRMED` và `CANCELLED` là trạng thái có sẵn trong bản ghi mẫu, không phải kết quả tự động của yêu cầu mới. Mã không tồn tại hoặc thuộc người khác không được tiết lộ.

## Câu hỏi thường gặp

Các câu trả lời dưới đây dùng dữ liệu mô phỏng trong policy này. Không suy diễn giờ nghỉ, lịch ngày lễ, chỗ trống, dịch vụ y tế hoặc tình trạng sức khỏe khi tài liệu không có dữ kiện.

### Giờ làm việc và liên hệ

**Trạm Y tế mở cửa lúc nào?**  
Theo lịch mẫu, từ thứ Hai đến thứ Sáu, 08:00–11:00 và 13:00–16:00. Đây không phải giờ hoạt động thực tế.

**Trạm có làm thứ Bảy, Chủ nhật hoặc ngày lễ không?**  
Policy chưa có lịch cuối tuần hoặc ngày lễ. Cần nhân viên xác nhận; không suy ra từ giờ ngày thường.

**Số điện thoại, email hoặc địa chỉ Trạm Y tế là gì?**  
Tài liệu chỉ có mã đầu mối mẫu `DEMO-CLINIC-DESK`, không có thông tin liên hệ thật. Không biến mã này thành số điện thoại, email hay địa chỉ.

### Đặt, hủy và tra lịch

**Em muốn đặt lịch khám / lịch hẹn như thế nào?**  
Nêu khung giờ mong muốn, ví dụ “thứ Ba 09:00”. Hệ thống tiếp nhận yêu cầu để nhân viên xác nhận; chưa kiểm tra chỗ trống và chưa tạo lịch hẹn.

**Khung giờ này còn trống không? Em đặt xong chưa?**  
Nguồn hiện có không chứa lịch trống theo thời gian thực. Chỉ nhân viên xác nhận lịch; việc gửi yêu cầu không đồng nghĩa đã đặt thành công.

**Em đổi giờ hoặc hủy lịch được không?**  
Gửi mã lịch mẫu và yêu cầu thay đổi. Hệ thống chỉ chuyển yêu cầu cho nhân viên; không tự sửa lịch hoặc đánh dấu đã hủy.

**Em xem lịch của mình ở đâu?**  
Cung cấp mã `DEMO-CLINIC-APT-*`. Chỉ tra bản ghi thuộc chính người gửi. Nếu thiếu mã, hỏi mã lịch; nếu không xác minh được bản ghi hoặc chủ sở hữu, không tiết lộ thông tin và chuyển nhân viên rà soát.

### Dịch vụ và thông tin y tế

**Trạm có tiêm chủng, khám chuyên khoa, cấp giấy sức khỏe, cấp thuốc hay thu phí bao nhiêu?**  
Policy không có danh mục dịch vụ, lịch tiêm, hướng dẫn cấp giấy, thông tin thuốc hoặc mức phí. Cần nhân viên Trạm Y tế xác nhận; không tự khẳng định có dịch vụ hay đưa giá.

**Em có triệu chứng này thì bị bệnh gì, uống thuốc nào hoặc có cần cấp cứu không?**  
Hệ thống không chẩn đoán, kê đơn, đánh giá mức độ nguy hiểm hoặc hướng dẫn điều trị. Chỉ hiển thị thông điệp an toàn cấu hình sẵn: “Nếu bạn cần hỗ trợ y tế khẩn cấp, hãy liên hệ ngay cơ sở y tế hoặc dịch vụ cấp cứu phù hợp tại nơi bạn đang ở.”

**Em cần gửi triệu chứng hoặc giấy tờ y tế để đặt lịch không?**  
Không. Luồng này không yêu cầu mô tả triệu chứng hay gửi hồ sơ y tế. Chỉ cung cấp khung giờ mong muốn và mã lịch khi cần tra cứu/hủy. Không nhập thông tin định danh hoặc sức khỏe nhạy cảm vào bản demo.

## An toàn y tế và dữ liệu

- Không chẩn đoán, kê đơn, phân loại mức độ cấp cứu hoặc tư vấn điều trị bằng AI.
- Khi có nội dung sức khỏe hoặc nguy cơ khẩn cấp, chỉ hiển thị: “Nếu bạn cần hỗ trợ y tế khẩn cấp, hãy liên hệ ngay cơ sở y tế hoặc dịch vụ cấp cứu phù hợp tại nơi bạn đang ở.”
- Luồng này không yêu cầu triệu chứng, bệnh án, CCCD, tên thuốc hoặc dữ liệu y tế. Bản demo không nên được dùng để gửi các thông tin đó; bộ lọc hiện có không thể bảo đảm nhận ra mọi cách diễn đạt.
- Khi bộ lọc nhận diện được nội dung y tế, nội dung cần được che trước khi gửi AI hoặc lưu trữ. Không xem bộ lọc là dịch vụ lưu hồ sơ y tế.
- AI chỉ đề xuất dịch vụ/intent; backend quyết định status và quyền tra cứu. Yêu cầu đã thuộc Trạm Y tế nhưng cần người duyệt ở hàng của Trạm Y tế, không trả về hàng điều phối chung.

## Bản ghi mẫu hiện có

| Mã lịch | Chủ sở hữu mẫu | Khung giờ | Trạng thái |
|---|---|---|---|
| `DEMO-CLINIC-APT-001` | `demo-student-01` | Thứ Ba 09:00–09:30 | `CONFIRMED` |
| `DEMO-CLINIC-APT-002` | `demo-student-02` | Thứ Năm 14:00–14:30 | `CANCELLED` |

