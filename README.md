# Academic Escalation Referee

Academic Escalation Referee hỗ trợ sinh viên về các yêu cầu học vụ. Hệ thống tìm thông tin trong tài liệu môn học, trả lời kèm trích dẫn, yêu cầu bổ sung dữ kiện hoặc chuyển câu hỏi đến giảng viên. 
## Link demo
https://aersystem.vercel.app/

## Tính năng

- Hệ thống phân tích và xử lý yêu cầu từ sinh viên.
- Phân loại câu hỏi: trả lời, hỏi làm rõ, chuyển người có thẩm quyền hoặc từ chối.
- Quản lý hồ sơ chuyển cấp, quyết định và ngoại lệ chính sách.
- Nạp tài liệu PDF, Markdown và TXT.
- Theo dõi hoạt động qua Audit Trail.
- Chế độ AI giả lập để chạy demo không cần API key Gemini.

## Công nghệ

- **Backend:** Python, FastAPI, SQLAlchemy, Alembic
- **Database:** PostgreSQL và pgvector
- **Frontend:** React, TypeScript, Vite
- **AI:** Google Gemini hoặc provider giả lập
- **Triển khai:** Docker Compose; Render và Vercel

## Yêu cầu

Để chạy bằng Docker:

- Docker
- Docker Compose

Để chạy môi trường phát triển cục bộ:

- Python 3.11 trở lên
- Node.js 22 trở lên
- npm
- Docker, để chạy PostgreSQL và pgvector

## Chạy nhanh bằng Docker

Tại thư mục gốc dự án, tạo file cấu hình môi trường và khởi động các dịch vụ:

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

Mặc định, `.env.example` dùng `AI_MODE=fake`, nên có thể chạy demo mà không cần API key.

Các địa chỉ sau sẽ khả dụng khi các dịch vụ đã khởi động:

- Ứng dụng: <http://localhost>
- API: <http://localhost:8000>
- Tài liệu API Swagger: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/health>

Khi khởi động, API tự chạy migration cơ sở dữ liệu và nạp dữ liệu demo. Để xem trạng thái hoặc log:

```powershell
docker compose ps
docker compose logs -f api
docker compose logs -f web
```

## Chạy phát triển trên Windows

Tạo `.env`, cài đặt backend, khởi động PostgreSQL và chạy migration/seed:

```powershell
Copy-Item .env.example .env
docker compose up -d postgres

Push-Location backend
py -3.13 -m pip install -e ".[dev]"
py -3.13 -m alembic upgrade head
py -3.13 -m app.db.seed
Pop-Location
```

Mở một terminal để chạy backend:

```powershell
.\scripts\dev-api.ps1
```

Mở terminal khác để chạy frontend:

```powershell
.\scripts\dev-frontend.ps1
```

Frontend chạy tại <http://localhost:5173> và chuyển tiếp API đến `http://localhost:8000`.

Các script tiện ích khác:

```powershell
.\scripts\setup.ps1       # Cài dependency, migration và dữ liệu demo
.\scripts\seed.ps1        # Chạy lại migration và seed
.\scripts\reindex.ps1     # Re-index dữ liệu demo
.\scripts\build.ps1       # Kiểm tra backend và build frontend
.\scripts\verify.ps1      # Chạy bộ kịch bản kiểm tra qua API
```

## Cấu hình

Các biến môi trường nằm trong `.env.example`. Sao chép file này thành `.env` trước khi chạy.

| Biến | Mô tả |
|---|---|
| `DATABASE_URL` | URL kết nối database |
| `AUTH_MODE` | `demo` để chạy role switch khi phát triển; production cần dùng `password` |
| `AI_MODE` | `fake` hoặc `gemini` |
| `GEMINI_API_KEY` | API key dùng cho câu trả lời và embedding khi chọn Gemini |
| `GEMINI_VISION_API_KEY` | API key riêng cho OCR ảnh và PDF scan |
| `GEMINI_CHAT_MODEL` | Model Gemini dùng để xử lý câu hỏi |
| `GEMINI_EMBED_MODEL` | Model Gemini dùng để tạo embedding |
| `RAG_TOP_K` | Số đoạn tài liệu tối đa đưa vào bước truy xuất |
| `RAG_CONTEXT_CHUNKS` | Số đoạn tài liệu đưa vào ngữ cảnh AI |
| `CORS_ORIGINS` | Danh sách origin được phép gọi API |
| `PUBLIC_BASE_URL` | URL công khai của API |

Để bật Gemini, đặt `AI_MODE=gemini` và điền `GEMINI_API_KEY`. OCR cho tài liệu scan cần thêm `GEMINI_VISION_API_KEY`.

## API chính

API được cung cấp dưới tiền tố `/api/v1` (cũng hỗ trợ `/api`).

| Nhóm | Đường dẫn |
|---|---|
| Đăng nhập | `/api/v1/auth` |
| Câu hỏi và làm rõ | `/api/v1/questions` |
| Hồ sơ chuyển cấp và quyết định | `/api/v1/cases` |
| Tài liệu và xử lý tài liệu | `/api/v1/documents` |
| Ngoại lệ chính sách | `/api/v1/exceptions` |
| Nhật ký kiểm toán | `/api/v1/audit` |
| Trạng thái hệ thống | `/health`, `/health/ai` |

Xem chi tiết endpoint tại <http://localhost:8000/docs> khi backend đang chạy.

## Kiểm tra chất lượng

Chạy từ thư mục gốc của dự án:

```powershell
Push-Location backend
py -3.13 -m ruff check .
py -3.13 -m pytest tests -q
Pop-Location

Push-Location frontend
npm ci
npm test
npm run build
Pop-Location
```

Build Docker Compose:

```powershell
docker compose build
```

## Cấu trúc dự án

```text
.
├── backend/                 # FastAPI, nghiệp vụ, RAG và migration
├── frontend/                # Ứng dụng React và TypeScript
├── data/
│   ├── demo-config.json     # Cấu hình môn học và dữ liệu demo
│   └── sample-documents/    # Tài liệu mẫu theo học phần
├── harness/                 # Bộ kịch bản đánh giá qua API
├── scripts/                 # Script phát triển và vận hành
├── docker-compose.yml
├── DEPLOYMENT.md             # Hướng dẫn triển khai production
└── PROJECT_OVERVIEW.md       # Mô tả kiến trúc và luồng nghiệp vụ
```


## Giấy phép

Dự án được phân phối theo giấy phép [MIT](LICENSE).
