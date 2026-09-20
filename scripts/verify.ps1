param(
    [string]$BaseUrl = "http://localhost:8000",
    [string]$Dataset = "harness/scenarios/verify.jsonl"
)

py -3.13 -m harness.runner --base-url $BaseUrl --dataset $Dataset
exit $LASTEXITCODE
