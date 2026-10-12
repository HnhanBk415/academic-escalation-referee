# 📚 Academic Escalation Referee (AER)

> Hệ thống AI tự động phân loại và phân luồng câu hỏi học thuật của sinh viên dựa trên chính sách khoá học, tích hợp Gemini AI + RAG.

Phạm vi hiện tại tập trung hoàn toàn vào **Flow 1**: hỏi đáp quy chế, yêu cầu làm rõ,
chuyển người có thẩm quyền, quản lý quyết định/ngoại lệ và truy vết audit.

---

## 📌 Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Kiến trúc](#2-kiến-trúc)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Tech Stack](#4-tech-stack)
5. [Database Schema](#5-database-schema)
6. [Backend – Modules chi tiết](#6-backend--modules-chi-tiết)
7. [Frontend – Trang & Component](#7-frontend--trang--component)
8. [AI & RAG Pipeline](#8-ai--rag-pipeline)
9. [API Endpoints](#9-api-endpoints)
10. [Enums & Domain Types](#10-enums--domain-types)
11. [Harness – Evaluation](#11-harness--evaluation)
12. [Tài liệu mẫu (Sample Documents)](#12-tài-liệu-mẫu-sample-documents)
13. [Cấu hình môi trường](#13-cấu-hình-môi-trường)
14. [Triển khai (Deployment)](#14-triển-khai-deployment)
15. [Scripts phát triển](#15-scripts-phát-triển)
16. [Kiểm thử & CI](#16-kiểm-thử--ci)
17. [Luồng xử lý câu hỏi](#17-luồng-xử-lý-câu-hỏi)

---

## 1. Tổng quan hệ thống

**Academic Escalation Referee** là một ứng dụng full-stack giúp tự động phân loại câu hỏi học thuật của sinh viên trong môn học **CO3001** (hoặc các môn tương tự). Hệ thống sử dụng AI (Google Gemini) kết hợp kỹ thuật RAG (Retrieval-Augmented Generation) để:

| Chức năng | Mô tả |
|-----------|-------|
| **Trả lời (ANSWER)** | Câu hỏi có thể trả lời trực tiếp từ chính sách |
| **Yêu cầu làm rõ (CLARIFY)** | Thiếu dữ kiện, câu hỏi mơ hồ |
| **Leo thang (ESCALATE)** | Cần người có thẩm quyền phê duyệt |
| **Từ chối (REJECT)** | Phát hiện prompt injection / gian lận |
| **Ngoài phạm vi (OUT_OF_SCOPE)** | Không liên quan chính sách môn học |

**Người dùng chính:**
- 🎓 **Sinh viên** – gửi câu hỏi, xem lịch sử, phản hồi làm rõ
- 👨‍🏫 **Giảng viên** – xem inbox, xử lý escalation, ra quyết định
- 🏛️ **Phòng Đào tạo (Academic Affairs)** – xem toàn bộ audit log

> [!IMPORTANT]
> [!NOTE]
> Local mặc định chạy `AUTH_MODE=demo` để thuận tiện trình diễn role switch. Production chạy
> `AUTH_MODE=password`: đăng nhập cấp Bearer token có hạn, backend lấy danh tính từ token (không
> tin `actor_id`/`reviewer_id` do browser gửi) và chặn quyền theo vai trò. Không public hệ thống
> với `AUTH_MODE=demo`.

---

## 2. Kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                        │
│              React + TypeScript (Vite)                       │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP / REST
┌───────────────────────────▼─────────────────────────────────┐
│                   FastAPI Backend (Python)                   │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐  │
│  │  API     │  │ Services  │  │   RAG     │  │   AI     │  │
│  │ Routes   │→ │ (business │→ │ (vector   │→ │(Gemini / │  │
│  │          │  │  logic)   │  │  search)  │  │  Fake)   │  │
│  └──────────┘  └───────────┘  └───────────┘  └──────────┘  │
│                        │                                     │
│              ┌──────────▼──────────┐                        │
│              │   SQLAlchemy ORM    │                        │
│              └──────────┬──────────┘                        │
└─────────────────────────┼───────────────────────────────────┘
                          │
          ┌───────────────▼───────────────┐
          │  PostgreSQL 16 + pgvector     │
          │  (vector similarity search)   │
          └───────────────────────────────┘
```

**Deployment Options:**
- 🐳 **Docker Compose** – local/self-hosted (3 container: postgres, api, web)
- ☁️ **Render.com** – cloud deploy (API via Docker, Frontend via Vercel)

---

## 3. Cấu trúc thư mục

```
project/
├── backend/                     # FastAPI Python backend
│   ├── app/
│   │   ├── main.py              # App factory, CORS, lifespan
│   │   ├── ai/                  # AI provider abstraction
│   │   │   ├── base.py          # Abstract AIProvider interface
│   │   │   ├── factory.py       # Provider factory (gemini/fake)
│   │   │   ├── gemini.py        # Google Gemini implementation
│   │   │   ├── fake.py          # Deterministic fake for testing
│   │   │   └── unavailable.py   # Stub when AI is down
│   │   ├── api/                 # HTTP layer
│   │   │   ├── router.py        # Root + API router assembly
│   │   │   ├── deps.py          # FastAPI dependencies
│   │   │   └── routes/
│   │   │       ├── health.py    # GET /health
│   │   │       ├── questions.py # Questions CRUD + AI routing
│   │   │       ├── cases.py     # Escalation cases + decisions
│   │   │       ├── exceptions.py# Policy exceptions management
│   │   │       ├── documents.py # Document upload & ingestion
│   │   │       ├── audit.py     # Audit event log
│   │   │       ├── demo.py      # Demo catalog + reset endpoint
│   │   ├── core/                # Cross-cutting concerns
│   │   │   ├── config.py        # Settings (pydantic-settings)
│   │   │   ├── enums.py         # All domain enumerations
│   │   │   ├── errors.py        # AppError + handler
│   │   │   └── policy_topics.py # Canonical policy topic list
│   │   ├── db/                  # Database infrastructure
│   │   │   ├── base.py          # SQLAlchemy declarative Base
│   │   │   ├── session.py       # Async session factory
│   │   │   └── seed.py          # Demo data seeding
│   │   ├── models/
│   │   │   └── entities.py      # All SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic request/response DTOs
│   │   │   ├── cases.py         # EscalationCase schemas
│   │   │   ├── questions.py     # Question schemas
│   │   │   ├── exceptions.py    # PolicyException schemas
│   │   │   ├── documents.py     # Document schemas
│   │   │   ├── audit.py         # AuditEvent schemas
│   │   │   ├── referee.py       # AI RefereeDecision schema
│   │   │   ├── demo.py          # Demo seed schema
│   │   │   └── common.py        # Shared base schemas
│   │   ├── services/            # Business logic layer
│   │   │   ├── questions.py     # Question submission + AI routing
│   │   │   ├── cases.py         # Case management + decisions
│   │   │   ├── exceptions.py    # Exception CRUD + revocation
│   │   │   ├── documents.py     # Document management
│   │   │   ├── audit.py         # Audit logging service
│   │   │   └── ids.py           # ID generation helpers
│   │   ├── ingestion/           # Document ingestion pipeline
│   │   │   ├── service.py       # Main ingestion orchestration
│   │   │   ├── chunking.py      # Text chunking strategy
│   │   │   └── extractors.py    # PDF/Markdown text extraction
│   │   └── rag/
│   │       └── service.py       # Vector search + hybrid retrieval
│   ├── migrations/              # Alembic DB migrations
│   ├── tests/                   # Pytest test suite
│   ├── pyproject.toml           # Python dependencies & config
│   └── Dockerfile               # Production container
│
├── frontend/                    # React TypeScript frontend
│   ├── src/
│   │   ├── main.tsx             # React entry point
│   │   ├── App.tsx              # SPA shell + state điều hướng tab
│   │   ├── styles.css           # Global CSS design system
│   │   ├── api/                 # API client functions
│   │   ├── types/               # TypeScript type definitions
│   │   ├── components/          # Reusable UI components
│   │   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   │   ├── StudentWorkflowTracker.tsx
│   │   │   ├── SLATimer.tsx     # SLA countdown timer
│   │   │   ├── StatusBadge.tsx  # Status label badges
│   │   │   ├── StepTracker.tsx  # Step progress tracker
│   │   │   ├── Stepper.tsx      # Multi-step indicator
│   │   │   ├── CitationList.tsx # RAG citation display
│   │   │   ├── PageHeader.tsx
│   │   │   ├── RouteBadge.tsx
│   │   │   └── Icons.tsx
│   │   └── pages/
│   │       ├── HomePage.tsx
│   │       ├── StudentPage.tsx
│   │       ├── StudentSubmitView.tsx
│   │       ├── StudentHistoryView.tsx
│   │       ├── LecturerPage.tsx
│   │       ├── LecturerInboxView.tsx
│   │       ├── ExceptionsView.tsx
│   │       ├── OperationsPage.tsx
│   │       ├── AuditPage.tsx
│   │       ├── VerifyPage.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── nginx.conf
│   └── Dockerfile
│
├── data/
│   ├── demo-config.json         # Courses, groups, actor demo, document mapping
│   └── sample-documents/
│       ├── DACN/                # Tài liệu cho CO3001
│       └── DADN/                # Tài liệu cho DADN-HK242
│
├── harness/                     # AI evaluation framework
│   ├── runner/__main__.py
│   ├── scenarios/verify.jsonl
│   └── datasets/evaluation.jsonl
│
├── scripts/                     # PowerShell dev scripts
│   ├── dev.ps1 / dev-api.ps1 / dev-frontend.ps1
│   ├── setup.ps1 / seed.ps1 / reindex.ps1
│   ├── build.ps1 / verify.ps1
│   └── ingest_dadn_documents.py
│
├── docker-compose.yml
├── render.yaml
└── .env.example
```

---

## 4. Tech Stack

### Backend

| Thành phần | Công nghệ | Version |
|-----------|-----------|---------|
| Web framework | **FastAPI** | ≥0.115 |
| Language | **Python** | ≥3.11 |
| ORM | **SQLAlchemy** | ≥2.0 (async) |
| Database | **PostgreSQL 16** + **pgvector** | pg16 |
| Migrations | **Alembic** | ≥1.13 |
| AI | **Google Gemini** (`google-genai`) | ≥1.0 |
| Embeddings | **gemini-embedding-001** | dim=768 |
| PDF parsing | **pypdf** | ≥5 |
| Validation | **pydantic-settings** | ≥2.5 |
| Server | **Uvicorn** | ≥0.30 |
| Async DB driver | **asyncpg** / **aiosqlite** | – |
| Testing | **pytest** + **pytest-asyncio** | ≥8 |
| Linter | **ruff** | ≥0.8 |

### Frontend

| Thành phần | Công nghệ | Version |
|-----------|-----------|---------|
| Framework | **React** | latest |
| Language | **TypeScript** | latest |
| Build tool | **Vite** | latest |
| Điều hướng | Sidebar tab state (có `BrowserRouter` wrapper) | – |
| Styling | **Vanilla CSS** | – |
| Testing | **vitest** | latest |
| Web server | **Nginx** (container) | – |

---

## 5. Database Schema

```mermaid
erDiagram
    Actor {
        string id PK
        string display_name
        string role
        datetime created_at
    }
    Course {
        string id PK
        string code
        string name
        string semester
    }
    Group {
        string id PK
        string course_id FK
        string name
        string semester
    }
    GroupMembership {
        int id PK
        string actor_id FK
        string group_id FK
    }
    Document {
        string id PK
        string course_id FK
        string title
        string document_type
        string version
        string status
        date effective_from
        date effective_until
        string content_hash
        datetime created_at
    }
    DocumentChunk {
        string id PK
        string document_id FK
        string course_id FK
        int chunk_index
        string heading
        int page_number
        text content
        vector embedding
        datetime created_at
    }
    Question {
        string id PK
        string parent_question_id
        int clarification_round
        string actor_id FK
        string group_id FK
        string course_id FK
        text text
        string status
        string route
        string uncertainty_type
        string reason_code
        string policy_topic
        string applied_exception_id
        string escalation_target
        text answer
        text clarifying_question
        datetime created_at
        datetime updated_at
    }
    RetrievalEvidence {
        string id PK
        string question_id FK
        string chunk_id FK
        string label
        float retrieval_score
        int rank
        datetime created_at
    }
    EscalationCase {
        string id PK
        string question_id FK
        string status
        string reason_code
        string uncertainty_type
        string escalation_target
        text ai_summary
        text decision_question
        string assigned_reviewer_id FK
        datetime sla_due_at
        datetime created_at
        datetime updated_at
    }
    HumanDecision {
        string id PK
        string case_id FK
        string reviewer_id FK
        string decision
        text reason
        string idempotency_key
        datetime created_at
    }
    PolicyException {
        string id PK
        string source_policy_document_id FK
        string human_decision_id FK
        string course_id FK
        string scope_type
        string scope_id
        string policy_topic
        text content
        date valid_from
        date valid_until
        string status
        string created_by FK
        datetime created_at
    }
    AuditEvent {
        string id PK
        string request_id
        string event_type
        string actor_id
        string entity_type
        string entity_id
        json input_snapshot
        json output_snapshot
        string reason_code
        string model_name
        string prompt_version
        int duration_ms
        datetime created_at
    }

    Actor ||--o{ GroupMembership : "belongs to"
    Group ||--o{ GroupMembership : "has"
    Course ||--o{ Group : "has"
    Course ||--o{ Document : "has"
    Document ||--o{ DocumentChunk : "split into"
    Actor ||--o{ Question : "asks"
    Course ||--o{ Question : "belongs to"
    Question ||--o{ RetrievalEvidence : "uses"
    DocumentChunk ||--o{ RetrievalEvidence : "cited by"
    Question ||--o| EscalationCase : "escalated to"
    EscalationCase ||--o{ HumanDecision : "decided by"
    HumanDecision ||--o| PolicyException : "creates"
    Course ||--o{ PolicyException : "scoped to"
```

---

## 6. Backend – Modules chi tiết

### `app/ai/` — AI Provider

| File | Mô tả |
|------|-------|
| `base.py` | `AIProvider` protocol: embedding, quyết định câu hỏi, trích xuất/đánh giá thể thức, health |
| `factory.py` | `build_ai_provider(settings)` → trả về Gemini hoặc Fake |
| `gemini.py` | Gemini implementation: async rate limiter (14 RPM), retry (3 lần), structured output |
| `fake.py` | Fake provider: deterministic responses cho testing |
| `unavailable.py` | Stub khi AI không khả dụng |

**System Prompt (Gemini):** Được viết bằng tiếng Việt, định nghĩa:
- Các loại `policy_coverage` (DIRECT, CONDITIONAL, APPLICABLE_EXCEPTION, …)
- Mapping coverage → route (ANSWER, CLARIFY, ESCALATE, REJECT)
- Chống prompt injection, constraint về citation, reason_code

### `app/rag/` — Retrieval-Augmented Generation

**Hybrid search:**
1. **Vector search** – cosine similarity với pgvector (PostgreSQL) hoặc in-memory fallback (SQLite)
2. **BM25-like keyword search** – tokenize tiếng Việt, loại stop words
3. **Fusion & deduplication** – kết hợp kết quả, loại trùng lặp theo `content_hash`
4. **Score threshold** – `RAG_MIN_SCORE=0.15`
5. **Top-K** – `RAG_TOP_K=8`, context trả về AI `RAG_CONTEXT_CHUNKS=5`

### `app/ingestion/` — Document Ingestion

| File | Mô tả |
|------|-------|
| `service.py` | Orchestrate: extract → chunk → embed → store |
| `chunking.py` | Chia văn bản theo heading/paragraph |
| `extractors.py` | Extract text từ PDF (pypdf) và Markdown |

### `app/services/` — Business Logic

| File | Mô tả |
|------|-------|
| `questions.py` | Submit question → RAG → AI → lưu kết quả + audit |
| `cases.py` | Tạo/cập nhật escalation case, ghi nhận human decision |
| `exceptions.py` | Xem và thu hồi policy exception |
| `documents.py` | Upload, status tracking |
| `audit.py` | Ghi audit event |
| `ids.py` | Sinh ID có prefix (qs_, case_, exc_, …) |

### `app/core/policy_topics.py` — Policy Topics

```
GROUP_MEMBERSHIP, AI_USAGE, GRADE_APPEAL, SUBMISSION_DEADLINE,
GRADING_RUBRIC, CAMPUS_LIFE, COURSE_REGISTRATION, POLICY_VERSION,
GROUP_CONTEXT, SECURITY, AI_AVAILABILITY, GENERAL
```

---

## 7. Frontend – Trang & Component

### Màn hình

Frontend hiện là **một SPA theo tab sidebar**, không có URL route riêng cho từng màn hình.

| Màn hình | Tab sidebar | Người dùng | Mô tả |
|------|------|-----------|-------|
| `HomePage` | Trang hướng dẫn | Sinh viên, giảng viên, Phòng Đào tạo | Homepage giới thiệu phạm vi, 3 bước sử dụng, các kết quả có thể nhận và điều hướng nhanh |
| `StudentSubmitView` | Hỏi đáp quy chế | Sinh viên | Gửi câu hỏi, chọn course/nhóm và xem quyết định AI |
| `StudentHistoryView` | Hồ sơ của tôi | Sinh viên | Lịch sử câu hỏi + workflow tracker |
| `LecturerInboxView` | Hàng chờ thẩm định | Giảng viên | Danh sách escalation case, ra quyết định |
| `ExceptionsView` | Ngoại lệ quy chế | Giảng viên | Xem và thu hồi policy exception |
| `OperationsPage` | Trung tâm vận hành | Phòng Đào tạo | Theo dõi yêu cầu, case/SLA, ngoại lệ, tài liệu và audit gần đây |
| `AuditPage` | Audit Log | Chung | Toàn bộ audit event log |
| `VerifyPage` | Verify Harness | Chung | Kiểm tra hệ thống và scenario demo |

### Components

| Component | Mô tả |
|-----------|-------|
| `Sidebar` | Navigation sidebar với role-based menu |
| `StudentWorkflowTracker` | Visualize toàn bộ workflow của một câu hỏi |
| `SLATimer` | Countdown đến SLA deadline của case |
| `StatusBadge` | Badge màu sắc cho trạng thái (question/case) |
| `RouteBadge` | Badge cho route (ANSWER/CLARIFY/ESCALATE/REJECT) |
| `StepTracker` | Hiển thị tiến trình các bước |
| `Stepper` | Multi-step form indicator |
| `CitationList` | Danh sách citations từ RAG evidence |
| `PageHeader` | Header nhất quán cho mỗi trang |
| `Icons` | Thư viện icon SVG nội bộ |

---

## 8. AI & RAG Pipeline

```
Sinh viên gửi câu hỏi
        │
        ▼
[1] Load Policy Exceptions
    (scope: course + actor/group + còn hạn)
        │
        ▼
[2] RAG Retrieval
    ├─ Embed câu hỏi (gemini-embedding-001, dim=768)
    ├─ Vector search (cosine similarity, pgvector)
    ├─ Keyword search (BM25-like, tiếng Việt)
    └─ Fusion + dedup → top K chunks
        │
        ▼
[3] Build Prompt
    ├─ System instruction (tiếng Việt, anti-injection)
    ├─ Actor context (role, group, course)
    ├─ Scoped exceptions (filtered by policy_topic + scope)
    └─ Evidence (labeled chunks: [A], [B], ...)
        │
        ▼
[4] Gemini API Call
    ├─ Model: gemini-3.1-flash-lite
    ├─ Structured output (RefereeDecision schema)
    ├─ Rate limit: 14 RPM (sliding window)
    └─ Retry: 3 lần với jitter
        │
        ▼
[5] Process Decision
    ├─ ANSWER  → lưu answer + citations
    ├─ CLARIFY → lưu clarifying_question
    ├─ ESCALATE→ tạo EscalationCase
    └─ REJECT  → lưu reason
        │
        ▼
[6] Audit Logging
    (ghi AuditEvent: model, prompt_version, duration_ms, evidence_ids)
```

**RefereeDecision schema:**
```python
class RefereeDecision(BaseModel):
    route: Route                    # ANSWER | CLARIFY | ESCALATE | REJECT | OUT_OF_SCOPE
    policy_coverage: PolicyCoverage # DIRECT | CONDITIONAL | APPLICABLE_EXCEPTION | ...
    uncertainty_type: UncertaintyType
    reason_code: str                # ≤50 ký tự, UPPER_SNAKE_CASE
    policy_topic: str               # từ danh sách chuẩn
    answer: str | None
    clarifying_question: str | None
    escalation_target: EscalationTarget | None
    applied_exception_id: str | None
    citations: list[str]            # labels tồn tại trong evidence
    ai_summary: str | None
    decision_question: str | None
```

---

## 9. API Endpoints

Base URL: `/api` hoặc `/api/v1`

### Health
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/health` | Health check database |
| GET | `/health/ai` | Trạng thái AI provider đang dùng |

### Questions
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/questions/counts` | Số lượng câu hỏi/case cho badge dashboard |
| POST | `/questions` | Gửi câu hỏi mới (trigger AI) |
| GET | `/questions` | Danh sách câu hỏi (filter: actor, course, group, limit, offset) |
| GET | `/questions/{id}` | Chi tiết câu hỏi |
| POST | `/questions/{id}/clarifications` | Phản hồi câu hỏi làm rõ |

### Authentication
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/auth/login` | Đăng nhập bằng tài khoản được cấp khi `AUTH_MODE=password` |
| GET | `/auth/me` | Danh tính và vai trò của phiên hiện tại |

### Operations (Academic Affairs)
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/operations/overview` | Chỉ số vận hành: câu hỏi, case, SLA, ngoại lệ, tài liệu và audit gần đây |

### Cases (Escalation)
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/cases` | Danh sách escalation cases |
| GET | `/cases/{id}` | Chi tiết case |
| POST | `/cases/{id}/decision` | Giảng viên ra quyết định (hỗ trợ `Idempotency-Key`) |
| POST | `/cases/{id}/cancel` | Hủy case bởi người dùng phù hợp |

### Policy Exceptions
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/exceptions` | Danh sách exceptions |
| GET | `/exceptions/overview` | Tổng quan ngoại lệ theo course |
| POST | `/exceptions/{id}/revoke` | Thu hồi exception |

### Documents
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/documents` | Danh sách tài liệu |
| POST | `/documents/sync` | Quét và đồng bộ tài liệu mẫu từ `data/sample-documents` |
| POST | `/documents` | Upload tài liệu mới |
| GET | `/documents/{id}` | Chi tiết tài liệu |
| POST | `/documents/{id}/ingest` | Kích hoạt ingestion |

### Audit
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/audit` | Audit event log mới nhất (giới hạn `limit`) |

### Demo
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/demo/catalog` | Danh sách course/nhóm/giảng viên demo |
| POST | `/demo/reset` | Xóa dữ liệu nghiệp vụ rồi seed lại demo và tài liệu |

---

## 10. Enums & Domain Types

### `ActorRole`
```
STUDENT | LECTURER | ACADEMIC_AFFAIRS
```

### `QuestionStatus` (vòng đời câu hỏi)
```
SUBMITTED → ANSWERED
          → CLARIFICATION_REQUIRED → CLARIFICATION_RECEIVED → (lặp)
          → ESCALATED
          → OUT_OF_SCOPE
          → REJECTED
```

### `Route` (quyết định AI)
```
ANSWER | CLARIFY | ESCALATE | OUT_OF_SCOPE | REJECT
```

### `CaseStatus` (vòng đời escalation case)
```
UNDER_REVIEW → WAITING_FOR_STUDENT → UNDER_REVIEW
             → FORWARDED
             → DECIDED
             → CANCELLED
```

### `DecisionValue` (quyết định của giảng viên)
```
APPROVED | REJECTED | NEED_MORE_INFO | FORWARDED
```

### `PolicyCoverage` (AI coverage analysis)
```
DIRECT | CONDITIONAL | APPLICABLE_EXCEPTION | REQUIRES_APPROVAL |
REQUESTS_WAIVER | MISSING_FACT | NO_POLICY | CONFLICTING |
SUSPICIOUS | AI_UNAVAILABLE | UNRESOLVED
```

### `UncertaintyType`
```
NONE | MISSING_FACT | OUT_OF_POLICY | AUTHORITY_REQUIRED |
CONFLICTING_EVIDENCE | SUSPICIOUS_INPUT | AI_UNAVAILABLE
```

### `DocumentStatus`
```
PENDING → INGESTING → ACTIVE
                    → FAILED
        → SUPERSEDED (khi có version mới)
```

### `ExceptionStatus`
```
ACTIVE | EXPIRED | REVOKED
```

### `ScopeType` (phạm vi policy exception)
```
STUDENT | GROUP | COURSE
```

---

## 11. Harness – Evaluation

### `harness/runner/__main__.py`
CLI tool đánh giá chất lượng AI responses:
- Chạy các test scenario từ `scenarios/verify.jsonl`
- So sánh route/coverage thực tế với expected
- Báo cáo pass/fail theo từng scenario

### `harness/scenarios/verify.jsonl`
Các scenario kiểm tra hệ thống verify endpoint.

### `harness/datasets/evaluation.jsonl`
Dataset đánh giá chất lượng AI routing, bao gồm:
- Input: câu hỏi sinh viên + context
- Expected: route, policy_topic, coverage type

---

## 12. Tài liệu mẫu (Sample Documents)

| Course | Thư mục | Tài liệu |
|--------|---------|----------|
| CO3001 | `data/sample-documents/DACN/` | `group-policy-v1.md`, `project-rubric-v1.md`, `format-guidelines-v1.md` |
| DADN-HK242 | `data/sample-documents/DADN/` | `dadn-course-plan.pdf`, `dadn-rubric.pdf`, `dadn-work-plan.pdf`, `format-guidelines-v1.md` |

Đường dẫn thư mục được ánh xạ với course trong `data/demo-config.json`. Sau khi thay đổi
tài liệu demo, dùng **Reset Data Demo** trên sidebar hoặc gọi `POST /api/v1/demo/reset`
để seed và ingest lại dữ liệu.

---

## 13. Cấu hình môi trường

```env
# Môi trường
APP_ENV=development

# Database
DATABASE_URL=postgresql+asyncpg://aer:aer@localhost:5433/aer

# Authentication (local demo giữ role switch; production phải dùng password)
AUTH_MODE=demo                         # "demo" hoặc "password"
AUTH_SECRET_KEY=                       # >= 32 ký tự, bắt buộc khi password
AUTH_USERS_JSON=                       # {"actor_id":"pbkdf2_sha256$..."}
AUTH_TOKEN_TTL_MINUTES=480

# AI Provider
AI_MODE=fake                          # "fake" hoặc "gemini"
AI_HEALTH_CACHE_SECONDS=45
GEMINI_API_KEY=                       # Bắt buộc khi AI_MODE=gemini
GEMINI_CHAT_MODEL=gemini-3.1-flash-lite
GEMINI_EMBED_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=768
AI_REQUEST_TIMEOUT_SECONDS=30
AI_MAX_CONCURRENCY=1

# RAG
RAG_TOP_K=8                           # Số chunks lấy ra từ vector search
RAG_CONTEXT_CHUNKS=5                  # Số chunks đưa vào prompt AI
RAG_MIN_SCORE=0.15                    # Ngưỡng score tối thiểu

# Prompt
PROMPT_VERSION=referee-v3-structured-exceptions

# Server
PUBLIC_BASE_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:5173,http://localhost
```

> [!NOTE]
> Sao chép `.env.example` thành `.env` và điền `GEMINI_API_KEY` để dùng Gemini thật.
> Để test không cần API key, giữ `AI_MODE=fake`.

---

## 14. Triển khai (Deployment)

### Docker Compose (Local / Self-hosted)

```bash
# Build và chạy nền toàn bộ stack
docker compose up -d --build

# Services:
# postgres  → localhost:5433
# api       → localhost:8000
# web       → localhost:80
```

Thứ tự khởi động: `postgres` (healthcheck) → `api` (healthcheck) → `web`

Với PostgreSQL volume mới, API tự chạy migration và seed dữ liệu demo khi khởi động. Nếu đã
giữ volume cũ rồi kéo code có thay đổi `data/demo-config.json` hoặc tài liệu mẫu, mở
`http://localhost` và nhấn **Reset Data Demo** để nạp lại đúng course, group và tài liệu.
Xem trạng thái/log khi cần:

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f web
```

### Render.com (Cloud)

API deploy qua `render.yaml`; frontend deploy riêng trên Vercel từ thư mục `frontend/`.
Thiết lập production chi tiết, biến môi trường bắt buộc, CORS và checklist xác nhận nằm trong
[DEPLOYMENT.md](DEPLOYMENT.md). Database production phải hỗ trợ extension **pgvector**.

---

## 15. Scripts phát triển

### macOS / Linux

```bash
# Chạy backend độc lập (cần PostgreSQL và .env hợp lệ)
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Chạy frontend ở terminal khác
cd frontend
npm ci
npm run dev
```

Khi sửa frontend trong Docker, chạy lại `docker compose up -d --build web`. Khi chỉ sửa
backend, source `backend/app` đã được bind mount trong Compose; vẫn nên chạy test trước khi
reload/rebuild.

### Windows PowerShell

```powershell
# Cài đặt ban đầu
.\scripts\setup.ps1

# Khởi động full stack (dev mode)
.\scripts\dev.ps1

# Chỉ backend (hot reload)
.\scripts\dev-api.ps1

# Chỉ frontend (Vite dev server)
.\scripts\dev-frontend.ps1

# Seed dữ liệu demo vào DB
.\scripts\seed.ps1

# Re-index embeddings (sau khi thay đổi tài liệu)
.\scripts\reindex.ps1

# Build production
.\scripts\build.ps1

# Chạy verification
.\scripts\verify.ps1

# Ingest tài liệu DADN vào DB
python scripts\ingest_dadn_documents.py
```

---

## 16. Kiểm thử & CI

Workflow [`.github/workflows/quality.yml`](.github/workflows/quality.yml) chạy trên mọi
`push` và `pull_request`:

| Job | Kiểm tra |
|-----|----------|
| Backend | `ruff check .` và `pytest tests -q` (Python 3.13) |
| Frontend | `npm ci`, `npm test`, `npm run build` (Node 22) |
| Docker | `docker compose build` sau khi hai job trên thành công |

Chạy cùng các kiểm tra đó ở máy local (sau khi đã tạo virtual environment trong `backend/`):

```bash
(cd backend && .venv/bin/ruff check . && .venv/bin/python -m pytest tests -q)
(cd frontend && npm test && npm run build)
docker compose build
```

`E501` được Ruff bỏ qua có chủ đích vì prompt AI và fixture tài liệu chứa chuỗi dài không thể
tách mà không làm giảm tính dễ đọc; các nhóm lỗi `E`, `F`, `I`, `UP`, `B` còn lại vẫn được kiểm tra.

---

## 17. Luồng xử lý câu hỏi

```mermaid
flowchart TD
    A["🎓 Sinh viên gửi câu hỏi"] --> B["POST /api/questions"]
    B --> C["Load Actor Context\n(role, group, course)"]
    C --> D["Load Active Policy Exceptions\n(scoped by course + actor/group)"]
    D --> E["RAG Retrieval\n(vector + keyword hybrid search)"]
    E --> F["Build AI Prompt\n(system + context + evidence)"]
    F --> G["Gemini API\ngemini-3.1-flash-lite"]
    G --> H{"Route?"}
    H -->|ANSWER| I["✅ Lưu answer + citations\nQuestionStatus: ANSWERED"]
    H -->|CLARIFY| J["❓ Lưu clarifying_question\nQuestionStatus: CLARIFICATION_REQUIRED"]
    H -->|ESCALATE| K["⚡ Tạo EscalationCase + SLA\nQuestionStatus: ESCALATED"]
    H -->|REJECT| L["🚫 Lưu reason\nQuestionStatus: REJECTED"]
    J --> M["Sinh viên phản hồi\nPOST /questions/id/clarifications"]
    M --> F
    K --> N["👨‍🏫 Giảng viên\n/lecturer/inbox"]
    N --> O{"Human Decision"}
    O -->|APPROVED| P["Tạo PolicyException\n(scoped STUDENT/GROUP/COURSE)"]
    O -->|REJECTED| Q["Đóng case"]
    O -->|NEED_MORE_INFO| R["WAITING_FOR_STUDENT"]
    I --> S["📝 AuditEvent"]
    J --> S
    K --> S
    L --> S
    P --> S
```

---

*Cập nhật: 2026-10-07 | Project: Academic Escalation Referee v0.1.0*
