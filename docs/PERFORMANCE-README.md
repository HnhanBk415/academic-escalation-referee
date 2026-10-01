# Báo cáo hiệu năng Backend, AI và Database

Ngày kiểm tra ban đầu: 25/09/2026  
Cập nhật sau khi sửa: 27/09/2026

> Lưu ý: số liệu ở mục 2 là baseline ngày 25/09. Các thay đổi hoàn tất ngày 27/09 đã qua
> automated test nhưng chưa benchmark lại trên production, vì vậy không được xem các mục tiêu
> cuối tài liệu là số liệu đã đạt.

Kiểm tra hồi quy hiện tại: backend `19 passed`, frontend `3 passed`, production build thành công,
và Alembic nâng cấp sạch tới revision `20260927_0003` trên database mới.

## 1. Kết luận ngắn

Hệ thống hiện vẫn chạy đúng chức năng và vượt qua toàn bộ test backend. Tuy nhiên, tốc độ phản hồi chưa tốt vì một câu hỏi đang tạo ra quá nhiều công việc:

1. Gọi Gemini để tạo embedding (biến câu hỏi thành dữ liệu dùng để tìm tài liệu).
2. Truy vấn database nhiều lần để lấy người dùng, môn học, nhóm và tài liệu.
3. Một số câu tiếp tục gọi Gemini lần thứ hai để tạo quyết định hoặc câu trả lời.
4. Trong lúc đó, frontend vẫn liên tục kiểm tra AI và tải lại danh sách câu hỏi.

Gemini là phần chiếm nhiều thời gian nhất. Database chưa phải nút thắt lớn nhất khi dữ liệu còn ít, nhưng cách truy vấn hiện tại sẽ làm hệ thống chậm nhanh khi số câu hỏi và số người dùng tăng.

## 2. Số liệu đã đo

| Hạng mục | Kết quả |
|---|---:|
| Backend automated tests | 16/16 test đạt |
| Verify với Gemini, 15 tình huống | 27,57 giây |
| Trung bình mỗi tình huống | 1,84 giây |
| Câu hỏi thông thường cần AI trả lời | Trung bình 2,94 giây |
| Câu hỏi ngoài quy định | Trung bình 3,11 giây |
| Verify bằng PostgreSQL và fake AI | Trung bình 64,7 ms/câu |
| Tải 15 câu hỏi từ API production | 3,17 giây, khoảng 24,5 KB |
| Tải danh sách hồ sơ chờ xử lý | 0,46 giây |
| Tải audit log | 0,64 giây |
| Reset dữ liệu bằng fake AI | 1,46 giây, 45 câu lệnh database |
| Một request gửi câu hỏi | Khoảng 11–13 câu lệnh database |

Kết quả trên cho thấy phần AI và cách điều phối request là nguyên nhân chính. Khi bỏ AI thật, một câu chỉ mất vài chục mili giây.

## 3. Phân tích theo từng loại

### 3.1. Backend/API

Hiện trạng:

- Một request gửi câu hỏi thực hiện nhiều bước nối tiếp nhau.
- Backend mở kết nối database, sau đó giữ kết nối này trong lúc chờ Gemini.
- Endpoint lấy danh sách câu hỏi trả cả nội dung trích dẫn đầy đủ, dù frontend đôi khi chỉ cần đếm số lượng.
- Chưa có giới hạn số câu hỏi trả về theo từng trang.

Ảnh hưởng:

- Một người dùng phải chờ tất cả các bước hoàn thành mới nhận được kết quả.
- Khi nhiều người gửi đồng thời, các kết nối database bị giữ lâu và người đến sau phải chờ.
- Danh sách lịch sử sẽ chậm dần khi database có nhiều câu hỏi hơn.
- Có nguy cơ timeout khi Gemini phản hồi chậm.

Mức độ: **Cao**.

Trạng thái sau cập nhật 27/09:

1. Đã thêm `limit/offset` cho danh sách câu hỏi.
2. Đã thêm API count gọn để frontend không tải toàn bộ lịch sử chỉ nhằm hiển thị badge.
3. Đã gom việc tải case, quyết định, ngoại lệ và evidence theo lô, loại bỏ N+1 ở danh sách.
4. Đã tách transaction trước embedding và model decision để không giữ database connection khi chờ Gemini.
5. Cần bổ sung metric riêng cho retrieval, model decision và database trước khi benchmark lại.

### 3.2. AI/Gemini

Hiện trạng:

- Mọi câu hỏi đều gọi Gemini để tìm tài liệu trước khi kiểm tra các luật đơn giản.
- Các câu cần trả lời thường gọi Gemini hai lần: một lần tìm tài liệu và một lần tạo câu trả lời.
- Toàn bộ backend chỉ cho phép một tác vụ AI chạy tại một thời điểm.
- Khi Gemini gặp lỗi tạm thời, backend chờ 2 giây rồi thử lại.
- Timeout local là 30 giây cho từng lần gọi; production đặt 60 giây.

Ảnh hưởng:

- Baseline 15 tình huống gọi Gemini thường xuyên; không được giảm số call bằng keyword nghiệp vụ
  vì cách đó làm sai các câu mà policy đã giải quyết được.
- Nhiều người dùng đồng thời sẽ xếp hàng chờ một khe xử lý AI duy nhất.
- Một request xấu nhất có thể kéo dài khoảng 92 giây ở local hoặc 182 giây ở production.
- Tốn quota và chi phí Gemini không cần thiết.
- Độ trễ thay đổi mạnh theo tình trạng mạng và dịch vụ Gemini.

Mức độ: **Rất cao — nút thắt chính**.

Đề xuất:

1. Không dùng các từ như “xin phép”, “ngoại lệ”, “phúc khảo” để quyết định route. Cách tối ưu
   theo từ khóa này làm sai các câu mà policy đã giải quyết được.
2. AI phải phân loại mức độ policy bao phủ (`DIRECT`, `CONDITIONAL`, `REQUIRES_APPROVAL`,
   `REQUESTS_WAIVER`...) từ câu hỏi và evidence; backend chỉ kiểm chứng schema, citation, scope
   và state transition.
3. Chỉ giữ pre-check tất định cho ngữ cảnh dữ liệu, xung đột tài liệu, prompt injection rõ ràng
   và các lỗi an toàn. Không dùng keyword nghiệp vụ làm quyết định cuối.
4. Sau khi sửa việc giữ kết nối database, cân nhắc tăng số tác vụ AI đồng thời từ 1 lên 2–4,
   tùy quota Gemini.
5. Đặt giới hạn tổng thời gian cho cả request và theo dõi riêng embedding/model decision.

### 3.3. Database

Hiện trạng:

- Một câu hỏi tạo khoảng 11–13 câu lệnh database.
- Với 15 câu hỏi hiện tại, endpoint danh sách thực hiện khoảng 39 câu lệnh database.
- Đây là kiểu lấy từng bản ghi con riêng lẻ: lấy câu hỏi, rồi lần lượt lấy hồ sơ, quyết định và bằng chứng của từng câu.
- Chưa có một số index kết hợp phục vụ các bộ lọc thường xuyên.
- Chưa có index tìm kiếm vector chuyên dụng.
- Khi tìm kiếm bằng từ khóa dự phòng, backend có thể tải cả vector 768 chiều dù không sử dụng.

Ảnh hưởng:

- `/api/questions` hiện mất khoảng 3,17 giây dù chỉ có 15 câu hỏi.
- Càng nhiều câu hỏi, số lần truy vấn càng tăng.
- Khi nhiều trình duyệt cùng mở, database phải lặp lại những truy vấn này liên tục.
- Vector search sẽ chậm đáng kể khi số tài liệu tăng lên hàng nghìn hoặc hàng chục nghìn đoạn.

Mức độ hiện tại: **Trung bình**.  
Mức độ khi dữ liệu tăng: **Cao**.

Trạng thái sau cập nhật 27/09:

1. Đã lấy câu hỏi, hồ sơ, quyết định, ngoại lệ và bằng chứng theo nhóm thay vì theo từng câu.
2. Đã thêm phân trang và API count rút gọn.
3. Đã thêm migration cho các index kết hợp:
   - `questions(actor_id, created_at)`
   - `escalation_cases(status, created_at)`
   - `retrieval_evidence(question_id, rank)`
   - `audit_events(entity_type, entity_id, created_at)`
4. HNSW/IVFFlat vẫn chỉ nên thêm khi số chunk đủ lớn và sau khi có benchmark.
5. Cấu hình connection pool và thời gian chờ vẫn còn là hạng mục tiếp theo.

### 3.4. Verify Harness

Hiện trạng:

- 15 tình huống được chạy lần lượt, câu trước xong mới chạy câu sau.
- Trước khi chạy, harness gọi API reset dữ liệu.
- Reset xóa ba tài liệu DADN và các chunk của chúng, sau đó đọc và xử lý lại các PDF.
- Với Gemini thật, reset có thể gọi embedding nhiều lần.
- Thời gian reset không được cộng vào tổng thời gian hiển thị trên màn hình.

Ảnh hưởng:

- Tổng thời gian gần bằng tổng latency của cả 15 câu cộng lại.
- Người dùng thấy nút Verify đứng một lúc trước khi case đầu tiên xuất hiện.
- Con số tổng thời gian trên giao diện thấp hơn thời gian người dùng thực sự phải chờ.
- Verify cạnh tranh tài nguyên với người dùng đang gửi câu hỏi thật.

Mức độ: **Cao đối với trải nghiệm Verify**.

Trạng thái sau cập nhật 27/09:

1. Đã sửa reset để giữ tài liệu/chunk seed và không gọi ingest lại.
2. Hiển thị riêng thời gian reset và thời gian chạy test.
3. Sau khi sửa transaction và giới hạn AI, chạy song song một số case với mức đồng thời nhỏ.
4. Có chế độ Verify nhanh dùng fake AI để kiểm tra luồng và chế độ Verify đầy đủ dùng Gemini.
5. Không chạy Verify production nếu có thể ảnh hưởng dữ liệu hoặc người dùng thật.

### 3.5. Frontend

Hiện trạng:

- Cứ 10 giây frontend gọi AI health, tải toàn bộ câu hỏi và tải danh sách hồ sơ chờ.
- Việc polling này vẫn hoạt động khi người dùng đang chạy Verify.
- AI health thực hiện request thật tới Gemini, không phải chỉ kiểm tra trạng thái nội bộ của backend.
- Nếu một vòng kiểm tra mất hơn 10 giây, các vòng kiểm tra có thể chồng lên nhau.

Ảnh hưởng:

- Mỗi tab trình duyệt tạo tải nền liên tục lên backend, Gemini và database.
- Nhiều người cùng mở ứng dụng sẽ nhân tải lên nhiều lần.
- Verify và việc gửi câu hỏi có thể bị chậm thêm vì các request nền.
- Tốn quota Gemini chỉ để hiển thị trạng thái online.

Mức độ: **Cao**.

Trạng thái sau cập nhật 27/09:

1. Đã chuyển badge sang API count gọn.
2. Đã cache AI health 45 giây ở backend.
3. Đã đổi từ `setInterval` sang vòng `setTimeout` sau khi request trước hoàn thành.
4. Đã giảm polling xuống 30 giây và bỏ request khi tab đang ẩn.
5. Việc tạm dừng polling riêng trong lúc Verify chạy có thể bổ sung nếu benchmark cho thấy cần thiết.

### 3.6. Deployment

Hiện trạng:

- Render đang dùng gói free và một worker backend.
- Khi container khởi động, hệ thống chạy migration và seed trước khi mở API.
- Nếu tài liệu hoặc embedding không khớp, quá trình seed có thể gọi Gemini trước khi server sẵn sàng.
- File cấu hình Render ghi model `gemini-3.5-flash-lite`, nhưng health endpoint thực tế đang báo `gemini-3.1-flash-lite`.

Ảnh hưởng:

- Lần mở đầu tiên hoặc lần khởi động lại có thể chậm.
- Một worker khiến toàn bộ request phải chia sẻ cùng tài nguyên.
- Khác biệt cấu hình model làm kết quả đo local và production khó so sánh.

Mức độ: **Trung bình**.

Đề xuất:

1. Đã tách seed/ingest khỏi lệnh khởi động web server; đây là thao tác one-off sau deploy.
2. Đã đồng bộ model trong `render.yaml` với cấu hình ứng dụng (`gemini-3.1-flash-lite`).
3. Sau khi tối ưu code, cân nhắc gói không sleep hoặc tăng worker nếu lượng người dùng yêu cầu.

## 4. Thứ tự ưu tiên thực hiện

### P0 — nên làm trước

1. Hoàn tất: bỏ keyword nghiệp vụ khỏi quyết định route; dùng phân loại semantic có cấu trúc.
2. Hoàn tất: ngừng polling toàn bộ `/api/questions` để tính badge.
3. Hoàn tất: sửa truy vấn danh sách câu hỏi để không còn N+1.
4. Hoàn tất: giải phóng transaction trước khi chờ embedding và model decision.
5. Hoàn tất: không re-ingest PDF khi chạy Verify reset.

### P1 — làm ngay sau P0

1. Hoàn tất: thêm phân trang và API đếm hồ sơ.
2. Hoàn tất: cache AI health và chống polling chồng nhau.
3. Thêm số đo thời gian cho từng bước xử lý.
4. Hoàn tất: đồng bộ cấu hình model giữa local và production.
5. Đặt timeout tổng cho request.

### P2 — chuẩn bị cho việc mở rộng

1. Hoàn tất: thêm các database index kết hợp.
2. Thêm vector index khi số lượng chunk đủ lớn.
3. Tăng AI concurrency có kiểm soát.
4. Chạy harness song song ở mức phù hợp.
5. Thêm performance test và load test vào CI.

## 5. Mục tiêu cần benchmark lại sau khi deploy

- Không đánh đổi độ chính xác route bằng keyword chỉ để giảm AI call.
- Endpoint danh sách câu hỏi giảm từ truy vấn theo từng câu xuống số truy vấn cố định theo lô.
- Verify không còn mất thời gian ingest lại PDF.
- Nhiều người dùng đồng thời ít có nguy cơ timeout hoặc hết kết nối database hơn.
- Số liệu dashboard và Verify phản ánh đúng thời gian người dùng thực sự chờ.

## 6. Giải thích từ ngữ

- **API**: Đường giao tiếp giữa frontend và backend.
- **Embedding**: Cách AI biến câu hỏi hoặc tài liệu thành dãy số để tìm nội dung tương tự.
- **RAG**: Tìm tài liệu liên quan trước rồi mới yêu cầu AI trả lời dựa trên tài liệu đó.
- **Query**: Một lần backend hỏi hoặc ghi dữ liệu vào database.
- **N+1 query**: Lấy một danh sách, sau đó tiếp tục hỏi database riêng cho từng phần tử trong danh sách.
- **Transaction**: Một nhóm thao tác database được giữ lại cho tới khi hoàn tất hoặc hủy bỏ.
- **Connection pool**: Số lượng kết nối database được backend giữ sẵn để phục vụ request.
- **Timeout**: Thời gian tối đa hệ thống chờ trước khi xem một thao tác là thất bại.
- **Concurrency**: Số công việc được phép chạy cùng lúc.
- **Polling**: Frontend tự động gọi lại API sau một khoảng thời gian cố định.
- **Index**: Cấu trúc giúp database tìm dữ liệu nhanh hơn.

## 7. Phạm vi kiểm tra

Báo cáo được tổng hợp từ:

- Toàn bộ luồng gửi câu hỏi và xử lý quyết định.
- Gemini provider, RAG và fallback search.
- Database models, session, query và migrations.
- Verify UI và CLI harness.
- Polling frontend.
- Cấu hình Docker và Render.
- Các report hiệu năng có sẵn trong `harness/reports/`.
- Đo trực tiếp các endpoint production ở thời điểm kiểm tra.

Thay đổi hoàn tất ngày 27/09 gồm semantic routing, exception overview theo môn/nhóm và các tối ưu được
đánh dấu “Hoàn tất” ở trên. Cần chạy lại benchmark production trước khi công bố số liệu mới.
