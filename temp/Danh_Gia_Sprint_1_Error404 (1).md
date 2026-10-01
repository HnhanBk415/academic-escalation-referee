# ĐÁNH GIÁ KỸ THUẬT SPRINT 1 — BAN GIÁM KHẢO HACKATHON

---

# Team Error404 (Dự án: Academic Escalation Referee - AER)

---

## 1. What the Team Built

Nhóm **Error404** xây dựng **Academic Escalation Referee (AER)** — hệ thống phần mềm doanh nghiệp thẩm định và điều phối giải đáp thắc mắc học vụ đại học dựa trên RAG (Retrieval-Augmented Generation) kết hợp cơ chế định tuyến thông minh (Smart AI Routing):
* **Định tuyến 3 nhánh quyết định**:
  * **ANSWER**: Tự động trả lời thắc mắc của sinh viên dựa trên trích dẫn điều khoản chính xác từ quy chế trường.
  * **CLARIFY (U1)**: Tự động yêu cầu sinh viên cung cấp thêm thông tin minh chứng khi thiếu dữ kiện.
  * **ESCALATE (U2/U3)**: Chuyển tiếp lên giảng viên/ban chủ nhiệm khoa khi gặp trường hợp vượt thẩm quyền, vi phạm quy định hoặc đơn xin miễn giảm có điều kiện.
* **Giao diện đa phân hệ**: Ứng dụng React 18 / TypeScript với thanh điều hướng đa vai trò (Sinh viên, Giảng viên, Nhật ký kiểm toán, Bảng điều khiển kiểm thử Verify 15 ca).
* **Quản lý ngoại lệ có thời hạn (Exception Lifecycle with SLA Tracking)**: Hỗ trợ giảng viên phê duyệt ngoại lệ có phạm vi, gắn đồng hồ đếm ngược SLA và ghi nhận nhật ký kiểm toán bất biến (append-only audit log).

---

## 2. Architecture

Kiến trúc thành phần chuẩn mực theo mô hình Client-Server:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ React 18 + TypeScript + Vite Frontend (Nginx Container)                                │
│   ├── Sinh viên (/student)    (Gửi thắc mắc, xem trích dẫn quy chế, nhận định tuyến)   │
│   ├── Giảng viên (/lecturer)  (Hàng đợi ca chờ duyệt, đồng hồ SLA, cấp ngoại lệ)       │
│   ├── Kiểm toán (/audit)      (Nhật ký quyết định bất biến và timeline xử lý)          │
│   └── Kiểm thử (/verify)      (Bảng điều khiển chạy tự động 15 kịch bản benchmark)     │
└──────────────────────────┬──────────────────────────────────────────────────────────────┘
                           │ REST API (X-Request-ID, CORS)
                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ FastAPI Backend Application                                                             │
│   ├── Ingestion & RAG          (Băm văn bản quy chế, vector search qua pgvector)        │
│   ├── Pluggable AI Engine      (Gemini 3.1 Flash-Lite / FakeProvider cho CI/CD)         │
│   ├── Exception Service        (Quản lý ngoại lệ có phạm vi và kiểm soát hạn SLA)       │
│   └── Async SQLAlchemy ORM     (Alembic migrations, quản lý phiên làm việc async)       │
└──────────────────────────┬──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ PostgreSQL 16 + pgvector Database                                                       │
│   ├── Embeddings Vector Data   (Kho vector tri thức phục vụ tìm kiếm ngữ nghĩa)         │
│   └── Relational Entities      (Bảng Questions, Cases, Exceptions, AuditLogs)           │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. What Works Well (Concrete Strengths)

1. **Kiến trúc Phần mềm Doanh nghiệp Chuẩn mực (Verified)**:
   * Mã nguồn Backend được phân tầng rõ rệt: `api/`, `core/`, `models/`, `schemas/` (Pydantic V2), `services/`, `rag/`, `db/`. Có cơ chế Dependency Injection, async SQLAlchemy 2.0 và Alembic migration bài bản.
2. **Cơ chế Pluggable AI Provider Xuất Sắc (Verified)**:
   * Tại [`backend/app/ai/factory.py`](team_repos/Error404/backend/app/ai/factory.py), nhóm xây dựng `build_ai_provider` hỗ trợ cả `GeminiProvider` lẫn `FakeProvider`. `FakeProvider` cho phép chạy toàn bộ hệ thống và 15 ca kiểm thử Verify một cách tất định mà không tốn quota hay lo ngại rớt mạng trong lúc demo.
3. **Frontend Chuyên nghiệp & Tính năng Quản lý SLA (Verified)**:
   * Giao diện React/TypeScript hoàn thiện cao: Dark mode, StepTracker trực quan, đồng hồ đếm ngược SLA cho ca thẩm định, và trang Verify 15 ca có biểu đồ thời gian thực.
4. **Đóng gói Docker Compose Hoàn Chỉnh (Verified)**:
   * File `docker-compose.yml` gồm đủ 3 container (`postgres` với pgvector, `api` FastAPI, `web` Nginx) kèm đầy đủ healthchecks và volumes lưu trữ dữ liệu.
5. **Định danh Truy vết Yêu cầu (Request ID Tracing) (Verified)**:
   * Middleware trong [`main.py:43-48`](team_repos/Error404/backend/app/main.py#L43-L48) tự động cấp và truyền `X-Request-ID` xuyên suốt từ client đến server, phục vụ việc đối chiếu log kiểm toán rất chuyên nghiệp.

---

## 4. Critical Problems

### Problem 1: Ràng Buộc Cứng Số Chiều Embedding Có Thể Gây Lỗi Khởi Động Khi Đổi Model
* **Evidence (VERIFIED)**:
  * Trong [`backend/app/main.py:20-22`](team_repos/Error404/backend/app/main.py#L20-L22):
    ```python
    if settings.embedding_dimensions != 768:
        raise RuntimeError("EMBEDDING_DIMENSIONS must be 768 for this index")
    ```
* **Why it matters**: Hệ thống đang gắn cứng (hardcode) số chiều vector là 768 (tương ứng với `gemini-embedding-001`). Nếu nhóm hoặc đơn vị triển khai chuyển sang model embedding khác (như OpenAI `text-embedding-3-small` 1536 chiều, hoặc mô hình tiếng Việt BGE/PhoBERT), server sẽ ném ngoại lệ dừng khởi động ngay lập tức.
* **Impact**: Giảm tính linh hoạt và khả năng tương thích của tầng RAG.
* **Recommended fix**: Cấu hình số chiều vector động theo model embedding được khai báo trong biến môi trường và tạo migration tương ứng.
* **Priority**: **P2**

---

### Problem 2: Rủi Ro Giới Hạn Quota Gemini Miễn Phí (Rate Limit 15 RPM)
* **Evidence (INFERRED)**: Khi sử dụng `AI_MODE=gemini` với model `gemini-3.1-flash-lite`, gói miễn phí có giới hạn 15 requests/phút.
* **Why it matters**: Khi ban giám khảo hoặc người dùng bấm chạy toàn bộ 15 kịch bản trên trang `/verify`, hệ thống sẽ gửi 15 yêu cầu trích xuất và embedding liên tiếp trong vài giây, dễ dẫn đến mã lỗi HTTP 429 (Resource Exhausted).
* **Impact**: Gây lỗi gián đoạn bài kiểm thử nếu chạy ở chế độ live API.
* **Recommended fix**: Thêm cơ chế Rate Limiter / Exponential Backoff khi gọi Google Gemini API, hoặc khuyến nghị giám khảo sử dụng `AI_MODE=fake` khi chạy hàng loạt.
* **Priority**: **P1**

---

## 5. Crash / Failure Risks

| Failure Mode | Trigger | Impact | Severity | Fix |
| ------------ | ------- | ------ | -------- | --- |
| **Lỗi HTTP 429 từ Gemini API** | Bấm chạy đồng thời nhiều ca trên trang Verify ở chế độ `AI_MODE=gemini`. | Quá trình kiểm thử bị đứt đoạn, API trả về lỗi ngoại lệ. | **High** | Thêm cơ chế retry có giãn cách và ưu tiên chạy `FakeProvider` khi chấm hàng loạt. |
| **Lỗi nạp thư viện pgvector trên SQLite** | Cấu hình chạy SQLite mà chưa tắt tính năng vector search. | Ngoại lệ cơ sở dữ liệu không hỗ trợ toán tử vector `<=>`. | **Medium** | Tách riêng chiến lược tìm kiếm Text Search (BM25) khi chạy trên SQLite. |
| **Không tải được danh mục quy chế** | Khởi động container mà chưa chạy lệnh ingest tài liệu ban đầu. | RAG không tìm thấy văn bản tham chiếu, toàn bộ câu hỏi đều bị đẩy vào CLARIFY. | **Medium** | Tự động kiểm tra và ingest seed data quy chế ngay trong script khởi động container. |

---

## 6. Pipeline Analysis

```text
CURRENT PIPELINE (Chuẩn mực & Tách lớp rành mạch):
[Sinh viên gửi thắc mắc trên Web (/student)]
       │
       ▼
[FastAPI Backend tiếp nhận + Gán X-Request-ID]
       │
       ▼
[RAG Engine: Tạo embedding câu hỏi & Tìm kiếm đoạn quy chế liên quan qua pgvector]
       │
       ▼
[Referee Service: Đối chiếu ngoại lệ hiện hành + Gọi AI Provider (Gemini / Fake)]
       │
       ▼
[Phân định 3 nhánh: ANSWER (kèm trích dẫn) / CLARIFY (yêu cầu thêm) / ESCALATE (chuyển GV)]
       │
       ▼
[Ghi bản ghi kiểm toán AuditLog bất biến vào PostgreSQL]
       │
       ▼
[Trả về kết quả cho Frontend hiển thị StepTracker và SLA countdown]
```

---

## 7. Code / Repository Issues

* Mã nguồn rất sạch sẽ, tuân thủ chặt chẽ tiêu chuẩn PEP 8, có cấu hình type-checking bằng `pyright` và linting bằng `ruff`.
* File README rất chi tiết, có kèm cả script tự động hóa PowerShell cho Windows.

---

## 8. Database / API / Integration Issues

* Thiết kế cơ sở dữ liệu với PostgreSQL và pgvector rất tốt, hỗ trợ tìm kiếm ngữ nghĩa tốc độ cao.
* API tuân thủ chuẩn RESTful, có schema Pydantic V2 kiểm soát chặt chẽ dữ liệu đầu vào và đầu ra.

---

## 9. Security Issues

* Có middleware cấu hình CORS linh hoạt.
* Hệ thống đang dùng persona giả lập (Student/Lecturer) để demo chuyển đổi vai trò. Khi đưa vào production thực tế cần tích hợp chuẩn đăng nhập SSO của trường đại học (CAS/OAuth2).

---

## 10. Deployment / DevOps Issues

* `docker-compose.yml` hoàn chỉnh, có healthcheck cho các service, việc khởi chạy chỉ gói gọn trong 1 câu lệnh `docker compose up`.

---

## 11. Testing Gaps

* Bộ kiểm thử Verify 15 ca trên giao diện rất trực quan. Cần bổ sung thêm các unit test tự động bằng `pytest` trong backend để tích hợp vào luồng CI/CD (GitHub Actions).

---

## 12. Recommended Improvements

| Priority | Thành phần | Hành động cụ thể | Lợi ích mang lại |
| -------- | ---------- | ---------------- | ---------------- |
| **P1** | **AI Integration** | Thêm cơ chế Rate Limiter và Retry Backoff khi gọi Gemini API. | Loại bỏ rủi ro lỗi 429 khi chạy hàng loạt ca kiểm thử. |
| **P2** | **RAG Engine** | Bổ sung Hybrid Search (kết hợp Full-Text Search và Vector Search). | Tăng độ chính xác khi tìm kiếm các mã điều khoản cụ thể. |
| **P2** | **DevOps** | Tự động hóa việc seed dữ liệu quy chế khi dựng container lần đầu. | Đảm bảo hệ thống có sẵn dữ liệu tri thức ngay khi vừa khởi chạy. |

---

## 13. Sprint 2 Action Plan

### P1 — Should Fix
1. Thêm cơ chế xử lý lỗi hạn mức (Rate limit handling) cho Gemini API.
2. Tích hợp kịch bản tự động nạp kho tài liệu mẫu (`ingest_dadn_documents.py`) vào entrypoint của container API.

### P2 — Improvement
1. Bổ sung các bài test tự động `pytest` cho backend.
2. Hoàn thiện tính năng export báo cáo kiểm toán định dạng PDF/Excel cho ban giám hiệu.

---

## 14. Reviewer Conclusion

* **Current System State**: Error404 sở hữu một trong những hệ thống có kiến trúc kỹ thuật và giao diện người dùng hoàn thiện và chuyên nghiệp nhất trong đợt đánh giá Sprint 1.
* **Most Important Strength**: Thiết kế phân lớp bài bản, hỗ trợ cả Gemini thật lẫn `FakeProvider` phục vụ demo an toàn tuyệt đối, đóng gói Docker Compose hoàn hảo.
* **Most Important Technical Risk**: Khả năng chạm trần rate-limit của Gemini API khi chạy kiểm thử dồn dập.
* **Most Important Next Action**: Bổ sung bộ đệm xử lý rate-limit và tự động hóa khâu seed dữ liệu văn bản vào container.
