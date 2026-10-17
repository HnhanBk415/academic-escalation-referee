# Quyết định phạm vi MVP — Service Routing Hackathon

**Mục đích:** tài liệu thống nhất cho nhóm trước khi tạo dữ liệu demo và triển khai MVP trong timebox 3 giờ. Đây là một vertical slice có thể trình diễn, **không** phải hệ thống production-ready.

## 1. Định vị sản phẩm

AER được mở rộng từ Flow 1 (hỏi đáp quy chế học vụ) thành một **cửa tiếp nhận chung cho yêu cầu của sinh viên**:

> Sinh viên mô tả nhu cầu bằng ngôn ngữ tự nhiên. Hệ thống xác định dịch vụ và đơn vị phụ trách, hỏi thêm nếu thiếu dữ kiện, trả lời theo policy có nguồn khi phù hợp, hoặc tạo/handoff hồ sơ có SLA. AI chỉ đề xuất và phân loại; backend và con người kiểm soát quyền, quy tắc và thao tác ghi dữ liệu.

Điểm khác biệt không chỉ là trả lời nhanh: mọi yêu cầu phải có **đích tiếp nhận, trạng thái, evidence/policy source và audit trail**.

## 2. Quyết định phạm vi

Trong MVP chỉ triển khai ba đơn vị nghiệp vụ và một hàng đợi fallback:

| ID | Đơn vị | Phạm vi demo |
|---|---|---|
| `academic_affairs` | Phòng Đào tạo | Đăng ký/rút học phần, yêu cầu bảng điểm, tra trạng thái hồ sơ giả lập |
| `faculty_cs` | Khoa Khoa học Máy tính / giảng viên | Quy chế DADN, nhóm đồ án, yêu cầu thêm thành viên nhóm demo |
| `clinic` | Trạm Y tế | Giờ làm việc, đặt/hủy lịch giả lập, thông tin liên hệ demo |
| `triage_desk` | Hàng đợi điều phối do Phòng Đào tạo sở hữu | Nhận các yêu cầu chưa tự động hóa hoặc chưa xác định được đích phù hợp |

`student_affairs`/Công tác Sinh viên **không thuộc MVP 3 giờ**. Đây là tổ chức mở rộng sau hackathon, không nên vừa triển khai vừa tuyên bố đã hoàn thiện.

## 3. Quy tắc fallback: không bỏ rơi yêu cầu

`TRIAGE_DESK` không có nghĩa là "không xử lý được". Đây là hàng đợi điều phối thủ công:

```text
Yêu cầu confidence thấp / chưa có service catalog / chưa có policy / cần thẩm quyền
  → TRIAGE_DESK
  → nhân viên xác định đầu mối phù hợp
  → chuyển lại tổ chức hoặc tạo routing rule/catalog cho lần sau
```

Thông điệp cho sinh viên:

> Yêu cầu của bạn chưa có quy trình tự động phù hợp. Hệ thống đã tạo hồ sơ và chuyển đến bộ phận điều phối để xác định đầu mối xử lý.

Reason code tối thiểu:

- `LOW_ROUTING_CONFIDENCE`
- `SERVICE_NOT_YET_CATALOGED`
- `MISSING_REQUIRED_INFORMATION`
- `POLICY_SOURCE_UNAVAILABLE`
- `MANUAL_REVIEW_REQUIRED`

## 4. Luồng xử lý chính thức

```text
1. Sinh viên gửi yêu cầu + actor demo đã xác thực + request_id
2. Privacy gate: redact PII nhận diện được trước khi log, audit, lưu DB hoặc gửi AI
3. AI phân loại service/intent và trích xuất dữ kiện (chỉ đề xuất)
4. Backend kiểm tra catalog allowlist, schema, role, scope, confidence và required fields
5. Chọn workflow của service
   - FAQ/policy: truy xuất policy đúng service → trả lời kèm nguồn/version
   - Thiếu dữ kiện: hỏi đúng trường thiếu → quay lại bước 3
   - Read-only: gọi mock connector → hiển thị dữ liệu DEMO
   - Write: preview → xác nhận → rule checks → mock connector allowlist → verify lại
   - Không rõ/không hỗ trợ/cần người quyết định: route TRIAGE_DESK hoặc người phụ trách
6. Trả service, đơn vị nhận, trạng thái/kết quả và bước tiếp theo
7. Ghi audit đã redact: route, quyết định backend, action, actor, request_id, kết quả
```

**Lưu ý kiến trúc:** Với đề mới, Service Catalog được xác thực trước; RAG/policy retrieval chỉ được dùng sau khi đã chọn service phù hợp. Flow RAG/citation cũ của AER tiếp tục là thế mạnh cho `faculty_cs`.

## 5. Service Catalog tối thiểu

Mỗi service phải là allowlist và có các trường:

```text
service_id, display_name, organization_id, supported_intents,
required_fields, allowed_actions, required_role, approval_rule,
SLA, connector_type=mock, policy_version/source, support_status
```

Không cho model tự tạo service mới, action mới, SQL, shell command hoặc endpoint bất kỳ.

### Kịch bản demo ưu tiên

| Input ví dụ | Đích | Kết quả đúng |
|---|---|---|
| “Em muốn thêm bạn Minh vào nhóm đồ án DADN.” | `faculty_cs` | Hỏi mã nhóm/mã SV nếu thiếu; kiểm tra điều kiện; preview/xác nhận; mock write; verify; audit |
| “Em xin bảng điểm, hồ sơ của em tới đâu rồi?” | `academic_affairs` | Hỏi mã yêu cầu nếu thiếu; mock read-only; chỉ hiển thị trạng thái DEMO |
| “Em muốn đặt lịch ở trạm y tế.” | `clinic` | Hỏi khung giờ tối thiểu; tạo lịch DEMO; không thu dữ liệu sức khỏe nhạy cảm |
| “Nhóm em xin phép 6 thành viên.” | `faculty_cs` | Không bỏ qua rule; tạo case/chuyển giảng viên nếu cần ngoại lệ |
| Yêu cầu không rõ hoặc không khớp catalog | `triage_desk` | Hỏi lại ngắn gọn hoặc tạo hồ sơ điều phối; không route bừa |

## 6. Vertical slice: thêm thành viên nhóm DADN

Đây là thao tác ghi dữ liệu duy nhất trong MVP.

Điều kiện backend bắt buộc:

1. Nhóm tồn tại và thuộc đúng học phần.
2. Người gửi được phép yêu cầu thay đổi nhóm đó.
3. Thành viên mới chưa thuộc nhóm.
4. Nhóm còn chỗ theo policy DADN hiện có.
5. Có preview/xác nhận trước thao tác ghi.
6. Chỉ mock connector `add_member_to_group` được phép thực thi.
7. Có idempotency: gửi lặp không tạo membership trùng.
8. Đọc lại dữ liệu sau ghi; chỉ báo thành công khi verify thành công.

Nếu nhóm đầy, thiếu dữ kiện, thành viên đã tồn tại, không đủ quyền hoặc cần ngoại lệ: không ghi dữ liệu; nêu lý do và route giảng viên/triage khi phù hợp.

## 7. Dữ liệu demo và policy

- Toàn bộ record dùng tiền tố `DEMO-*`; actor/student ref là giả lập, ví dụ `demo-student-01`.
- Không dùng tên thật, MSSV thật, email thật, điểm thật, CCCD thật, hồ sơ y tế thật hoặc quy chế trường chưa được duyệt.
- Policy của Phòng Đào tạo và Trạm Y tế phải hiện rõ nhãn: `DEMO POLICY — NOT OFFICIAL`.
- DADN tái sử dụng policy/tài liệu có sẵn trong repo; không tạo policy mới mâu thuẫn tài liệu đó.
- Cần một nhóm DADN còn chỗ và một nhóm đầy, dựa trên giới hạn có trong policy hiện có.
- Phòng Đào tạo có tối thiểu một hồ sơ DEMO với trạng thái `RECEIVED`, `PROCESSING`, `READY` hoặc `NEEDS_INFO`.
- Trạm Y tế có tối thiểu một lịch hẹn DEMO.

`READY` trong demo chỉ có nghĩa là yêu cầu mô phỏng đã sẵn sàng, **không** tương đương cấp bảng điểm/chứng từ chính thức.

## 8. Privacy và bảo mật tối thiểu

### Nguyên tắc không thương lượng

- Backend, không phải UI, là security boundary.
- Redact chuỗi PII nhận diện được (ví dụ CCCD) **trước** mọi persistence, audit, log, prompt AI, case summary và error log.
- Không lưu bản gốc đã redact ở bản ghi khác.
- Nhánh `clinic` không lưu triệu chứng/CCCD thô và không hỗ trợ chẩn đoán, kê đơn hoặc xử lý cấp cứu bằng AI.
- Khi có nguy cơ y tế: chỉ hiển thị thông điệp an toàn cấu hình sẵn, hướng liên hệ cơ sở y tế/cấp cứu phù hợp; không tạo medical advice.
- Action ghi chỉ qua backend allowlist, kiểm tra role/scope/rule phía server và fail closed khi có lỗi.
- Connector/provider lỗi: không có side effect và không báo thành công.

### Nhãn trình diễn

- `DEMO DATA`
- `MOCK CONNECTOR`
- `AUTH_MODE=demo` chỉ dùng cho local demo; không tuyên bố là SSO/xác thực production.

## 9. UI cần chứng minh điều gì

Không làm lại toàn bộ giao diện. UI phải làm rõ được bốn ranh giới:

1. **AI đề xuất:** service, intent, thông tin còn thiếu.
2. **Backend đã kiểm tra:** catalog, quyền, policy/rule.
3. **Mock connector đã thực hiện:** chỉ khi có allowlist, preview/xác nhận và verify.
4. **Chờ người duyệt/điều phối:** khi không thể tự động hóa an toàn.

Hiển thị rõ service, đơn vị nhận, timeline, SLA/bước tiếp theo, `DEMO DATA` và `MOCK CONNECTOR`.

## 10. Thứ tự triển khai trong 3 giờ

1. Catalog gồm 3 tổ chức + `triage_desk`, model/schema tối thiểu.
2. Routing end-to-end và fallback triage.
3. Mock connector `add_member_to_group` với backend rule checks, confirmation, verify và audit.
4. Privacy gate cho mọi đường dữ liệu mới của MVP.
5. UI timeline/trạng thái rõ ràng.
6. Tests cho route, authorization, group đầy, idempotency, fallback, no-side-effect khi lỗi.
7. Policy FAQ/visual polish nếu còn thời gian.

Không tích hợp SIS/LMS/hệ thống điểm/y tế thật trong hackathon.

## 11. Tiêu chí demo thành công

- Một yêu cầu được route chính xác đến một trong ba tổ chức, hoặc vào `TRIAGE_DESK` có lý do rõ ràng.
- Không có yêu cầu nào bị “bỏ rơi” chỉ vì workflow chưa được tự động hóa.
- Action thêm thành viên demo chỉ chạy sau backend validation và xác nhận; có verify sau ghi.
- Hệ thống không bịa điểm, không phát hành chứng từ thật, không chẩn đoán y tế.
- Người xem thấy được route, policy/evidence (nếu có), trạng thái, request ID/audit và người/bộ phận chịu trách nhiệm.

## 12. Roadmap sau MVP

- Thêm Công tác Sinh viên và các đơn vị khác qua Service Catalog.
- Phân công reviewer/giảng viên theo học phần thật.
- Tích hợp SSO/LMS/SIS qua connector có kiểm soát.
- Định tuyến escalation thành các loại thẩm quyền/vi phạm riêng và gửi đúng đơn vị.
- Đo route accuracy, false escalation và thời gian xử lý SLA.
- Dùng queue/worker cho OCR, ingestion và connector bất đồng bộ.
