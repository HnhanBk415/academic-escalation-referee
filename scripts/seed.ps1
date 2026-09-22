$ErrorActionPreference = "Stop"

Push-Location "backend"
try {
    py -3.13 -m alembic upgrade head
    py -3.13 -m app.db.seed
}
finally {
    Pop-Location
}

