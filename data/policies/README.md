# Format policy source files

Thư mục này là **nguồn cấu hình có thể kiểm soát phiên bản** cho Flow 2: pre-check
thể thức báo cáo. Policy chỉ phục vụ việc kiểm tra trước khi nộp; nó không thay thế
quy trình chấm điểm hay quyết định học vụ của giảng viên.

## Phạm vi và cách chọn policy

Một file policy tương ứng với một cặp `course_id + semester`:

```text
data/policies/<course_id>/<semester>.yaml
```

Vì một môn trong một học kỳ có thể có nhiều loại báo cáo, file chứa nhiều
`report_profiles`. Hệ thống lấy `course_id` và `semester` từ ngữ cảnh học phần,
rồi xử lý như sau:

1. Nếu chỉ có một profile `ACTIVE`, chọn profile đó tự động.
2. Nếu có nhiều profile `ACTIVE`, hiển thị danh sách `report_type` để sinh viên chọn.
3. Nếu không có profile `ACTIVE` phù hợp, không kiểm tra và báo `UNABLE_TO_CHECK`;
   tuyệt đối không dùng nhầm template của loại báo cáo khác.

`report_type` là **profile nằm trong policy của môn/học kỳ**, không phải một policy
toàn hệ thống. Ví dụ: `progress_report`, `final_project_report`.

## Vòng đời và tính bất biến

- Giảng viên phụ trách có thể tạo và kích hoạt version mới ngay.
- Với cùng `course_id + semester + report_type`, chỉ một version được `ACTIVE`.
  Version active cũ chuyển thành `SUPERSEDED`, không bị xóa.
- Một lần pre-check phải lưu ít nhất `policy_id`, `policy_version`, `report_type`,
  `template_hash` và snapshot các rule đã áp dụng. Kết quả cũ vì thế vẫn xem lại
  đúng theo policy tại thời điểm kiểm tra.
- Mọi lần tạo/kích hoạt/thay thế policy phải ghi audit event cùng người thực hiện,
  thời điểm và lý do thay đổi.

## Hai lớp trạng thái — không trộn lẫn

`handling` nằm trên **từng rule**:

| Giá trị | Ý nghĩa |
|---|---|
| `BLOCKING` | Rule fail làm lần pre-check có kết quả `NEEDS_FIX`. |
| `ADVISORY` | Chỉ đưa khuyến nghị; không chặn kết quả đạt. |
| `MANUAL_REVIEW` | Rule phải được giảng viên xác nhận, dù máy có đọc được dữ liệu. |

`result` là kết quả của **một lần pre-check**:

| Giá trị | Ý nghĩa |
|---|---|
| `PASS` | Không có lỗi `BLOCKING`; chỉ có pass/advisory đã ghi nhận. |
| `NEEDS_FIX` | Có ít nhất một rule `BLOCKING` fail. |
| `NEEDS_REVIEW` | Có rule `MANUAL_REVIEW` hoặc bằng chứng mơ hồ cần giảng viên xem. |
| `UNABLE_TO_CHECK` | File/đầu vào không đủ tin cậy để kiểm tra (scan, hỏng, sai định dạng, không đọc được). |

`UNABLE_TO_CHECK` không có nghĩa bài sai và không tự đưa ra kết luận học vụ.

## Rule contract

Mỗi rule có `rule_id` bất biến trong các version, `handling`, `rule_type`,
`expected` và bằng chứng nguồn. Không ghi quy tắc ẩn trong code: mọi yêu cầu nghiệp
vụ phải xuất hiện trong policy hoặc tài liệu nguồn được policy tham chiếu.

`rule_type` hiện được chuẩn hóa thành:

- `MEASUREMENT`: số trang, lề, font, cỡ chữ, giãn dòng.
- `PRESENCE`: thành phần bắt buộc như bìa, mục lục, tài liệu tham khảo.
- `TEMPLATE`: đề mục/chương/mục con và template.

Trường `automation` cho biết khả năng hiện tại. Rule có `automation: manual` không
được máy tự suy diễn là pass/fail; nó tạo `NEEDS_REVIEW` khi được yêu cầu.

## Quy trình thay đổi an toàn

1. Sao chép `course-semester-policy.template.yaml` thành file của môn/học kỳ.
2. Tạo profile/rule, liên kết tài liệu nguồn và điền checksum template nếu có.
3. Validate bằng `course-semester-policy.schema.json`, kiểm tra Rule ID trùng lặp và chạy dry-run với một bài đạt, một
   bài thiếu thành phần, một file không đọc được.
4. Giảng viên kích hoạt. Không chỉnh sửa nội dung của version đang `ACTIVE`; tạo
   version mới thay thế.

Các file YAML là lớp **source-of-truth cho cấu hình** và được importer nạp vào
`FormatCriteriaSet` khi seed. Importer không chỉ kiểm tra JSON Schema: nó còn chặn
semantic version sai, profile/Rule ID trùng, enum xử lý không hợp lệ, rule `manual`
không dẫn đến review, source/template tham chiếu nhầm tài liệu, checksum SHA-256 không
khớp, và tài liệu nguồn không thuộc học phần. Nếu có lỗi, policy không được ghi một
phần vào runtime store.
