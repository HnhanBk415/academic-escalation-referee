$ErrorActionPreference = "Stop"

Push-Location "backend"
try {
    py -3.13 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}
finally {
    Pop-Location
}

