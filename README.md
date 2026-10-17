# Academic Escalation Referee

AER tiếp nhận yêu cầu bằng ngôn ngữ tự nhiên, kiểm tra Service Catalog để chọn đơn vị
phụ trách, rồi tra policy trong dataset của đúng dịch vụ. Hệ thống trả lời kèm nguồn,
hỏi thêm dữ kiện, hoặc chuyển hồ sơ vào hàng chờ nhân viên. Thao tác ghi chỉ chạy qua
backend sau khi kiểm tra quyền, xác nhận và phê duyệt theo quy tắc của dịch vụ.

## Chạy local

```powershell
./scripts/setup.ps1
./scripts/dev.ps1
```

Cấu hình môi trường nằm trong `.env.example`; xem hướng dẫn đầy đủ tại
[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) và [DEPLOYMENT.md](DEPLOYMENT.md).

## Kiểm tra

```powershell
cd backend
py -3.13 -m ruff check app tests migrations
py -3.13 -m pytest -q -p no:cacheprovider
cd ../frontend
npm test
npm run build
```

## Database khi khởi tạo / nâng cấp

Chạy `py -3.13 -m alembic upgrade head` từ `backend` trước khi khởi động ứng dụng.
Database lưu yêu cầu dịch vụ, tài liệu đã nạp, audit trail và các bảng Flow 1 cũ.
`data/sample-documents/` và `data/service-policies/` được đưa qua cùng pipeline
Document → Chunk → embedding. Chạy `scripts/seed.ps1` sau khi thay đổi tài liệu để
cập nhật dataset. API intake mới nằm dưới `/api/v1/service-requests`.

## Service Routing API

- `GET /api/v1/service-requests/catalog` — service, đơn vị phụ trách, intent và SLA.
- `POST /api/v1/service-requests` — gửi câu tự do: `{"text":"...","slots":{}}`;
  có thể gửi `Idempotency-Key` để tránh tạo trùng khi retry.
- `GET /api/v1/service-requests` — lịch sử của người gửi hoặc hàng đợi theo vai trò.
- `POST /{id}/clarify` — trả lời câu hỏi bổ sung bằng `{"text":"...","slots":{}}`.
- `POST /{id}/confirm` và `POST /{id}/decision` — xác nhận sinh viên, sau đó giảng viên
  phê duyệt thao tác thêm thành viên DADN.
- `POST /{id}/review` — nhân viên đơn vị phản hồi bằng `{"message":"...","outcome":"wait"}`;
  dùng `outcome: "resolve"` để ghi nhận kết quả do nhân viên xử lý.
- `POST /{id}/handoff` — Phòng Đào tạo bàn giao yêu cầu chưa xác định được đích.
- `GET /{id}` và `GET /{id}/events` — trạng thái, kết quả, trích dẫn policy và audit.

Trong `AUTH_MODE=demo`, gửi `X-Demo-Actor-ID`; chế độ mật khẩu dùng Bearer token.
Mọi tài khoản hợp lệ có thể hỏi policy. Các yêu cầu thay đổi dữ liệu vẫn bị chặn theo
role và quy tắc riêng của service.

## Giấy phép (License)

Dự án được phân phối dưới giấy phép [MIT](LICENSE).
