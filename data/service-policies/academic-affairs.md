# Phòng Đào tạo — policy tiếp nhận và hướng dẫn nghiệp vụ học vụ

> **TÀI LIỆU MÔ PHỎNG — KHÔNG PHẢI QUY ĐỊNH CHÍNH THỨC**
> Service: `academic_affairs` · Đơn vị chịu trách nhiệm: Phòng Đào tạo · Phiên bản: `AA-POLICY-v4`.
> Tài liệu mô tả phạm vi tiếp nhận và giới hạn của ứng dụng. Đây không phải quy chế của trường, không xác nhận quyền lợi học vụ và không cấp chứng từ chính thức.

## Phạm vi rộng của Phòng Đào tạo

Phòng Đào tạo là đầu mối hành chính cho các vấn đề liên quan trực tiếp đến quá trình tổ chức học tập và hồ sơ đào tạo. Trong ứng dụng, phạm vi tiếp nhận gồm:

1. **Kế hoạch học tập:** đăng ký/rút học phần, khối lượng học tập, điều kiện học phần, thời khóa biểu và xung đột lịch.
2. **Lịch và hoạt động học vụ:** lịch năm học, thời gian đăng ký, lịch thi, điều kiện dự thi và các mốc học vụ.
3. **Kết quả và hồ sơ đào tạo:** bảng điểm, xác nhận học vụ, trích lục hồ sơ, tình trạng yêu cầu và đề nghị điều chỉnh thông tin đào tạo.
4. **Tiến trình học:** bảo lưu/tạm dừng học, tiếp tục học, chuyển đổi lộ trình hoặc chương trình, công nhận/tích lũy tín chỉ và rà soát điều kiện tốt nghiệp.
5. **Thủ tục đào tạo khác:** các đề nghị hành chính gắn với quá trình học nhưng chưa có quy trình riêng trong Service Catalog.

Các mục trên xác định **đầu mối tiếp nhận**, không khẳng định trường đang có một thủ tục cụ thể, thời hạn cụ thể, điều kiện được duyệt hay hệ thống dữ liệu để tự tra cứu. Với nội dung chưa có nguồn đã duyệt, ứng dụng tạo hồ sơ chờ chuyên viên Phòng Đào tạo; không tự đưa ra kết luận.

### Ranh giới giữa các đơn vị

- **Phòng Đào tạo:** đăng ký/rút học phần, lịch học vụ, bảng điểm/chứng từ đào tạo, hồ sơ học tập, tiến trình và thủ tục đào tạo.
- **Phòng Công tác Sinh viên (`student_affairs`):** điểm rèn luyện, học bổng, hỗ trợ và hồ sơ công tác sinh viên. Điểm rèn luyện không phải điểm môn học hoặc bảng điểm.
- **Khoa/giảng viên (`faculty_cs`):** nội dung môn học, rubric, kết quả môn/đồ án và quy định nhóm CO3001/DADN. Phòng Đào tạo không quyết định điểm hoặc ngoại lệ chuyên môn của môn học.
- **Trạm Y tế (`clinic`):** thông tin và yêu cầu thuộc dịch vụ y tế.
- Nếu không thể xác định hợp lý đơn vị hoặc dịch vụ, chuyển `triage_desk` để điều phối; không ép yêu cầu vào Phòng Đào tạo chỉ vì chưa có dịch vụ phù hợp.

## Cách chọn kết quả cho từng yêu cầu

| Loại yêu cầu | Cách xử lý an toàn | Trạng thái thường dùng |
|---|---|---|
| Hỏi quy trình được mô tả rõ trong policy | Trả lời ngắn gọn, chỉ dựa vào tài liệu đã truy xuất và kèm trích dẫn/phiên bản | `ANSWERED` |
| Hỏi dữ kiện hiện hành hoặc điều kiện cần nguồn theo học kỳ | Nói rõ nguồn chưa có; tạo yêu cầu cho chuyên viên xác minh | `WAITING_FOR_STAFF` |
| Muốn Phòng Đào tạo thực hiện hoặc kiểm tra một thủ tục | Hỏi tên thủ tục nếu chưa rõ; khi xác định được nhu cầu thì tạo hồ sơ, không giả nhận đã xử lý | `NEEDS_INFO` hoặc `WAITING_FOR_STAFF` |
| Thiếu một dữ kiện thiết yếu để xác định hồ sơ | Chỉ hỏi trường còn thiếu, như mã học phần hoặc mã yêu cầu | `NEEDS_INFO` |
| Xin quyết định, ngoại lệ, phê duyệt hoặc sửa dữ liệu chính thức | Không tự quyết định; chuyển chuyên viên/người có thẩm quyền trong Phòng Đào tạo | `WAITING_FOR_STAFF` |
| Ngoài phạm vi hoặc không rõ đầu mối | Chuyển đúng service khác nếu catalog có; nếu chưa xác định được thì chuyển điều phối | `WAITING_FOR_STAFF` tại đơn vị phù hợp hoặc `triage_desk` |

## Những gì kho dữ liệu hiện có thể và chưa thể xác nhận

Tài liệu này cho phép hệ thống giải thích phạm vi tiếp nhận, giới hạn dữ liệu và cách yêu cầu được chuyển xử lý. Hiện chưa có nguồn học kỳ đã được phê duyệt trong service dataset để kết luận:

- lịch mở/đóng đăng ký, hạn rút học phần hoặc lịch năm học hiện hành;
- điều kiện tiên quyết, điều kiện dự thi, sức chứa lớp, chỗ còn trống, thời khóa biểu và xung đột lịch;
- lịch thi, phòng thi, kết quả thi, điểm môn học, điểm tích lũy hoặc thứ hạng;
- thủ tục chính thức, biểu mẫu, thời hạn và điều kiện xét bảo lưu, tiếp tục học, chuyển chương trình, công nhận tín chỉ hoặc tốt nghiệp;
- hồ sơ học tập cụ thể, việc đã đăng ký thành công hay việc chứng từ đã được phát hành;
- khoản phải đóng, miễn giảm học phí hoặc nghĩa vụ tài chính.

Không suy ra các dữ kiện này từ mã học phần (`CO3001`, `DADN`), tên chương trình, tài liệu của học kỳ khác hoặc kiến thức chung. Nếu người dùng cần kết luận cụ thể, tạo hồ sơ để Phòng Đào tạo xác minh nguồn hiện hành.

## Hỏi đáp và tiếp nhận theo chủ đề

### Đăng ký, rút học phần và kế hoạch học tập

**Em muốn đăng ký/rút một học phần thì làm sao?**
Ứng dụng có thể tiếp nhận yêu cầu kèm mã học phần để Phòng Đào tạo kiểm tra. Việc gửi yêu cầu không làm thay đổi đăng ký và không đồng nghĩa đã vào lớp hoặc rút môn thành công.

**Môn CO3001/DADN có điều kiện gì, còn chỗ hay bị trùng lịch không?**
Kho hiện chưa có điều kiện theo học kỳ, số chỗ hoặc thời khóa biểu đã duyệt. Phòng Đào tạo cần xác minh; hệ thống không kết luận chỉ từ mã môn.

**Em cần tư vấn học kỳ này nên đăng ký bao nhiêu tín chỉ?**
Ứng dụng chưa có hồ sơ học tập, kế hoạch chương trình và quy tắc khối lượng học tập của từng sinh viên. Có thể tạo yêu cầu cho chuyên viên rà soát; không đưa lời khuyên cá nhân như một quyết định chính thức.

### Lịch học vụ, lịch học và lịch thi

**Khi nào mở đăng ký, hạn rút môn là ngày nào? Lịch thi khi nào?**
Tài liệu không có lịch học vụ hiện hành. Hệ thống không lấy lịch từ kỳ trước; yêu cầu tra ngày cụ thể được chuyển Phòng Đào tạo xác minh.

**Lịch học/phòng học của em ở đâu?**
Ứng dụng không kết nối thời khóa biểu hoặc hệ thống lớp. Có thể tiếp nhận mã học phần/lớp và chuyển chuyên viên kiểm tra; không tự tạo lịch hoặc xác nhận phòng học.

### Bảng điểm, kết quả và giấy tờ

**Em xin bảng điểm hoặc giấy xác nhận học vụ như thế nào?**
Ứng dụng có thể ghi nhận loại giấy tờ cần xin và chuyển Phòng Đào tạo. Bản mô phỏng không xuất tệp, không xác nhận đã cấp và không chứa điểm thật.

**Điểm môn học của em sai, em muốn phúc khảo thì sao?**
Điểm môn học và quyết định chuyên môn thuộc giảng viên/khoa phụ trách. Nếu liên quan môn CO3001/DADN, yêu cầu được chuyển `faculty_cs`; không nhầm điểm môn học với điểm rèn luyện của `student_affairs`.

**Em muốn sửa thông tin trong hồ sơ đào tạo.**
Hệ thống có thể tiếp nhận mô tả trường thông tin cần rà soát và chuyển Phòng Đào tạo. Không tự cập nhật hồ sơ chính thức; nhân viên xác minh quyền sở hữu và bằng chứng trước khi xử lý.

### Bảo lưu, tiếp tục học, chuyển chương trình và tín chỉ

**Em muốn bảo lưu/tạm dừng học, quay lại học hoặc chuyển chương trình.**
Đây là nhóm yêu cầu thuộc tiến trình đào tạo. Tài liệu hiện không nêu điều kiện, biểu mẫu hoặc thời hạn chính thức; ứng dụng chỉ tạo hồ sơ cho chuyên viên xác nhận quy trình và giấy tờ cần thiết.

**Em muốn công nhận tín chỉ hoặc kiểm tra mình đủ điều kiện tốt nghiệp chưa.**
Chưa có bảng kết quả, kế hoạch chương trình hoặc quy tắc xét tốt nghiệp cá nhân để tự tính. Phòng Đào tạo cần rà soát hồ sơ và quyết định; không khẳng định số tín chỉ còn thiếu hay tình trạng tốt nghiệp.

### Học phí, điểm rèn luyện và hỗ trợ sinh viên

**Học phí, miễn giảm, học bổng hoặc hỗ trợ sinh viên thì hỏi ở đâu?**
Tài liệu Phòng Đào tạo không chứa dữ liệu tài chính hoặc quy trình hỗ trợ. Nếu catalog có đơn vị phụ trách tương ứng thì định tuyến sang đơn vị đó; nếu chưa có, chuyển `triage_desk` để xác định đầu mối. Không tự kết luận về số tiền hoặc điều kiện hưởng.

**Điểm rèn luyện của em bao nhiêu?**
Định tuyến đến `student_affairs`, không phải Phòng Đào tạo. Không tra cứu hoặc sửa điểm rèn luyện tự động.

## Thông tin bổ sung và quyền riêng tư

- Chỉ hỏi dữ kiện tối thiểu cần cho loại yêu cầu: mã học phần cho yêu cầu liên quan học phần; mã hồ sơ khi tra một yêu cầu đã tạo; tên thủ tục nếu yêu cầu hành chính chưa rõ.
- Không yêu cầu người dùng gửi mật khẩu, mã xác thực, CCCD hoặc dữ liệu nhạy cảm không cần thiết trong hội thoại.
- Chỉ đọc hồ sơ khi backend xác minh hồ sơ thuộc actor hiện tại. Không tìm thấy hoặc không xác minh được quyền sở hữu thì không tiết lộ trạng thái; chuyển nhân viên rà soát.
- Mã hồ sơ mẫu `DEMO-AA-REQ-*` và các trạng thái `RECEIVED`, `PROCESSING`, `NEEDS_INFO`, `READY` chỉ là dữ liệu trình diễn. `READY` không có nghĩa bảng điểm/chứng từ đã được cấp.

## Thực hiện, thẩm quyền và audit

- AI đề xuất service, intent và dữ kiện; backend kiểm tra catalog, quyền, trường bắt buộc và action allowlist.
- Với yêu cầu chưa có connector đã duyệt, chỉ tạo hồ sơ chờ Phòng Đào tạo. Không ghi SIS/LMS, không sửa hồ sơ học tập, không đăng ký/rút môn và không phát hành giấy tờ.
- Chỉ báo đã hoàn tất khi có thao tác được backend cho phép và đã xác minh kết quả. Trạng thái tiếp nhận không phải kết quả nghiệp vụ.
- Hồ sơ lưu đơn vị nhận, trạng thái, bước tiếp theo, SLA catalog, request ID, căn cứ/trích dẫn và phiên bản policy nếu có.
- Toàn bộ nội dung là mô phỏng. Trước khi dùng thật, Phòng Đào tạo phải thay nội dung bằng quy định được phê duyệt và cập nhật phiên bản trong Service Catalog.
