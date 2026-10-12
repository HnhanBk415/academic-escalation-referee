# Academic Escalation Referee

AER tập trung vào Flow 1: sinh viên hỏi quy chế học phần, AI đối chiếu tài liệu và
ngoại lệ đã được duyệt để trả lời kèm trích dẫn, hỏi thêm dữ kiện hoặc chuyển hồ sơ
đến người có thẩm quyền. Giảng viên/Phòng Đào tạo quyết định; sinh viên theo dõi
kết quả trong lịch sử. Quyết định, ngoại lệ và SLA được truy vết qua Audit Trail.

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
Database lưu trữ toàn bộ các bảng của Flow 1 (câu hỏi, quyết định, ngoại lệ, tài liệu học phần và audit trail).
Tài liệu học phần trong `data/sample-documents/` là nguồn trích dẫn cho hỏi đáp quy chế.
