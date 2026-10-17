# Phòng Đào tạo — policy tiếp nhận dịch vụ

> **TÀI LIỆU MÔ PHỎNG — KHÔNG PHẢI QUY ĐỊNH CHÍNH THỨC**  
> Service: `academic_affairs` · Đơn vị chịu trách nhiệm: Phòng Đào tạo · Phiên bản: `AA-POLICY-v3`.  
> Tài liệu này chỉ mô tả quy trình mẫu của ứng dụng, không phải quy chế trường và không cấp chứng từ chính thức.

## Phạm vi và quyết định xử lý

| Nhu cầu sau khi định tuyến | Dữ kiện cần có | Backend được làm | Trạng thái đúng |
|---|---|---|---|
| Hỏi thủ tục đăng ký hoặc rút học phần | Chủ đề câu hỏi | Trả lời quy trình mẫu bên dưới, kèm nguồn và phiên bản | `ANSWERED` |
| Hỏi điều kiện của một học phần cụ thể | Mã học phần; dữ liệu điều kiện tiên quyết, chỗ trống, lịch học đã duyệt | Chuyển nhân viên vì bộ dữ liệu hiện chưa có các điều kiện đó | `WAITING_FOR_STAFF` |
| Yêu cầu đăng ký hoặc rút học phần | Mã học phần | Hỏi mã học phần nếu thiếu; sau đó tạo yêu cầu cho Phòng Đào tạo kiểm tra, chưa cập nhật hệ thống đăng ký | `NEEDS_INFO` hoặc `WAITING_FOR_STAFF` |
| Hỏi cách xin bảng điểm | Chủ đề câu hỏi | Trả lời hướng dẫn mẫu, kèm nguồn và phiên bản | `ANSWERED` |
| Xin bảng điểm/chứng từ | Nội dung yêu cầu | Tạo hồ sơ chờ nhân viên; không phát hành chứng từ | `WAITING_FOR_STAFF` |
| Hỏi tình trạng hồ sơ | Mã hồ sơ `DEMO-AA-REQ-*` | Chỉ đọc bản ghi thuộc sinh viên đang đăng nhập | `NEEDS_INFO`, `COMPLETED` hoặc `WAITING_FOR_STAFF` |

## Hỏi về đăng ký học phần

Sinh viên có thể hỏi cách gửi yêu cầu đăng ký hoặc rút học phần. Hệ thống hướng dẫn cung cấp mã học phần để Phòng Đào tạo kiểm tra. Câu trả lời này chỉ mô tả **cách tiếp nhận**, không xác nhận đủ điều kiện đăng ký.

Hệ thống chưa có nguồn quy định được duyệt về điều kiện tiên quyết, số chỗ, xung đột lịch và thời hạn đăng ký. Nếu câu hỏi cần kết luận về một trong các điều kiện đó, chuyển nhân viên Phòng Đào tạo thay vì suy đoán.

### Thông tin hiện có và chưa có

- Có thể hướng dẫn cách gửi yêu cầu và giải thích trạng thái của hồ sơ mô phỏng.
- Chưa có dữ liệu học phần theo học kỳ về điều kiện tiên quyết, sức chứa, thời khóa biểu, lịch sử đăng ký hoặc thời hạn mở/đóng.
- Mã học phần như `CO3001` hoặc `DADN` chỉ giúp xác định yêu cầu; tự nó không chứng minh sinh viên đủ điều kiện.
- Nếu câu hỏi cần một dữ kiện chưa có trong kho, yêu cầu được chuyển chuyên viên Phòng Đào tạo. Không được suy ra câu trả lời từ tên học phần hoặc quy trình chung.

## Đăng ký hoặc rút học phần

Sinh viên cung cấp mã học phần, ví dụ `DADN` hoặc `CO3001`. Khi thiếu mã, hệ thống hỏi đúng trường còn thiếu. Khi đã có mã, hệ thống ghi nhận yêu cầu và chuyển Phòng Đào tạo kiểm tra. **Không** ghi vào SIS/LMS, không thay đổi danh sách lớp và không thông báo đăng ký đã hoàn tất.

Thông điệp sau tiếp nhận: “Yêu cầu của bạn đã được chuyển Phòng Đào tạo để kiểm tra điều kiện và xử lý. Vui lòng theo dõi trạng thái hồ sơ.”

## Hỏi về bảng điểm

Sinh viên có thể gửi yêu cầu bảng điểm và theo dõi trạng thái bằng mã hồ sơ mẫu. Hệ thống không có dữ liệu điểm và không xuất bảng điểm. Bản ghi `READY` chỉ có nghĩa là **hồ sơ mô phỏng** đã sẵn sàng cho bước xử lý của nhân viên.

## Yêu cầu bảng điểm

Hệ thống tiếp nhận nội dung và chuyển nhân viên Phòng Đào tạo. Trạng thái yêu cầu là `WAITING_FOR_STAFF`; không trả tệp, điểm số hoặc lời xác nhận đã cấp bảng điểm.

## Tra trạng thái hồ sơ

Chỉ tra mã `DEMO-AA-REQ-*` trong dữ liệu mẫu và chỉ trả bản ghi của chính người gửi. Các trạng thái có thể hiển thị: `RECEIVED` (đã nhận), `PROCESSING` (đang xử lý), `NEEDS_INFO` (cần bổ sung), `READY` (sẵn sàng trong mô phỏng). Mã không tồn tại hoặc không thuộc người gửi phải chuyển nhân viên rà soát; không đoán trạng thái.

## Câu hỏi thường gặp

Các câu trả lời dưới đây chỉ dùng trong phạm vi dữ liệu mô phỏng của policy này. Nếu câu hỏi cần quy định chính thức, dữ liệu theo học kỳ hoặc quyền quyết định của nhân viên, không suy đoán; chuyển Phòng Đào tạo hoặc hỏi bổ sung đúng thông tin còn thiếu.

### Đăng ký môn, rút môn và điều kiện học phần

**Em đăng ký môn / rút môn như thế nào?**  
Gửi mã học phần để Phòng Đào tạo tiếp nhận và kiểm tra. Hệ thống chỉ tạo yêu cầu; không tự đăng ký, rút môn hoặc xác nhận bạn đã được thêm vào lớp.

**Khi nào mở đăng ký, hạn chót rút môn là ngày nào?**  
Policy hiện không có lịch đăng ký theo học kỳ hoặc thời hạn đã được phê duyệt. Cần nhân viên Phòng Đào tạo xác nhận; không lấy ngày từ học kỳ khác để trả lời.

**Em có đủ điều kiện học CO3001 / DADN không? Môn còn chỗ không, lịch có trùng không?**  
Nguồn hiện có không chứa điều kiện tiên quyết, số chỗ, danh sách lớp hoặc thời khóa biểu theo học kỳ. Mã môn giúp định danh yêu cầu nhưng không đủ để kết luận; chuyển Phòng Đào tạo kiểm tra.

**Em đã gửi yêu cầu đăng ký rồi, vậy đã vào lớp chưa?**  
Việc tiếp nhận yêu cầu không đồng nghĩa đăng ký thành công. Hệ thống không kết nối SIS/LMS; hãy tra mã hồ sơ của chính bạn hoặc chờ Phòng Đào tạo xác nhận.

### Bảng điểm và hồ sơ

**Xin bảng điểm ở đâu / cần làm gì?**  
Gửi yêu cầu bảng điểm để Phòng Đào tạo tiếp nhận và xử lý. Bản demo không có điểm thật và không phát hành bảng điểm hay chứng từ.

**Trạng thái `READY` nghĩa là đã cấp bảng điểm chưa?**  
Không. `READY` chỉ mô tả hồ sơ mô phỏng đã sẵn sàng cho bước xử lý tiếp theo; nó không chứng minh bảng điểm đã được tạo hoặc cấp.

**Em tra hồ sơ bằng cách nào?**  
Cung cấp mã `DEMO-AA-REQ-*`. Chỉ được trả trạng thái của hồ sơ thuộc chính người gửi. Nếu thiếu mã, hỏi mã hồ sơ; nếu mã không tồn tại hoặc quyền sở hữu không xác minh được, không tiết lộ dữ liệu và chuyển nhân viên rà soát.

### Ngoài phạm vi policy này

**Học phí, lịch thi, phúc khảo, điểm môn học hoặc giấy tờ khác thì sao?**  
Tài liệu này không có quy định hoặc dữ liệu để kết luận những nội dung đó. Nếu Service Catalog có dịch vụ phù hợp thì định tuyến sang dịch vụ ấy; nếu không xác định được đầu mối, tạo yêu cầu cho `triage_desk`. Không tự tạo câu trả lời từ quy trình đăng ký học phần.

**Em muốn khiếu nại hoặc xin ngoại lệ về điều kiện học phần.**  
Không tự phê duyệt hoặc khẳng định được miễn điều kiện. Ghi nhận nội dung và chuyển người có thẩm quyền tại Phòng Đào tạo; hỏi bổ sung mã học phần hoặc thông tin hồ sơ nếu cần để tiếp nhận.

## Trách nhiệm và audit

- Yêu cầu không rõ đích tiếp nhận đi vào `triage_desk`; yêu cầu đã xác định thuộc Phòng Đào tạo nhưng thiếu thẩm quyền hoặc nguồn policy thì giữ tại hàng Phòng Đào tạo.
- Mỗi yêu cầu hiển thị đơn vị nhận, trạng thái, bước tiếp theo, SLA theo Service Catalog, request ID và phiên bản nguồn nếu có.
- AI chỉ đề xuất intent và trích xuất dữ kiện. Backend kiểm tra catalog, quyền và kết quả mock trước khi trả lời.
- Không dùng tên thật, mã số sinh viên thật, điểm thật hoặc thông tin định danh thật trong dữ liệu mẫu.
- Nội dung trong tài liệu này chỉ phục vụ luồng trình diễn; trước khi dùng thực tế, đơn vị phụ trách phải thay bằng quy định đã phê duyệt và cập nhật phiên bản trong Service Catalog.
