# Hướng Dẫn Deploy AER (Academic Escalation Referee)

Hướng dẫn chi tiết từng bước đưa hệ thống AER lên môi trường Production hoàn toàn miễn phí:
- **Frontend (React + Vite SPA)**: Deploy lên **Vercel**
- **Backend (FastAPI + Docker)**: Deploy lên **Render.com**
- **Database (PostgreSQL 16 + pgvector)**: Sử dụng **Supabase** hoặc **Neon**

---

## Kiến Trúc Hệ Thống Trên Cloud

```
┌─────────────────────────┐          HTTPS           ┌─────────────────────────┐
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

### Lựa chọn A: Supabase (Khuyên dùng - giao diện trực quan)
1. Truy cập [supabase.com](https://supabase.com) và tạo tài khoản miễn phí.
2. Bấm **New Project**, chọn Organization, đặt tên project (ví dụ: `aer-db`), nhập mật khẩu Database.
3. Chọn Region gần nhất (ví dụ: `Singapore (ap-southeast-1)`).
4. Sau khi tạo xong, vào menu **Database** > **Extensions** > tìm `vector` và bật (Enable).
5. Vào **Project Settings** > **Database** > mục **Connection string**:
   - Chọn tab **URI** (hoặc Mode: **Session** hoặc **Transaction**).
   - Chuỗi kết nối có dạng:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres
     ```
   - **Lưu ý quan trọng**: Với SQLAlchemy AsyncPG, đổi tiền tố `postgresql://` thành `postgresql+asyncpg://`. Ví dụ:
     ```
     postgresql+asyncpg://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres
     ```

### Lựa chọn B: Neon (Serverless Postgres)
1. Truy cập [neon.tech](https://neon.tech) và tạo project miễn phí.
2. Extension `pgvector` đã được Neon cài sẵn.
3. Lấy Connection string dạng `postgresql://...` và đổi thành `postgresql+asyncpg://...` kèm `?ssl=require`.

---

## BƯỚC 2: Chạy Migration & Seed Dữ Liệu Ban Đầu

Bạn có thể chạy migration và seed dữ liệu trực tiếp từ máy local lên Cloud DB trước khi deploy backend:

Mở PowerShell tại thư mục gốc dự án:

```powershell
# 1. Đặt biến DATABASE_URL trỏ tới Cloud DB vừa tạo
$env:DATABASE_URL = "postgresql+asyncpg://postgres:[PASSWORD]@[HOST]:5432/postgres"

# 2. Chuyển vào thư mục apps/api
cd apps/api

# 3. Chạy migration tạo bảng và extension pgvector
py -3.13 -m alembic upgrade head

# 4. Seed dữ liệu quy chế ban đầu (actors, courses, documents, chunks)
# Đảm bảo bạn đã có GEMINI_API_KEY trong môi trường nếu AI_MODE=gemini
$env:AI_MODE = "gemini"
$env:GEMINI_API_KEY = "AQ.Ab8R..." # API key của bạn
$env:GEMINI_CHAT_MODEL = "gemini-2.5-flash"
$env:GEMINI_EMBED_MODEL = "gemini-embedding-001"
$env:EMBEDDING_DIMENSIONS = "768"

py -3.13 -m app.db.seed

cd ../..
```

*(Lưu ý: Dockerfile của backend cũng đã được thiết lập tự động chạy `alembic upgrade head` mỗi khi khởi động container).*

---

## BƯỚC 3: Deploy Backend Lên Render.com

1. Đẩy mã nguồn của bạn lên một repository trên **GitHub** (hoặc GitLab).
2. Đăng nhập [render.com](https://render.com).
3. Bấm **New +** > chọn **Web Service**.
4. Kết nối tới GitHub repository của bạn.
5. Cấu hình Web Service:
   - **Name**: `academic-escalation-referee-api` (hoặc tên tùy chọn)
   - **Region**: `Singapore` (nên cùng region với database ở Bước 1)
   - **Language**: Chọn **Docker**
   - **Docker Context**: `.` (thư mục gốc)
   - **Dockerfile Path**: `apps/api/Dockerfile`
   - **Instance Type**: `Free`
6. Cuộn xuống phần **Environment Variables**, thêm các biến sau:

| Tên biến | Giá trị |
|---|---|
| `APP_ENV` | `production` |
| `AI_MODE` | `gemini` |
| `GEMINI_API_KEY` | *(Điền Gemini API Key của bạn)* |
| `GEMINI_CHAT_MODEL` | `gemini-2.5-flash` |
| `GEMINI_EMBED_MODEL` | `gemini-embedding-001` |
| `EMBEDDING_DIMENSIONS` | `768` |
| `AI_REQUEST_TIMEOUT_SECONDS` | `60` |
| `PROMPT_VERSION` | `referee-v2` |
| `DATABASE_URL` | *(Connection string từ Bước 1, có tiền tố `postgresql+asyncpg://`)* |
| `CORS_ORIGINS` | `https://*.vercel.app,http://localhost:5173` |

7. Bấm **Create Web Service**. Render sẽ bắt đầu build Docker container.
8. Sau khi build thành công, copy URL public của backend, ví dụ:
   ```
   https://academic-escalation-referee-api.onrender.com
   ```
9. Kiểm tra nhanh bằng cách mở trình duyệt truy cập:
   - `https://<your-backend-url>/health` ➔ Trả về `{"status":"ok"}`
   - `https://<your-backend-url>/health/ai` ➔ Trả về thông tin model Gemini

---

## BƯỚC 4: Deploy Frontend Lên Vercel

1. Đăng nhập [vercel.com](https://vercel.com).
2. Bấm **Add New...** > **Project**.
3. Import repository GitHub của bạn.
4. Cấu hình dự án (Project Configuration):
   - **Framework Preset**: Chọn **Vite**
   - **Root Directory**: Bấm Edit và chọn thư mục **`apps/web`**
   - **Build Command**: `npm run build` (mặc định)
   - **Output Directory**: `dist` (mặc định)
5. Mở mục **Environment Variables**, thêm biến môi trường kết nối API:

| Tên biến | Giá trị |
|---|---|
| `VITE_API_BASE_URL` | `https://<your-backend-url>` (URL backend Render ở Bước 3, không có dấu `/` ở cuối) |

*(Ví dụ: `https://academic-escalation-referee-api.onrender.com`)*

6. Bấm **Deploy**. Vercel sẽ tự động cài đặt dependencies, build Vite SPA và phân phối lên CDN toàn cầu trong vòng chưa đầy 1 phút.
7. Vercel sẽ cung cấp domain chính thức, ví dụ:
   ```
   https://academic-escalation-referee-web.vercel.app
   ```

---

## BƯỚC 5: Kiểm Tra Hoạt Động (Smoke Test)

1. Mở trang web Vercel: `https://<your-app>.vercel.app/student`.
2. Quan sát góc dưới thanh Sidebar: biểu tượng trạng thái hiển thị màu xanh lá (`Gemini · CO3001`).
3. Gửi câu hỏi kiểm tra:
   - **Câu hỏi**: *"Một nhóm đồ án được có bao nhiêu thành viên?"*
   - **Kết quả**: Hệ thống xử lý qua RAG, trích dẫn văn bản `[C1]` và trả lời trực tiếp mà không cần chuyển tiếp cho giảng viên.
4. Kiểm tra trang **Audit** và **Lecturer** để đảm bảo ghi nhận log đầy đủ.

---

## Xử Lý Sự Cố (Troubleshooting)

- **Lỗi CORS**: Backend đã cấu hình `allow_origin_regex=r"https://.*\.vercel\.app"` nên tất cả domain chính thức và preview URL của Vercel đều được chấp nhận tự động. Nếu bạn dùng custom domain riêng (ví dụ `myacademic.edu.vn`), hãy thêm domain đó vào biến `CORS_ORIGINS` trên Render.
- **Backend Render Sleep (Free Tier)**: Gói free của Render sẽ ngủ sau 15 phút không có request. Lần đầu truy cập sau khi ngủ có thể mất ~30-50s để thức dậy.
- **Lỗi pgvector**: Đảm bảo Supabase đã chạy lệnh `CREATE EXTENSION IF NOT EXISTS vector;` trước khi chạy migration Alembic.
