<div align="center">

# ⚖️ Academic Escalation Referee

**Tác tử AI xử lý câu hỏi quy chế học phần — tự trả lời ca thường quy, biết chính xác khi nào phải dừng để hỏi con người.**

*MLAI Hackathon 2026 · Bảng 1 – OrganizationAI · Track A: The Escalation Referee · Đội Error404*

[![Quality checks](https://github.com/HnhanBk415/academic-escalation-referee/actions/workflows/quality.yml/badge.svg)](https://github.com/HnhanBk415/academic-escalation-referee/actions/workflows/quality.yml)
![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-pgvector-4169E1?logo=postgresql&logoColor=white)
![Gemini](https://img.shields.io/badge/Google-Gemini-8E75B2?logo=googlegemini&logoColor=white)

<!-- TODO: điền link thật trước khi nộp -->
[**🌐 Live demo**](#) · [**🎬 Video demo (3 phút)**](#) · [**✅ Verify harness**](#-verify-harness) · [**🛠️ Runbook**](#-chạy-local) · [**📖 Tài liệu kỹ thuật**](PROJECT_OVERVIEW.md)

</div>

---

> [!TIP]
> **Giám khảo — kiểm tra nhanh 90 giây:** mở Live demo → chọn **Kiểm chứng hệ thống (Verify)** → bấm **Chạy**.
> Bảng kết quả hiển thị từng ca: route mong đợi và route thực tế (**tự động trả lời** hay **chuyển tiếp** giảng viên),
> PASS/FAIL, độ trễ và tỷ lệ chuyển tiếp thừa / bỏ sót. Sau đó vào **Hỏi đáp** để nhập một ca mới bất kỳ.

## Mục lục

- [Vấn đề](#-vấn-đề)
- [Giải pháp](#-giải-pháp)
- [Khi nào tác tử dừng lại?](#-khi-nào-tác-tử-dừng-lại)
- [Con người giữ quyền quyết định ở đâu](#-con-người-giữ-quyền-quyết-định-ở-đâu)
- [Tính năng](#-tính-năng)
- [Kiến trúc](#-kiến-trúc)
- [Chạy local](#-chạy-local)
- [Verify harness](#-verify-harness)
- [Kiểm thử & CI](#-kiểm-thử--ci)
- [Cấu hình](#%EF%B8%8F-cấu-hình)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Dữ liệu: thật và giả lập](#-dữ-liệu-thật-và-giả-lập)
- [Giới hạn đã biết](#%EF%B8%8F-giới-hạn-đã-biết)
- [Đội ngũ](#-đội-ngũ)

## 🎯 Vấn đề

Mỗi học kỳ, giảng viên phụ trách đồ án nhận hàng trăm câu hỏi lặp lại từ sinh viên: *nhóm được mấy người,
rubric chia điểm ra sao, có được dùng AI không…* Câu trả lời đã nằm sẵn trong quy chế, nhưng vẫn phải có người
trả lời thủ công. Ngược lại, những yêu cầu **thật sự cần người quyết** — xin ngoại lệ, phúc khảo, nộp trễ —
lại lẫn trong cùng hộp thư, không có hạn xử lý, và không ai truy lại được hồ sơ đã đi đâu.

Chatbot hỏi–đáp thông thường không giải quyết được điều này: nó **trả lời cả những câu không được phép tự trả lời**,
và khi sai thì không ai chịu trách nhiệm.

## 💡 Giải pháp

AER là một **trọng tài phân luồng**: đọc câu hỏi, tra cứu quy chế học phần (RAG) cùng các ngoại lệ đã được duyệt,
rồi đưa ra **đúng một** trong các quyết định sau — kèm lý do có cấu trúc và trích dẫn điều khoản:

| Route | Khi nào | Kết quả cho sinh viên |
|---|---|---|
| ✅ `ANSWER` | Quy chế trả lời trực tiếp, có điều kiện, hoặc có ngoại lệ đã duyệt áp dụng | Câu trả lời + trích dẫn nguyên văn từ tài liệu |
| ❓ `CLARIFY` | Thiếu dữ kiện mà sinh viên có thể bổ sung | Một câu hỏi làm rõ cụ thể |
| ⚡ `ESCALATE` | Ngoài phạm vi quy chế, hoặc vượt thẩm quyền của tác tử | Hồ sơ chuyển giảng viên, có SLA 48 giờ |
| 🚫 `REJECT` | Đầu vào bị gắn cờ nghi vấn (prompt injection, yêu cầu gian lận) | Từ chối, **không** đưa ra kết quả khẳng định |

Hai nguyên tắc thiết kế xuyên suốt:

1. **Không chuyển tiếp quá mức** — ca thường quy được xử lý tự động hoàn toàn; Verify đo cả tỷ lệ chuyển tiếp thừa.
2. **Không bao giờ đoán bừa** — đầu vào nghi vấn, bằng chứng mâu thuẫn hoặc AI không khả dụng đều không dẫn tới câu trả lời khẳng định.

## 🚦 Khi nào tác tử dừng lại?

Đề bài yêu cầu phân loại mức độ không chắc chắn thành ba nhóm. AER ánh xạ mỗi nhóm sang một cách dừng khác nhau
(trường `uncertainty_type` trong mỗi quyết định):

| Nhóm không chắc chắn | `uncertainty_type` | Cách dừng | Ví dụ |
|---|---|---|---|
| Chưa xác định được thông tin thực tế | `MISSING_FACT` | Hỏi lại **sinh viên** | *"Trường hợp này có được không?"* → hỏi rõ tình huống/quy định đang hỏi |
| Nằm ngoài phạm vi quy định | `OUT_OF_POLICY` | Chuyển **giảng viên** | *"Ký túc xá đóng cửa lúc mấy giờ?"* |
| Vượt thẩm quyền, cần con người phê duyệt | `AUTHORITY_REQUIRED` | Chuyển **giảng viên** | *"Nhóm em xin phép có 6 thành viên được không?"* (quy chế: 3–5) |

Khi chuyển tiếp, tác tử sinh `decision_question` — **một câu hỏi người duyệt có thể trả lời ngay** mà không cần
mở lại hồ sơ gốc (nêu rõ quy định hiện hành, yêu cầu của sinh viên và điều cần quyết), kèm `ai_summary` và bằng chứng trích dẫn.

## 👤 Con người giữ quyền quyết định ở đâu

```mermaid
flowchart LR
    S["🎓 Sinh viên<br/>đặt câu hỏi"] --> AI{"⚖️ AER<br/>RAG + Gemini"}
    AI -->|ANSWER| A["Trả lời + trích dẫn"]
    AI -->|CLARIFY| C["Hỏi lại sinh viên"] --> S
    AI -->|REJECT| R["Từ chối"]
    AI -->|ESCALATE| L["👨‍🏫 Giảng viên<br/>quyết định"]
    L -->|APPROVED + ngoại lệ có phạm vi| E["Ngoại lệ<br/>sinh viên / nhóm / môn"]
    L -->|NEED_MORE_INFO| S
    L -->|FORWARDED| P["🏛️ Phòng Đào tạo"]
    E -.->|áp dụng cho câu hỏi sau| AI
    A & C & R & L & E --> T[("📝 Audit trail<br/>chỉ ghi thêm")]
```

- **AI không bao giờ tự cấp ngoại lệ.** Chỉ giảng viên mới tạo được ngoại lệ, và ngoại lệ luôn có phạm vi
  (`STUDENT` / `GROUP` / `COURSE`), chủ đề quy chế và thời hạn hiệu lực. Ngoại lệ của nhóm A không rò sang nhóm B.
- **Con người có thể dừng và hoàn tác:** thu hồi ngoại lệ, yêu cầu bổ sung thông tin, chuyển cấp, huỷ hồ sơ.
- **Mọi hành động đều truy vết được:** ai làm, lúc nào, đầu vào gì, lý do gì, model và prompt version nào — xuyên suốt bằng request ID.

## ✨ Tính năng

| Vai trò | Có thể làm |
|---|---|
| 🎓 **Sinh viên** | Hỏi quy chế theo môn/nhóm · nhận câu trả lời kèm trích dẫn · trả lời câu hỏi làm rõ · theo dõi trạng thái hồ sơ |
| 👨‍🏫 **Giảng viên** | Hàng chờ thẩm định có đồng hồ SLA · phê duyệt / từ chối / yêu cầu thêm thông tin / chuyển cấp · tạo và thu hồi ngoại lệ có phạm vi |
| 🏛️ **Phòng Đào tạo** | Trung tâm vận hành (câu hỏi, hồ sơ, SLA quá hạn, ngoại lệ, tài liệu) · audit log toàn hệ thống · reset dữ liệu demo |
| 📄 **Quản lý quy chế** | Tải quy chế mới (PDF / DOCX / Markdown / ảnh scan qua Gemini Vision OCR) · người duyệt sửa đoạn OCR có độ tin cậy thấp · phát hiện xung đột với phiên bản cũ trước khi công bố · versioning theo ngày hiệu lực |

Điểm kỹ thuật đáng chú ý:

- **Hybrid RAG:** dense retrieval (pgvector HNSW, `gemini-embedding-001`) + keyword search tiếng Việt, hợp nhất bằng Reciprocal Rank Fusion.
- **Structured output:** Gemini trả về schema `RefereeDecision` được validate bằng Pydantic; trích dẫn phải trỏ tới chunk có thật.
- **Chịu lỗi:** rate limiter (sliding window), retry có jitter; khi AI không khả dụng, hệ thống chuyển tiếp thay vì đoán.
- **Idempotent decisions:** quyết định của giảng viên hỗ trợ header `Idempotency-Key`.
- **Fake AI provider tất định** để chạy test và Verify không cần API key.

## 🏗️ Kiến trúc

```mermaid
flowchart TB
    subgraph Web["Frontend · React + TypeScript (Vite) · Vercel / Nginx"]
        UI["Hỏi đáp · Hàng chờ · Ngoại lệ · Vận hành · Audit · Verify"]
    end
    subgraph API["Backend · FastAPI · Render / Docker"]
        R["API routes"] --> SV["Services<br/>questions · cases · exceptions · audit"]
        SV --> RAG["Hybrid RAG<br/>vector + keyword + RRF"]
        SV --> AIP["AI provider<br/>Gemini | Fake"]
        ING["Ingestion<br/>extract → chunk → embed · OCR review"] --> RAG
    end
    DB[("PostgreSQL 16 + pgvector")]
    G["Google Gemini<br/>chat · embedding · vision"]
    UI -- REST /api/v1 --> R
    SV & RAG & ING --> DB
    AIP & ING --> G
```

| Lớp | Công nghệ |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic Settings |
| AI | Google Gemini (`google-genai`) — chat, `gemini-embedding-001` (768 chiều), Vision OCR |
| Dữ liệu | PostgreSQL 16 + pgvector (SQLite + in-memory vector cho test) |
| Tài liệu | pypdf, PyMuPDF, python-docx, Pillow |
| Frontend | React, TypeScript, Vite, lucide-react, Vitest |
| Hạ tầng | Docker Compose, Nginx, Render (API), Vercel (web), GitHub Actions |

Chi tiết schema, module, API endpoint và enum: xem [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).

## 🚀 Chạy local

### Cách 1 — Docker Compose (khuyến nghị)

Yêu cầu: Docker + Docker Compose.

```bash
git clone https://github.com/HnhanBk415/academic-escalation-referee.git
cd academic-escalation-referee
cp .env.example .env
docker compose up -d --build
```

| Service | URL |
|---|---|
| Web | http://localhost |
| API | http://localhost:8000 (health: `/health`, `/health/ai`) |
| PostgreSQL | `localhost:5433` (user/pass/db: `aer`) |

Lần khởi động đầu, container API tự chạy migration, seed dữ liệu demo và ingest tài liệu quy chế mẫu.
Mặc định `AI_MODE=fake` — chạy được ngay, **không cần API key**. Để dùng Gemini thật, đặt
`AI_MODE=gemini` và `GEMINI_API_KEY=...` trong `.env`, rồi `docker compose up -d --build api`.

### Cách 2 — Chạy từng phần (phát triển)

Yêu cầu: Python 3.13, Node.js 22, Docker (cho PostgreSQL).

<details>
<summary><b>Windows (PowerShell)</b></summary>

```powershell
./scripts/setup.ps1          # tạo .env, bật PostgreSQL, cài deps, migrate, seed, build frontend
./scripts/dev-api.ps1        # API tại http://localhost:8000 (hot reload)
./scripts/dev-frontend.ps1   # Web tại http://localhost:5173 (proxy /api → :8000)
```

</details>

<details>
<summary><b>macOS / Linux</b></summary>

```bash
cp .env.example .env
docker compose up -d postgres

cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/alembic upgrade head
.venv/bin/python -m app.db.seed
.venv/bin/uvicorn app.main:app --reload --port 8000

# terminal khác
cd frontend
npm ci
npm run dev
```

</details>

Triển khai production (Render + Vercel, chế độ đăng nhập bằng mật khẩu): xem [DEPLOYMENT.md](DEPLOYMENT.md).

## ✅ Verify harness

Bộ kiểm chứng gọi **API thật** (black-box HTTP) và chấm từng ca theo route, đích chuyển tiếp, cụm từ bắt buộc /
cấm, tính hợp lệ của trích dẫn và schema phản hồi.

**Trên giao diện:** tab **Kiểm chứng hệ thống** → **Chạy** — một thao tác chạy tuần tự 16 ca trong
[`verify.jsonl`](harness/scenarios/verify.jsonl), hiển thị route mong đợi / thực tế, đạt/không đạt, độ trễ từng ca,
**tỷ lệ chuyển tiếp thừa** và **tỷ lệ bỏ sót chuyển tiếp**.

**Bằng dòng lệnh:**

```bash
python -m harness.runner --base-url http://localhost:8000          # chạy verify.jsonl + kiểm tra vòng đời ngoại lệ
python -m harness.runner --dataset harness/datasets/evaluation.jsonl --reset
```

Báo cáo JSON (kèm dấu thời gian từng ca) được ghi ra `harness/reports/latest.json`. Exit code khác 0 nếu có ca không đạt.

| Bộ dữ liệu | Số ca | Thành phần |
|---|---|---|
| [`harness/scenarios/verify.jsonl`](harness/scenarios/verify.jsonl) | 16 | 6 thường quy · 2 thiếu dữ kiện · 4 vượt thẩm quyền · 2 ngoài quy định · 2 nghi vấn |
| [`harness/datasets/evaluation.jsonl`](harness/datasets/evaluation.jsonl) | 20 | 6 thường quy · 4 thiếu dữ kiện · 4 vượt thẩm quyền · 4 ngoài quy định · 2 nghi vấn |

Ngoài các ca đơn lẻ, runner còn kiểm tra **vòng đời ngoại lệ end-to-end**: xin 6 thành viên → chuyển giảng viên →
giảng viên duyệt ngoại lệ cho nhóm A → nhóm A hỏi lại được trả lời theo ngoại lệ → nhóm B hỏi cùng câu vẫn bị chuyển
tiếp (cô lập phạm vi) → câu hỏi mơ hồ của nhóm A không bị áp ngoại lệ bừa.

## 🧪 Kiểm thử & CI

```bash
# Backend
cd backend
python -m ruff check .
python -m pytest -q

# Frontend
cd frontend
npm test
npm run build
```

GitHub Actions ([`quality.yml`](.github/workflows/quality.yml)) chạy trên mọi push và pull request:
lint + pytest (Python 3.13) → Vitest + build (Node 22) → `docker compose build`.

## ⚙️ Cấu hình

Toàn bộ biến môi trường nằm trong [`.env.example`](.env.example). Các biến quan trọng:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `AI_MODE` | `fake` | `fake` (tất định, không cần key) hoặc `gemini` |
| `GEMINI_API_KEY` | — | Bắt buộc khi `AI_MODE=gemini` |
| `GEMINI_VISION_API_KEY` | — | Key riêng cho OCR tài liệu scan |
| `AUTH_MODE` | `demo` | `demo` (chuyển vai trò tự do) hoặc `password` (Bearer token) — **production phải dùng `password`** |
| `DATABASE_URL` | `postgresql+asyncpg://aer:aer@localhost:5433/aer` | Cần extension pgvector |
| `RAG_TOP_K` / `RAG_CONTEXT_CHUNKS` / `RAG_MIN_SCORE` | `8` / `5` / `0.15` | Tham số truy hồi |
| `PROMPT_VERSION` | `referee-v3-structured-exceptions` | Ghi vào audit trail cho mỗi quyết định |

## 📁 Cấu trúc thư mục

```text
academic-escalation-referee/
├── backend/            FastAPI API
│   ├── app/
│   │   ├── ai/         Gemini / Fake provider, system prompt
│   │   ├── api/        HTTP routes
│   │   ├── ingestion/  trích xuất, chunking, OCR review, xung đột phiên bản
│   │   ├── rag/        hybrid retrieval
│   │   ├── services/   nghiệp vụ: câu hỏi, hồ sơ, ngoại lệ, audit
│   │   └── models/     SQLAlchemy entities
│   ├── migrations/     Alembic
│   └── tests/          pytest
├── frontend/           React + Vite SPA
├── harness/            Verify runner + bộ ca kiểm thử
├── data/
│   ├── demo-config.json        môn học, nhóm, tài khoản demo
│   └── sample-documents/       quy chế mẫu (nguồn trích dẫn)
├── scripts/            PowerShell helpers (setup, dev, seed, reindex, verify)
├── docker-compose.yml
└── render.yaml
```

## 🗂️ Dữ liệu: thật và giả lập

<!-- TODO: nhóm xác nhận lại nguồn gốc từng tài liệu trước khi nộp -->

| Dữ liệu | Loại |
|---|---|
| Quy chế môn CO3001 (`data/sample-documents/DACN/*.md`) | Giả lập — do nhóm soạn dựa trên cấu trúc quy chế đồ án thực tế |
| Tài liệu môn DADN (`data/sample-documents/DADN/*.pdf`) | *Cần xác nhận* |
| Tài khoản sinh viên, nhóm, giảng viên (`data/demo-config.json`) | Giả lập — tên hư cấu, không phải người thật |
| Bộ ca kiểm thử (`harness/`) | Giả lập — do nhóm thiết kế |

Hệ thống **không hard-code** dữ liệu: có thể tải quy chế mới qua giao diện hoặc API (`POST /api/v1/documents`),
và trả lời câu hỏi bất kỳ dựa trên tài liệu đang hiệu lực.

## ⚠️ Giới hạn đã biết

- **Một đích chuyển tiếp:** bản demo chỉ có một giảng viên, nên mọi ca `ESCALATE` đều về `COURSE_LECTURER`;
  giảng viên tự chuyển cấp sang Phòng Đào tạo khi cần.
- **Chưa tự điều chỉnh ngưỡng chuyển tiếp** theo phản hồi người dùng (yêu cầu nâng cao Sprint 2).
- **Giới hạn quota Gemini:** gói miễn phí giới hạn số request mỗi phút; Verify với `AI_MODE=gemini` chạy chậm hơn đáng kể so với `fake`.
- **Fake provider** dựa trên luật, chỉ dùng để kiểm thử tất định — không phản ánh chất lượng của model thật.
- **OCR** gửi nội dung ảnh/PDF scan tới Gemini Vision; không dùng cho tài liệu chứa dữ liệu nhạy cảm.
- **`AUTH_MODE=demo`** cho phép chuyển vai trò tự do để trình diễn — không dùng cho triển khai công khai thật.

## 👥 Đội ngũ

**Error404** — MLAI Hackathon 2026.

<!-- TODO: điền thành viên -->
| Thành viên | Vai trò |
|---|---|
| … | … |

Toàn bộ mã nguồn được phát triển trong thời gian cuộc thi (commit đầu tiên: 20/09/2026); không sử dụng mã khung có sẵn từ trước.
Lịch sử commit được giữ nguyên, không squash hay force-push.
