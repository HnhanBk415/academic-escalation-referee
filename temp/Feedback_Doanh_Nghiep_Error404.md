# FEEDBACK TỪ DOANH NGHIỆP — SPRINT 1 (TRACK VNG)
## Đội thi: Error404

---

### TỔNG QUAN ĐÁNH GIÁ
* **Xếp nhóm kỹ thuật**: Nhóm đầu
* **Tiềm năng thương mại thực tế**: **Cao**
* **Số kiểu dừng đạt chuẩn (Spec Stops)**: **2/3** kiểu dừng
* **Đánh giá năng lực thực thi**:
  * **Nó chạy (It runs - 40%)**: Strong Tốt
  * **Ranh giới con người (Human loop - 20%)**: Strong Tốt
  * **Khớp yêu cầu đề bài (Spec test - 20%)**: Strong Tốt
  * **Phương pháp kiểm chứng (Method - 20%)**: Partial Một phần

---

### 1. BÀI TOÁN & GIẢI PHÁP CỦA ĐỘI (WHAT THEY BUILT)
Giải đáp thắc mắc sinh viên. Tra cứu quy chế nhà trường, rồi trả lời kèm trích dẫn điều khoản chính xác, yêu cầu bổ sung minh chứng, hoặc chuyển lên giảng viên — người có thể cấp ngoại lệ có phạm vi kèm đồng hồ đếm ngược SLA.

---

### 2. GÓC NHÌN DOANH NGHIỆP & CHỖ ĐỨNG TRONG TỔ CHỨC THỰC TẾ
* **Định giá tiềm năng**: Mức **Cao**
* **Phân tích giá trị kinh doanh**:
Cùng thị trường với NoSleepClub, và bạn đã xây đúng phần quyết định nó có sống sót qua giai đoạn thử nghiệm hay không: đồng hồ SLA, ngoại lệ có phạm vi và nhật ký chỉ thêm không sửa. Công cụ giảm tải thường được mua sau một buổi demo rồi bị bỏ sau sáu tuần vì không ai nói được hồ sơ đã đi đâu. Của bạn thì nói được. Khi pitch, hãy dẫn bằng lớp vận hành chứ không phải khả năng trả lời. Người mua của bạn là trưởng phòng đào tạo — người chịu trách nhiệm khi sinh viên khiếu nại, và thứ bạn bán chính là khả năng chịu trách nhiệm đó.

---

### 3. ĐIỂM SÁNG NỔI BẬT (STRENGTHS)
Phần triển khai của bạn tốt nhất ở đây: ba container có healthcheck và giám khảo chạy được bằng một lệnh. Provider giả giúp bộ mười lăm case chạy tất định là kỹ thuật phòng thủ đúng đắn, và truy vết request ID xuyên tới nhật ký kiểm toán là cách làm chuyên nghiệp.

---

### 4. MỘT RÀO CẢN BẮT BUỘC PHẢI SỬA (CRITICAL FIX)
> *Điểm nghẽn kỹ thuật/nghiệp vụ lớn nhất cần giải quyết ngay:*

Trả lời, hỏi thêm và báo lên là ba nhánh nhưng chỉ hai kiểu dừng. Nhánh báo lên không phân biệt vi phạm quy định với giới hạn thẩm quyền. Hãy tách ra, và gửi mỗi loại đến đúng người.

---

### 5. KẾ HOẠCH HÀNH ĐỘNG ƯU TIÊN CHO SPRINT 2 (ACTION ITEMS)
1. Tách nhánh báo lên thành quy định và thẩm quyền, định tuyến riêng.
2. Thêm xử lý giới hạn lượt gọi kèm chờ tăng dần cho luồng gọi mô hình thật.
3. Tự nạp kho văn bản quy chế khi container khởi động.
4. Đo tỷ lệ báo lên sai.

---

### 6. ĐỐI CHIẾU TIÊU CHUẨN KỸ THUẬT ĐỀ BÀI (SPEC COMPLIANCE CHECKLIST)
| Tiêu chí đối chiếu | Kết quả đánh giá |
| :--- | :--- |
| **Tài liệu quy định (Policy doc)** | Yes / Đạt |
| **Bộ dữ liệu thử nội bộ (Test set)** | Yes / Đạt |
| **Ba kiểu dừng riêng biệt (Three stops)** | Partial / Một phần |
| **Câu hỏi báo lên cụ thể (Specific question)** | Yes / Đạt |
| **Không bao giờ đoán bừa (No confident guess)** | Yes / Đạt |
| **Không báo lên thừa (No over-escalation)** | Partial / Một phần |
| **Đường dẫn chạy trực tiếp (Live URL)** | No / Chưa |
| **Lệnh chạy kiểm chứng (Verify run)** | Yes / Đạt |
| **Kho mã nguồn sạch (Repo clean)** | Yes / Đạt |

* **Ghi chú đối chiếu**: Kho văn bản quy chế là nguồn quy định đúng nghĩa và ground guard đáp ứng quy tắc dữ liệu bị đánh dấu. Chưa có Dockerfile và chưa triển khai.
* **Nhận xét tổng kết kỹ thuật**: Câu chuyện "nó chạy" tốt nhất: ba container có healthcheck khởi động bằng một lệnh, và một provider giả giúp bộ mười lăm case chạy tất định. Nhật ký chỉ thêm không sửa, đồng hồ SLA, truy vết theo request-ID. Trả lời / hỏi thêm / báo lên là ba nhánh nhưng chỉ hai kiểu dừng.
