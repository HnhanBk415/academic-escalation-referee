param(
    [switch]$SkipDocker
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env")) {
    Copy-Item -LiteralPath ".env.example" -Destination ".env"
    Write-Host "Created .env. Add GEMINI_API_KEY before using AI_MODE=gemini."
}

if (-not $SkipDocker) {
    docker compose up -d postgres
}
else {
    Write-Host "Skipping Docker. Using DATABASE_URL from .env."
}
Push-Location "backend"
try {
    py -3.13 -m pip install -e ".[dev]"
    py -3.13 -m alembic upgrade head
    py -3.13 -m app.db.seed
}
finally {
    Pop-Location
}

Push-Location "frontend"
try {
    npm install
    npm run build
}
finally {
    Pop-Location
}
