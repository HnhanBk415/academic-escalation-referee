 

# Academic Escalation Referee (AER)

> Hệ thống AI hỗ trợ phân tích và xử lý yêu cầu học vụ của sinh viên

## Giới thiệu

**Academic Escalation Referee** là hệ thống ứng dụng AI kết hợp **Retrieval-Augmented Generation** nhằm hỗ trợ sinh viên tra cứu quy định học vụ, đồng thời tự động phân loại, định tuyến yêu cầu đến đúng đơn vị phụ trách và xử lý các yêu cầu của sinh viên.

Điểm nổi bật của AER là khả năng **xác định khi nào AI có thể tự xử lý và khi nào cần chuyển quyền quyết định cho con người**, giúp hạn chế xử lý thiếu căn cứ hoặc vượt thẩm quyền.

> Phạm vi MVP: Phiên bản hiện tại tập trung vào hỏi đáp quy chế, làm rõ yêu cầu, chuyển cấp xử lý và lưu lại lịch sử. Đây chưa phải hệ thống tích hợp với các phòng ban hoặc hệ thống quản lý của trường.

**Live Demo:** https://aersystem.vercel.app/

## Thành viên thực hiện
| Thành viên | GitHub |
|---|---|
| Nguyễn Hoàng Nhân - Leader | HCMUT, VNU |
| Bùi Quang Nhân | HCMUT, VNU |
| Nguyễn Thanh Bình | HCMUT, VNU |
| Võ Chí Thành | HCMUTE |

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI |
| AI & RAG | Google Gemini, Hybrid Retrieval |
| Database | PostgreSQL, pgvector |
| Deployment | Docker, Docker Compose |

## Cài đặt và chạy hệ thống

**Yêu cầu:** Git và Docker Desktop.

**Bước 1 — Clone repository**

```bash
git clone https://github.com/HnhanBk415/academic-escalation-referee.git
cd academic-escalation-referee
```

**Bước 2 — Cấu hình môi trường**

```powershell
Copy-Item .env.example .env
```

Mặc định, hệ thống sử dụng chế độ AI giả lập (`AI_MODE=fake`). Để sử dụng Gemini, cập nhật `AI_MODE=gemini` và `GEMINI_API_KEY` trong `.env`.

**Bước 3 — Build và khởi động bằng Docker**

```bash
docker compose up -d --build
```

**Bước 4 — Truy cập hệ thống**

- **Web Application:** http://localhost
- **Backend API:** http://localhost:8000
- **Swagger API Docs:** http://localhost:8000/docs

Dừng hệ thống:

```bash
docker compose down
```
## Kiến trúc thư mục

```
academic-escalation-referee/
├── backend/
│   ├── app/
│   │   ├── ai/              # Gemini/fake providers
│   │   ├── api/             # FastAPI routes and dependencies
│   │   ├── core/            # Configuration, enums, errors
│   │   ├── db/              # Database session and seed
│   │   ├── ingestion/       # Extract, chunk, embed, index
│   │   ├── models/          # SQLAlchemy entities
│   │   ├── rag/             # Hybrid retrieval
│   │   ├── schemas/         # Request/response contracts
│   │   └── services/        # Business workflows
│   ├── migrations/          # Alembic revisions
│   └── tests/               # Backend tests
├── frontend/                # React application
├── data/
│   ├── demo-config.json     # Demo actors/courses/groups
│   └── sample-documents/    # Course policy fixtures
├── harness/                 # AI evaluation scenarios and datasets
├── scripts/                 # Development and verification scripts
├── .github/workflows/       # CI quality checks
├── .env.example             # Configuration template
├── docker-compose.yml       # Local container stack
├── render.yaml              # Render deployment blueprint
├── DEPLOYMENT.md            # Production configuration guide
└── PROJECT_OVERVIEW.md      # Detailed technical reference
```


