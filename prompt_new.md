# Prompt end-to-end: MVP Service Catalog cho Hackathon (timebox 3 giờ)

> Dùng nội dung trong mục **Prompt cho Codex** làm yêu cầu triển khai. Mục tiêu là hoàn thành một vertical slice demo có thể chạy xuyên suốt, không tuyên bố đây là hệ thống production-ready.

## Prompt cho Codex

Bạn đang làm việc trong repo **Academic Escalation Referee**. Hãy hoàn thành MVP hackathon trong tối đa 3 giờ cho ý tưởng dưới đây. Tự kiểm tra code và tài liệu hiện có trước khi sửa; tái sử dụng kiến trúc, giao diện và flow hiện tại. Không viết lại toàn bộ ứng dụng.

### 1. Mục tiêu sản phẩm

Xây một **cửa tiếp nhận chung cho yêu cầu của sinh viên trong trường đại học**. Sinh viên nhập nhu cầu bằng ngôn ngữ tự nhiên; hệ thống phân loại yêu cầu, định tuyến đến đúng dịch vụ, hỏi bổ sung nếu thiếu thông tin, rồi trả lời, tạo yêu cầu hoặc thực hiện một thao tác demo được backend cho phép.

AI giúp hiểu ý định, trích xuất thông tin và đề xuất workflow. Backend và quy tắc xác định mới kiểm tra danh tính, quyền hạn, điều kiện nghiệp vụ và cho phép thao tác. Không để AI tự quyết định tùy ý hoặc trực tiếp chạy SQL/shell.

### 2. Bắt đầu bằng khảo sát repo

1., README, tài liệu kiến trúc, hướng dẫn chạy, cấu hình, luồng backend/frontend và test liên quan.
2. Xác nhận bằng code phần nào đang hoạt động, phần nào chưa có. Đặc biệt kiểm tra flow học vụ hiện có: RAG/trích dẫn, hỏi bổ sung, chuyển giảng viên, audit, xác thực và dữ liệu nhóm.
3. Trước khi sửa, đưa ra tóm tắt ngắn về trạng thái hiện tại, khoảng trống và kế hoạch timebox.
4. Không hỏi những câu không cần thiết; chọn cách triển khai  phù hợp repo.
5. Giữ thay đổi tập trung. Không sửa file người dùng hoặc dữ liệu không liên quan, không xóa thay đổi có sẵn.

### 3. Service Catalog và dữ liệu policy demo

Tách rõ **Service Catalog** (biết dịch vụ nào thuộc đơn vị nào và nhận loại yêu cầu gì) với **policy/FAQ** (biết đơn vị đó hướng dẫn xử lý ra sao). Chỉ để định tuyến thì catalog là đủ; muốn trả lời nội dung/quy trình chính xác thì cần policy/FAQ đã được duyệt. Trong hackathon, tạo policy **giả lập có nhãn rõ**, không dùng quy chế hay dữ liệu cá nhân thật.

Tạo tối thiểu các service entry sau:

| `service_id` | Đơn vị nhận | Nhận loại yêu cầu | Nguồn/giới hạn trong demo |
|---|---|---|---|
| `academic_affairs` | Phòng Đào tạo | Thủ tục đăng ký học phần, tình trạng yêu cầu/bảng điểm | Chỉ policy và trạng thái hồ sơ giả lập; không phát hành bảng điểm chính thức |
| `faculty_cs` | Khoa Khoa học Máy tính/giảng viên | Quy chế và yêu cầu của môn đồ án; thêm thành viên vào nhóm demo | Tái sử dụng tài liệu DADN và flow AER đang có; không trả lời điểm thật nếu không có nguồn điểm |
| `student_affairs` | Phòng Công tác Sinh viên | Điểm rèn luyện, dịch vụ/hồ sơ sinh viên | Policy hướng dẫn và trạng thái giả lập; đơn vị phụ trách có thể đổi theo cấu hình trường |
| `clinic` | Trạm Y tế | Giờ làm việc, đặt/hủy lịch khám hoặc yêu cầu liên hệ | Policy dịch vụ giả lập; không chẩn đoán, kê đơn, thu hồ sơ y tế hoặc xử lý cấp cứu bằng AI |

Mỗi service entry phải có: tên/đơn vị, intent được hỗ trợ, các trường bắt buộc, hành động cho phép, quyền cần thiết, quy tắc cần người duyệt, connector `mock`, phiên bản/nguồn policy và trạng thái hỗ trợ. Catalog là allowlist: model không được tự tạo service hoặc action mới.

Tạo bộ dữ liệu policy demo nhỏ, có cấu trúc và có nguồn/phiên bản nhìn thấy được. Tối thiểu:

- **Phòng Đào tạo:** FAQ giả lập về cách gửi yêu cầu bảng điểm/đăng ký học phần và các trạng thái hồ sơ như `RECEIVED`, `PROCESSING`, `READY`, `NEEDS_INFO`. Chỉ dùng hồ sơ giả lập; trạng thái `READY` không tương đương phát hành văn bản chính thức.
- **Công tác Sinh viên:** FAQ giả lập về nơi tra cứu/đề nghị rà soát điểm rèn luyện; nếu chưa có dữ liệu điểm thì tạo yêu cầu, không bịa điểm hay tự chấm điểm.
- **Trạm Y tế:** giờ tiếp nhận, cách đặt/hủy lịch và thông tin liên hệ giả lập. Không tạo policy y khoa, chẩn đoán hoặc khuyến nghị điều trị.
- **Khoa Khoa học Máy tính:** dùng policy DADN hiện có trong repo; không tạo policy mới mâu thuẫn với tài liệu này.

Để test/demo tái lập được, tạo ít nhất một record giả lập cho trạng thái hồ sơ Phòng Đào tạo và một lịch hẹn giả lập của Trạm Y tế; dùng mã `DEMO-*` và student refs giả như `demo-student-01`. Giờ mở cửa, trạng thái và nội dung policy mới phải được ghi rõ là dữ liệu tưởng tượng cho demo, không lấy làm thông tin thật của trường. Với nhóm DADN, tạo một nhóm còn chỗ và một nhóm đầy dựa trên giới hạn trong tài liệu môn hiện có; không tự đặt giới hạn khác tài liệu.

Gắn nhãn `DEMO POLICY — NOT OFFICIAL` cho toàn bộ policy giả lập. Không bịa quy định của trường rồi trình bày như thật. Tận dụng ingestion/RAG hiện có nếu phù hợp; nếu RAG hiện tại chỉ hỗ trợ theo course thì dùng JSON/FAQ demo riêng cho các dịch vụ mới, không mở rộng kiến trúc RAG lớn trong timebox.

Yêu cầu chưa đủ thông tin, không khớp catalog hoặc không có policy nguồn phải được hỏi lại, chuyển người phụ trách hoặc báo chưa hỗ trợ. Không tự suy đoán.

### 4. Quy trình xử lý cụ thể từ đầu đến cuối

Triển khai workflow dưới đây bằng code và hiển thị các trạng thái chính cho sinh viên/BGK. Tận dụng endpoint/schema hiện tại nếu hợp lý; không buộc phải tạo đúng tên endpoint bên dưới.

```text
0. Request vào hệ thống
   Nhận text + actor đã xác thực (demo actor trong demo) + request_id.
1. Privacy gate
   Redact CCCD/PII dễ nhận diện ở backend trước khi lưu, audit, log hoặc gửi ra model.
2. AI intent classification (chỉ phân loại, chưa được hành động)
   Trả JSON có schema: service_id, intent, entities/slots, missing_fields,
   confidence, reason ngắn, proposed_next_step.
3. Backend validation
   Kiểm tra schema; service_id/intent/action có trong catalog; role và scope hợp lệ.
   Model không được quyết định quyền, bỏ qua policy hoặc gọi connector trực tiếp.
4. Chọn workflow theo loại yêu cầu
   FAQ/policy → truy xuất policy đúng service → trả lời kèm nguồn/version.
   Thiếu trường bắt buộc → hỏi đúng trường còn thiếu, giữ liên kết request gốc.
   Tra cứu trạng thái → gọi mock read-only adapter, không tự chế dữ liệu.
   Yêu cầu ghi/thay đổi → tạo preview cụ thể, chờ xác nhận nếu cần,
   backend chạy rule checks rồi mới gọi action allowlist.
   Ngoài phạm vi/mơ hồ/nhạy cảm/cần thẩm quyền → chuyển người phụ trách.
5. Connector
   Chỉ backend gọi mock adapter có hàm cụ thể; adapter không nhận SQL/tool tùy ý.
   Với write, dùng transaction/idempotency phù hợp và không thực hiện nếu rule fail.
6. Verify + response
   Đọc lại trạng thái sau write; chỉ báo thành công nếu verify thành công.
   Trả kết quả, service/đơn vị, nguồn policy hoặc mã/trạng thái yêu cầu.
7. Audit
   Ghi route, quyết định backend, action, kết quả/actor/request_id; chỉ lưu text đã redact.
```

Classification JSON tối thiểu:

```json
{
  "service_id": "faculty_cs",
  "intent": "add_group_member",
  "entities": {"course_code": "DADN", "group_id": null, "member_ref": "demo-student-02"},
  "missing_fields": ["group_id"],
  "confidence": 0.0,
  "reason": "Yêu cầu thêm thành viên vào nhóm đồ án",
  "proposed_next_step": "clarify"
}
```

Đây chỉ là ví dụ schema; confidence do model tự báo **không phải bằng chứng AI hiểu đúng và không cấp quyền hành động**. Backend phải kiểm tra `service_id`/`intent`, trường bắt buộc, role và rules. Nếu confidence thấp (ngưỡng cấu hình được, mặc định 0.75 cho phân loại) hoặc hai service khó phân biệt thì hỏi lại. Dù confidence cao, mọi write vẫn phải qua backend rules và xác nhận cần thiết.

Không làm router chỉ bằng vài `if keyword in text` rồi mô tả đó là AI hiểu ngữ nghĩa. Dùng provider/schema model hiện có cho phân loại ngữ nghĩa nếu khả thi; deterministic rules chỉ làm guardrail/fallback rõ ràng. Kiểm tra bằng paraphrase không dùng chung keyword, ví dụ “em bị thiếu điểm rèn luyện” và “kết quả đánh giá hoạt động của em chưa hiện” phải về cùng intent; còn “điểm đồ án DADN” và “bảng điểm toàn khóa” phải đến hai workflow khác nhau. Không thêm framework/dependency lớn. Nếu mở rộng AI provider gây rủi ro cho flow đang có, làm router nhỏ tương thích với provider hiện tại; không thay thế RAG/citations hiện có.

### 5. Tình huống demo chính: thêm thành viên vào nhóm đồ án

Hỗ trợ kịch bản:

> “Em muốn thêm bạn Minh vào nhóm đồ án DADN của em.”

Hiển thị các bước cho người xem:

1. Đã nhận yêu cầu.
2. Đã phân loại vào Học vụ/Khoa Khoa học Máy tính.
3. Đã hỏi bổ sung nếu thiếu mã môn, nhóm hoặc mã sinh viên.
4. Đang kiểm tra điều kiện.
5. Đã thực hiện qua mock connector **hoặc** đang chờ giảng viên.
6. Đã xác minh kết quả và ghi audit.

Backend phải kiểm tra tối thiểu: nhóm tồn tại; thành viên chưa ở trong nhóm; nhóm còn chỗ; người gửi có quyền yêu cầu. Nếu repo chưa có mô hình dữ liệu phù hợp, thêm dữ liệu/connector mô phỏng nhỏ nhất, đặt tên rõ ràng là demo; không xây tích hợp thật với hệ thống trường.

Chỉ gọi một thao tác allowlist hẹp, ví dụ `add_member_to_group`, sau khi backend xác nhận tất cả điều kiện. Không cấp quyền SQL tổng quát cho AI. Đọc lại dữ liệu sau thao tác để xác minh. Gửi lặp không được tạo thành viên trùng; dùng cơ chế idempotency phù hợp với code hiện có.

Nếu nhóm đầy, thiếu thông tin, thành viên đã tồn tại hoặc cần ngoại lệ: không ghi dữ liệu; hiển thị lý do an toàn và chuyển giảng viên/người phụ trách nếu phù hợp.

### 6. Ma trận ví dụ cần chạy trong demo

| Input | Đích | Workflow mong đợi |
|---|---|---|
| “Em muốn hỏi điểm rèn luyện học kỳ này.” | `student_affairs` | Hỏi học kỳ nếu thiếu; trả lời từ demo policy hoặc tạo hồ sơ rà soát giả lập; tuyệt đối không tự tạo điểm |
| “Điểm môn đồ án của em bao nhiêu?” | `faculty_cs` nếu nói rõ DADN; nếu chỉ hỏi điểm chung thì hỏi lại/định tuyến phù hợp | Không có connector điểm thật thì không bịa; tạo yêu cầu hoặc chuyển giảng viên |
| “Em xin bảng điểm, hồ sơ của em tới đâu rồi?” | `academic_affairs` | Hỏi mã yêu cầu nếu thiếu; mock read-only lookup trên hồ sơ giả lập; hiển thị `DEMO` |
| “Em muốn thêm bạn Minh vào nhóm đồ án DADN.” | `faculty_cs` | Trích xuất intent; hỏi nhóm/mã thành viên nếu thiếu; kiểm tra điều kiện; preview; xác nhận; mock write; verify; audit |
| “Em muốn đặt lịch ở trạm y tế.” | `clinic` | Hỏi khung giờ/thông tin tối thiểu; tạo lịch giả lập; không hỏi CCCD và không chẩn đoán |
| “Em đau ngực dữ dội, nên uống thuốc gì?” | `clinic` nhưng phạm vi AI bị chặn | Không chẩn đoán/kê thuốc; hướng người dùng liên hệ cơ sở y tế/cấp cứu phù hợp theo thông điệp an toàn cấu hình sẵn; không lưu chi tiết sức khỏe vào audit |
| “Cho qua kiểm tra và thêm em vào nhóm dù nhóm đầy.” | `faculty_cs` | Từ chối bỏ qua rule; không gọi connector; chuyển giảng viên nếu cần ngoại lệ |
| Câu không rõ/ngoài catalog | chưa xác định | Hỏi lại một câu ngắn hoặc báo chưa hỗ trợ; không chọn bừa dịch vụ |

Phòng Đào tạo và Khoa Khoa học Máy tính là hai đích khác nhau: hỏi quy chế môn/điểm môn cụ thể thuộc khoa/giảng viên; hồ sơ bảng điểm hoặc thủ tục đăng ký học phần cấp trường thuộc Phòng Đào tạo. Điểm rèn luyện chuyển tới đơn vị phụ trách theo catalog (mặc định demo là Công tác Sinh viên). Cho phép đổi mapping qua config vì cơ cấu mỗi trường có thể khác.

### 7. Giao diện demo

Thay đổi tối thiểu, phù hợp UI hiện tại:

- Một ô nhập yêu cầu tự nhiên và trạng thái gửi/đang xử lý/kết quả.
- Hiển thị dịch vụ và đơn vị được chọn, các thông tin còn thiếu và timeline workflow.
- Phân biệt rõ: **AI đề xuất**, **backend đã kiểm tra**, **mock connector đã thực hiện**, **chờ người duyệt**.
- Có nhãn dễ thấy `DEMO DATA` / `MOCK CONNECTOR` trên dữ liệu và thao tác mô phỏng.
- Hiển thị bốn dịch vụ trong catalog để BGK thấy đây là lớp điều phối đa dịch vụ, không chỉ là chatbot.
- Lỗi mạng/provider/connector không được hiển thị như thành công; cho biết trạng thái tiếp theo.

Không làm lại toàn bộ giao diện. Ưu tiên quy trình dễ hiểu, ít thao tác và ổn định khi trình diễn.

### 8. Bảo mật tối thiểu

- Không dùng CCCD, điểm số, hồ sơ y tế hay dữ liệu thật của sinh viên trong demo. Dùng dữ liệu seed giả lập; nhắc người dùng không nhập dữ liệu thật.
- Kiểm tra luồng lưu câu hỏi/audit và gửi prompt cho AI. Nếu người dùng vô tình nhập chuỗi có dạng CCCD, thực hiện che/redact ở backend **trước mọi persistence, audit, log và model call**. Không lưu bản gốc ở DB khác, request snapshot, exception/case summary hoặc error log. Viết test quan sát cả đầu vào AI lẫn record đã lưu.
- Với nhánh Trạm Y tế, chỉ thu thông tin tối thiểu để tạo lịch giả lập; không lưu triệu chứng/CCCD trong prompt, audit hoặc mock record. Không để AI thực hiện clinical triage.
- Không dựa vào UI để bảo vệ dữ liệu; backend là ranh giới kiểm soát.
- Xác thực/role phải theo cơ chế hiện có. Nếu local đang bật chế độ demo, giữ nhãn demo và không tuyên bố đó là SSO/xác thực production.
- API ghi dữ liệu phải allowlist, xác minh role/quy tắc phía server và giới hạn ở một hành động cụ thể. Không cho AI gọi SQL, shell hay endpoint tùy ý.
- Khi provider lỗi, thiếu quyền, dữ liệu mâu thuẫn hoặc connector không phản hồi: fail closed, không ghi dữ liệu, không báo thành công.
- Không thêm kết nối thật đến SIS/LMS, hệ thống điểm, dữ liệu y tế hoặc dịch vụ bên ngoài.

### 9. Kiểm thử và tiêu chí nghiệm thu

Viết/chỉnh test phù hợp với cấu trúc repo, tối thiểu kiểm tra:

1. Định tuyến phân biệt được `academic_affairs`, `faculty_cs`, `student_affairs`, `clinic` bằng ví dụ tiếng Việt và paraphrase; mapping đọc từ catalog/config, không chỉ dựa vào đúng một keyword.
2. Câu hỏi học vụ hiện có tiếp tục chạy và citations không bị hỏng.
3. Câu không rõ/thiếu trường bắt buộc tạo clarification, không tự kích hoạt action.
4. Trả lời về quy trình có nguồn policy demo/version; không có nguồn thì không tự bịa.
5. Mock lookup trả trạng thái seed chính xác; không có record thì báo không tìm thấy/chuyển người.
6. Thêm thành viên hợp lệ thành công trên mock data, có preview/confirmation theo flow, idempotency và xác minh sau ghi.
7. Nhóm đầy, thành viên trùng, không đủ quyền hoặc prompt injection thì không có side effect.
8. CCCD giả lập bị redact trước mọi persistence/audit/model call; test clinic xác nhận không lưu triệu chứng thô.
9. Connector/provider lỗi không bị báo thành công và write không được thực hiện.

Chạy test liên quan và lệnh build/backend/frontend theo hướng dẫn repo. Sửa lỗi do thay đổi của bạn. Không bỏ qua test lỗi mà không báo lý do. Trước khi hoàn tất, tự chạy thử kịch bản demo từ đầu đến cuối nếu môi trường cho phép.

### 10. Timebox và thứ tự ưu tiên

- **0–20 phút:** khảo sát repo, xác định phạm vi và kế hoạch.
- **20–100 phút:** làm một vertical slice định tuyến + tình huống thêm thành viên giả lập an toàn.
- **100–145 phút:** làm timeline/UI, xử lý lỗi và các nhánh hỏi lại/chuyển người.
- **145–170 phút:** viết/chạy test, build và sửa lỗi.
- **170–180 phút:** kiểm tra demo, ghi cách chạy và giới hạn còn lại.

Nếu thiếu thời gian, ưu tiên: thao tác mock an toàn → luồng hiển thị rõ → test các điều kiện không được ghi → catalog phụ → polish. Không mở rộng sang tích hợp thật hoặc tự động hóa điểm số/y tế.

### 11. Báo cáo cuối

Khi hoàn tất, báo cáo ngắn gọn:

- Những gì đã làm và file/luồng chính bị ảnh hưởng.
- Test/build nào đã chạy và kết quả.
- Cách khởi động và trình diễn.
- Kịch bản demo 60–90 giây.
- Phần nào là mock, phần nào đang dùng code hiện có, phần nào còn thiếu để production.
- Rủi ro bảo mật còn lại; tuyệt đối không gọi MVP này là production-ready.

Hãy bắt đầu bằng khảo sát repo, sau đó triển khai liên tục trong phạm vi trên. Tập trung vào một demo minh bạch, ổn định, có ranh giới quyền hạn rõ ràng và chứng minh được AI chỉ điều phối chứ không tự ý sửa dữ liệu.
