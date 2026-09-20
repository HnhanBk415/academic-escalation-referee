$ErrorActionPreference = "Stop"

Push-Location "apps/api"
try {
    py -3.13 -m ruff check app tests
    py -3.13 -m pytest -q -p no:cacheprovider
}
finally {
    Pop-Location
}

Push-Location "apps/web"
try {
    npm run build
}
finally {
    Pop-Location
}
