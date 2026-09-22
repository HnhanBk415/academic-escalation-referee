param(
    [switch]$ForceClearDemoHistory
)

$ErrorActionPreference = "Stop"

Push-Location "backend"
try {
    if ($ForceClearDemoHistory) {
        py -3.13 scripts/reindex_demo.py --force-clear-demo-history
    }
    else {
        py -3.13 scripts/reindex_demo.py
    }
}
finally {
    Pop-Location
}
