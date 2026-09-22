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
    Write-Host "Waiting for PostgreSQL to become ready..."
    $databaseReady = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        docker compose exec -T postgres pg_isready -U aer -d aer *> $null
        if ($LASTEXITCODE -eq 0) {
            $databaseReady = $true
            break
        }
        Start-Sleep -Seconds 2
    }
    if (-not $databaseReady) {
        throw "PostgreSQL did not become ready within 60 seconds."
    }
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
