#!/usr/bin/env pwsh
# scripts/dev-frontend.ps1
# Khởi động React + Vite frontend trong chế độ development.
# Yêu cầu: Node.js 18+ và npm đã cài.
# Backend phải đang chạy trên http://localhost:8000.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root    = Split-Path -Parent $PSScriptRoot
$webDir  = Join-Path $root "frontend"

Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║  AER Frontend – Vite dev server       ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Thư mục: $webDir" -ForegroundColor Gray
Write-Host "  URL:     http://localhost:5173" -ForegroundColor Green
Write-Host "  Proxy:   /api → http://localhost:8000" -ForegroundColor Gray
Write-Host ""
Write-Host "  [!] Đảm bảo backend đang chạy trước." -ForegroundColor Yellow
Write-Host ""

Push-Location $webDir

if (-not (Test-Path "node_modules")) {
    Write-Host "[i] Chưa có node_modules, đang cài đặt…" -ForegroundColor Yellow
    npm install
}

npm run dev

Pop-Location
