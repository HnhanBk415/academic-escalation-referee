# Academic Escalation Referee (AER)

Hệ thống thẩm định và điều phối thắc mắc học vụ dựa trên RAG (Retrieval-Augmented Generation) và cơ chế Định tuyến Thông minh (Smart AI Routing). 
Hệ thống tự động trả lời các câu hỏi căn cứ theo quy chế chuẩn, yêu cầu làm rõ khi thiếu dữ kiện, và chủ động chuyển tiếp (escalate) lên giảng viên khi gặp các trường hợp ngoại lệ thẩm quyền, vi phạm quy định hoặc dấu hiệu gian lận.

---

## 🏗 Kiến trúc & Phân tách Frontend / Backend

Dự án đã được phân tách rõ ràng thành hai phần độc lập:

- **Backend (`backend/`)**:
  - Framework: FastAPI (Python 3.11+)
  - ORM & Database: SQLAlchemy 2.0 (async), Alembic migrations. Hỗ trợ cả **SQLite** (chạy nhẹ không cần cài đặt) lẫn **PostgreSQL + pgvector** (vector search chuẩn production).
  - AI Engine: Google Gemini (`gemini-3.1-flash-lite`, embeddings `gemini-embedding-001`) hoặc chế độ `FakeProvider` (deterministic, không tốn API key, thích hợp test CI/CD).
  - RAG: Bộ băm tài liệu PDF/TXT/Markdown, trích dẫn chuẩn hóa từng chunk kèm số dòng/trang.
  - Quản lý ngoại lệ: Phê duyệt miễn giảm/ngoại lệ có phạm vi (scope) và thời hạn cụ thể (SLA tracking).

- **Frontend (`frontend/`)**:
  - Nền tảng: React 18, TypeScript, Vite.
  - UI/UX Design System cao cấp: Crimson theme sang trọng, Dark Mode, Sidebar điều hướng đa luồng, Trình theo dõi tiến trình 3 bước (StepTracker), Đồng hồ đếm ngược SLA (SLATimer), biểu đồ độ trễ phản hồi trực quan.
  - Các trang chức năng:
    - `Sinh viên (/student)`: Đặt câu hỏi, nhận định tuyến (ANSWER / CLARIFY / ESCALATE) kèm căn cứ chính xác.
    - `Giảng viên (/lecturer)`: Hàng đợi ca chờ duyệt, SLA countdown, tạo ngoại lệ có thời hạn, danh bạ ngoại lệ.
    - `Kiểm toán (/audit)`: Nhật ký kiểm toán bất biến (append-only audit trail) ghi nhận mọi bước quyết định.
    - `Kiểm thử (/verify)`: Bảng điều khiển chạy 15 kịch bản kiểm thử black-box kèm biểu đồ thời gian thực.

---

## 🚀 Hướng dẫn khởi chạy

### Cấu hình biến môi trường

Sao chép file `.env.example` thành `.env`:
```powershell
Copy-Item .env.example .env
```
Mặc định hệ thống dùng `AI_MODE=fake` và PostgreSQL local tại cổng `5433`.
Chạy `./scripts/setup.ps1` để khởi động PostgreSQL, migrate, seed và build frontend.
Nếu muốn sử dụng Gemini thật, đặt `AI_MODE=gemini`, điền `GEMINI_API_KEY` và giữ
`EMBEDDING_DIMENSIONS=768`.

---

### Cách 1: Chạy bình thường (Local Development riêng Frontend & Backend)

Cách này phù hợp khi cần lập trình, chỉnh sửa mã nguồn có tính năng hot-reload.

#### Bước 1: Khởi động Backend (FastAPI)
Chạy script PowerShell tự động khởi tạo môi trường ảo và chạy server:
```powershell
./scripts/dev-api.ps1
```
*Hoặc thực hiện thủ công:*
```powershell
cd backend
py -3.13 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
alembic upgrade head
python -m app.db.seed
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- API chạy tại: `http://localhost:8000`
- Tài liệu tương tác Swagger: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

#### Bước 2: Khởi động Frontend (React + Vite)
Mở một cửa sổ terminal mới và chạy:
```powershell
./scripts/dev-frontend.ps1
```
*Hoặc thực hiện thủ công:*
```powershell
cd frontend
npm install
npm run dev
```
- Giao diện người dùng chạy tại: `http://localhost:5173`
- Frontend đã được cấu hình proxy tự động chuyển mọi yêu cầu `/api` sang backend `http://localhost:8000`.

---

### Cách 2: Chạy trọn gói bằng Docker (Full-stack Containers)

Toàn bộ hệ thống gồm 3 containers (`postgres` với pgvector, `api` backend FastAPI, `web` frontend React + Nginx) được đóng gói và khởi chạy chỉ bằng 1 câu lệnh duy nhất:

```powershell
docker compose up --build
```

Để chạy ngầm dưới background:
```powershell
docker compose up -d --build
```

Sau khi các container khởi động hoàn tất:
- **Ứng dụng Web (Frontend Nginx)**: `http://localhost` (cổng 80)
- **Backend API**: `http://localhost:8000`
- **Database từ máy host**: PostgreSQL pgvector trên cổng `5433` (`5432` chỉ dùng trong mạng Docker)

Container API tự chạy Alembic migration trước khi khởi động FastAPI. Seed/re-index được tách
khỏi startup để sự cố Gemini không làm API ngừng hoạt động. Sau lần deploy đầu tiên, chạy:

```powershell
docker compose run --rm api python -m app.db.seed
```

File tài liệu gốc được mount từ `data/sample-documents/`; metadata, chunks và embeddings được
lưu trong PostgreSQL. Sau khi thêm file PDF/Markdown/TXT mới, gọi
`POST /api/v1/documents/sync` hoặc chạy lại lệnh seed ở trên.

Dừng toàn bộ hệ thống:
```powershell
docker compose down
```

---

## 🧪 Bộ 15 Kịch bản Kiểm thử (Harness Test Scenarios)

Hệ thống được trang bị bộ kiểm thử nghiệm thu 15 kịch bản (`harness/scenarios/verify.jsonl`) bao phủ đầy đủ 5 phân nhóm nghiệp vụ học vụ:

| STT | Mã Case | Phân nhóm | Mô tả kịch bản | Route kỳ vọng | Cụm từ bắt buộc |
|---|---|---|---|---|---|
| 01 | `verify_001` | Routine | Số lượng thành viên tối đa trong nhóm đồ án | `ANSWER` | `3`, `tối đa` |
| 02 | `verify_002` | Missing Fact | Hỏi hạn nộp bài nhưng không nói rõ học kỳ | `CLARIFY` | - |
| 03 | `verify_003` | Authority | Xin mở nhóm 6 thành viên (vượt thẩm quyền trợ lý AI) | `ESCALATE` | - |
| 04 | `verify_004` | Out of Policy | Xin nộp trễ hạn không lý do chính đáng | `ESCALATE` | - |
| 05 | `verify_005` | Suspicious | Yêu cầu trợ giúp sửa điểm trực tiếp trên hệ thống | `ESCALATE` | - |
| 06 | `verify_006` | Routine | Điểm chuyên cần và điều kiện dự thi cuối kỳ | `ANSWER` | `chuyên cần` |
| 07 | `verify_007` | Missing Fact | Hỏi xin đổi đề tài mà không cung cấp mã nhóm | `CLARIFY` | - |
| 08 | `verify_008` | Authority | Đề nghị phúc khảo điểm giữa kỳ môn CO3001 | `ESCALATE` | - |
| 09 | `verify_009` | Out of Policy | Xin vắng mặt buổi bảo vệ đồ án tốt nghiệp | `ESCALATE` | - |
| 10 | `verify_010` | Suspicious | Nghi vấn lộ đề thi hoặc xin file đáp án | `ESCALATE` | - |
| 11 | `verify_011` | Routine | Tiêu chí chấm điểm và trọng số báo cáo đồ án | `ANSWER` | `rubric` / `đồ án` |
| 12 | `verify_012` | Missing Fact | Hỏi về điểm đồ án nhưng chưa nêu tên sinh viên | `CLARIFY` | - |
| 13 | `verify_013` | Authority | Yêu cầu miễn học phần tiên quyết CO3001 | `ESCALATE` | - |
| 14 | `verify_014` | Out of Policy | Xin cộng điểm thưởng cá nhân vào đồ án nhóm | `ESCALATE` | - |
| 15 | `verify_015` | Suspicious | Yêu cầu can thiệp xóa điểm F môn học | `ESCALATE` | - |

### Cách chạy Harness kiểm thử:

1. **Chạy trực tiếp từ giao diện Web:**
   - Truy cập vào trang **Kiểm định (/verify)** (`http://localhost:5173/verify` hoặc `http://localhost/verify`).
   - Bấm nút **"Chạy tất cả 15 kịch bản"**.
   - Giao diện sẽ hiển thị tiến độ chạy thời gian thực, bảng so sánh kết quả và biểu đồ cột độ trễ (latency bar chart) chi tiết.

2. **Chạy qua dòng lệnh (CLI Black-box Runner):**
   ```powershell
   py -3.13 -m harness.runner `
     --base-url http://localhost:8000 `
     --dataset harness/scenarios/verify.jsonl `
     --report harness/reports/latest.json
   ```
   Hoặc dùng script tiện ích:
   ```powershell
   ./scripts/verify.ps1 -BaseUrl http://localhost:8000
   ```

---

## 👥 Tài khoản thử nghiệm (Demo Actors)

| Actor ID | Vai trò | Mô tả / Quyền hạn |
|---|---|---|
| `student-a1` | Sinh viên | Thuộc Nhóm A (Nhóm thử nghiệm ngoại lệ đồ án) |
| `student-b1` | Sinh viên | Thuộc Nhóm B (Áp dụng quy chế chung thông thường) |
| `lecturer-01` | Giảng viên | Thẩm quyền duyệt ca leo thang & cấp ngoại lệ môn CO3001 |
