#!/usr/bin/env pwsh
# scripts/dev-api.ps1
# Khởi động FastAPI backend trong chế độ development.
# Yêu cầu: Python 3.11+, file .env đã được cấu hình.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root   = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $root "backend"

Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  AER Backend – FastAPI dev server     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Thư mục: $apiDir" -ForegroundColor Gray
Write-Host "  URL:     http://localhost:8000" -ForegroundColor Green
Write-Host "  Swagger: http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""

Push-Location $apiDir

# Check venv
if (-not (Test-Path ".venv")) {
    Write-Host "[i] Chưa có virtual environment, đang tạo…" -ForegroundColor Yellow
    py -3 -m venv .venv
    .\.venv\Scripts\pip install -e ".[dev]" --quiet
}

# Activate and run
.\.venv\Scripts\Activate.ps1
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Pop-Location
