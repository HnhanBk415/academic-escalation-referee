# Hướng Dẫn Triển Khai (Deployment Guide) Hệ Thống AER

Tài liệu này hướng dẫn chi tiết quy trình đưa hệ thống **Academic Escalation Referee (AER)** lên môi trường Cloud miễn phí/chi phí thấp, đảm bảo tính sẵn sàng cao và dễ vận hành:

```text
┌─────────────────────────┐                          ┌─────────────────────────┐
│     Vercel (Frontend)   │ ───────────────────────► │     Render (Backend)    │
│  https://<app>.vercel.app│     CORS REST API       │ https://<api>.onrender.com│
└─────────────────────────┘                          └────────────┬────────────┘
                                                                  │ AsyncPG (SSL)
                                                                  ▼
                                                     ┌─────────────────────────┐
                                                     │  Supabase / Neon (DB)   │
                                                     │  PostgreSQL + pgvector  │
                                                     └─────────────────────────┘
```

---

## BƯỚC 1: Khởi Tạo Database Cloud (Supabase hoặc Neon)

Hệ thống AER yêu cầu PostgreSQL hỗ trợ extension `pgvector` với vector 768 chiều.

### Lựa chọn A: Supabase (Khuyên dùng)
1. Truy cập [supabase.com](https://supabase.com) và tạo tài khoản miễn phí.
2. Bấm **New Project**, chọn Organization, đặt tên project (ví dụ: `aer-db`), nhập mật khẩu Database.
3. Chọn Region gần nhất (ví dụ: `Singapore (ap-southeast-1)`).
4. Bật extension `pgvector`:
   - Bấm vào icon **SQL Editor** (`>_` ở cột bên trái) và chạy lệnh:
     ```sql
     create extension if not exists vector;
     ```
5. Lấy chuỗi kết nối (Connection string):
   - Ngay trên thanh Header trên cùng, bấm vào nút **`Connect`**.
   - Chọn mục **URI** (hoặc tab **Connection String** > **URI**).
   - Chọn Type: **Session** (port 5432) hoặc **Direct connection**.
   - Đổi tiền tố `postgresql://` thành `postgresql+asyncpg://` và thay `[YOUR-PASSWORD]` bằng mật khẩu Database của bạn.
   - Ví dụ:
     ```
     postgresql+asyncpg://postgres.[project-ref]:MyPassword123@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
     ```

### Lựa chọn B: Neon (Serverless Postgres)
1. Truy cập [neon.tech](https://neon.tech) và tạo project miễn phí.
2. Lấy Connection string dạng `postgresql://...` và đổi thành `postgresql+asyncpg://...` kèm `?ssl=require`.

---

## BƯỚC 2: Chạy Migration & Seed Dữ Liệu Ban Đầu (Tùy chọn)

Nếu muốn seed dữ liệu từ máy local lên Cloud DB trước khi deploy:

```powershell
# 1. Đặt biến môi trường trỏ đến Cloud DB
$env:DATABASE_URL = "postgresql+asyncpg://postgres:[PASSWORD]@[HOST]:5432/postgres"

# 2. Chuyển vào thư mục backend
cd backend

# 3. Chạy migration tạo bảng và extension pgvector
python -m alembic upgrade head

# 4. Seed dữ liệu quy chế ban đầu (actors, courses, documents, chunks)
$env:AI_MODE = "gemini"
$env:GEMINI_API_KEY = "AIzaSy..." # API key của bạn
$env:GEMINI_CHAT_MODEL = "gemini-3.5-flash-lite"
$env:GEMINI_EMBED_MODEL = "gemini-embedding-001"
$env:EMBEDDING_DIMENSIONS = "768"

python -m app.db.seed

cd ..
```

*(Lưu ý: Dockerfile của backend cũng đã được thiết lập tự động chạy `alembic upgrade head` và `(python -m app.db.seed || true)` mỗi khi khởi động container).*

---

## BƯỚC 3: Deploy Backend Lên Render.com

1. Đẩy mã nguồn của bạn lên repository trên **GitHub**.
2. Đăng nhập [render.com](https://render.com).
3. Bấm **New +** > chọn **Web Service**.
4. Kết nối tới GitHub repository của bạn.
5. Cấu hình Web Service:
   - **Name**: `academic-escalation-referee-api` (hoặc tên tùy chọn)
   - **Region**: `Singapore` (cùng region với database ở Bước 1)
   - **Language**: Chọn **Docker**
   - **Docker Context**: `.` (thư mục gốc repo)
   - **Dockerfile Path**: `backend/Dockerfile`
   - **Instance Type**: `Free`
6. Cuộn xuống phần **Environment Variables**, thêm các biến sau:

| Tên biến | Giá trị |
|---|---|
| `APP_ENV` | `production` |
| `AI_MODE` | `gemini` |
| `GEMINI_API_KEY` | *(Điền Gemini API Key của bạn)* |
| `GEMINI_CHAT_MODEL` | `gemini-3.5-flash-lite` |
| `GEMINI_EMBED_MODEL` | `gemini-embedding-001` |
| `EMBEDDING_DIMENSIONS` | `768` |
| `AI_REQUEST_TIMEOUT_SECONDS` | `60` |
| `PROMPT_VERSION` | `referee-v1` |
| `DATABASE_URL` | *(Connection string từ Bước 1, có tiền tố `postgresql+asyncpg://`)* |
| `CORS_ORIGINS` | `https://*.vercel.app,http://localhost:5173,http://localhost` |

7. Bấm **Create Web Service**. Render sẽ build Docker container và khởi chạy server.
8. Sau khi build thành công, copy URL public của backend, ví dụ:
   ```
   https://academic-escalation-referee-api.onrender.com
   ```
9. Kiểm tra nhanh bằng cách mở trình duyệt truy cập:
   - `https://<your-backend-url>/health` ➔ Trả về `{"status":"ok", "database":"ok"}`
   - `https://<your-backend-url>/health/ai` ➔ Trả về `{"available": true, "model": "gemini-3.5-flash-lite", ...}`

---

## BƯỚC 4: Deploy Frontend Lên Vercel

1. Đăng nhập [vercel.com](https://vercel.com).
2. Bấm **Add New...** > **Project**.
3. Import repository GitHub của bạn.
4. Cấu hình dự án (Project Configuration):
   - **Framework Preset**: Chọn **Vite**
   - **Root Directory**: Bấm Edit và chọn thư mục **`frontend`**
   - **Build Command**: `npm run build` (mặc định)
   - **Output Directory**: `dist` (mặc định)
5. Mở mục **Environment Variables**, thêm biến kết nối API:

| Tên biến | Giá trị |
|---|---|
| `VITE_API_BASE_URL` | `https://<your-backend-url>` (URL backend Render ở Bước 3, **không** có dấu `/` ở cuối) |

*(Ví dụ: `https://academic-escalation-referee-api.onrender.com`)*

6. Bấm **Deploy**. Vercel sẽ tự động cài đặt dependencies, build Vite SPA và phân phối CDN trong vòng ~1 phút.
7. Vercel sẽ cung cấp domain chính thức, ví dụ:
   ```
   https://academic-escalation-referee-web.vercel.app
   ```

---

## BƯỚC 5: Kiểm Tra Hoạt Động (Smoke Test)

1. Mở trang web Vercel: `https://<your-app>.vercel.app/`.
2. Kiểm tra các màn hình:
   - **Màn hình 1 (Gửi câu hỏi mới)**: Chọn học phần `CO3001` hoặc `DADN-HK242`, gửi câu hỏi.
   - **Màn hình 2 (Câu hỏi của tôi)**: Kiểm tra Stepper tiến trình và trích dẫn quy chế RAG.
   - **Màn hình 3 (Hàng chờ thẩm định)**: Đổi role sang Giảng viên, kiểm tra bộ đếm SLA 48h và 4 nút ra quyết định.
   - **Màn hình 4 (Ngoại lệ quy chế)**: Kiểm tra danh sách ngoại lệ.

---

## Lưu Ý Quan Trọng Khi Sử Dụng Bản Miễn Phí (Free Tier)

- **Render Free Web Service Sleep**: Gói Free của Render sẽ tự động tạm ngủ sau 15 phút không có lượt truy cập. Khi có request đầu tiên sau thời gian ngủ, Render sẽ mất khoảng **30-50 giây** để khởi động lại container (Cold Start).
- **Vercel Preview CORS**: Backend đã cấu hình `allow_origin_regex=r"https://.*\.vercel\.app"`, nên mọi preview URL (Pull Request deployment) của Vercel đều tự động kết nối được với backend mà không bị lỗi CORS.
