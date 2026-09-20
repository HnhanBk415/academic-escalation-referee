import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

import httpx


def evaluate_response(case: dict, status_code: int, body: dict) -> dict:
    expected_route = case["expected_route"]
    actual_route = body.get("route")
    answer = (body.get("answer") or "").casefold()
    citations = body.get("citations") or []
    required = [phrase for phrase in case.get("must_include", []) if phrase.casefold() not in answer]
    forbidden = [phrase for phrase in case.get("forbidden_claims", []) if phrase.casefold() in answer]
    citation_ok = expected_route != "ANSWER" or all(
        citation.get("chunk_id") and citation.get("quote") for citation in citations
    ) and bool(citations)
    schema_ok = all(
        key in body
        for key in ("question_id", "status", "route", "uncertainty_type", "reason_code")
    )
    passed = (
        status_code == 201
        and actual_route == expected_route
        and not required
        and not forbidden
        and citation_ok
        and schema_ok
    )
    return {
        "expected_route": expected_route,
        "actual_route": actual_route,
        "http_status": status_code,
        "schema_valid": schema_ok,
        "citation_valid": citation_ok,
        "missing_required_phrases": required,
        "forbidden_claims_found": forbidden,
        "passed": passed,
        "evidence": citations,
    }


async def run(args: argparse.Namespace) -> int:
    dataset_path = Path(args.dataset)
    cases = [json.loads(line) for line in dataset_path.read_text(encoding="utf-8").splitlines() if line]
    results: list[dict] = []
    async with httpx.AsyncClient(base_url=args.base_url, timeout=args.timeout) as client:
        if args.reset:
            reset = await client.post("/api/v1/demo/reset")
            reset.raise_for_status()
        for index, case in enumerate(cases, start=1):
            started = perf_counter()
            timestamp = datetime.now(timezone.utc).isoformat()
            try:
                response = await client.post(
                    "/api/v1/questions",
                    json={
                        "actor_id": case["actor_id"],
                        "course_id": case["course_id"],
                        "text": case["question"],
                    },
                )
                body = response.json()
                evaluation = evaluate_response(case, response.status_code, body)
                error = None
            except Exception as exc:
                evaluation = {
                    "expected_route": case["expected_route"],
                    "actual_route": None,
                    "http_status": None,
                    "schema_valid": False,
                    "citation_valid": False,
                    "missing_required_phrases": case.get("must_include", []),
                    "forbidden_claims_found": [],
                    "passed": False,
                    "evidence": [],
                }
                error = str(exc)
            latency_ms = round((perf_counter() - started) * 1000, 2)
            result = {
                "case_id": case["id"],
                "input": case["question"],
                **evaluation,
                "latency_ms": latency_ms,
                "timestamp": timestamp,
                "error": error,
            }
            results.append(result)
            status = "PASS" if result["passed"] else "FAIL"
            print(
                f"[{index:02}/{len(cases):02}] {status:<4} {case['id']} "
                f"expected={case['expected_route']} actual={result['actual_route']} "
                f"latency={latency_ms}ms"
            )

    passed_count = sum(result["passed"] for result in results)
    report = {
        "base_url": args.base_url,
        "started_at": results[0]["timestamp"] if results else None,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "total": len(results),
        "passed": passed_count,
        "failed": len(results) - passed_count,
        "results": results,
    }
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSummary: {passed_count}/{len(results)} passed. Report: {report_path}")
    return 0 if passed_count == len(results) else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run AER black-box HTTP verification")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--dataset", default="harness/scenarios/verify.jsonl")
    parser.add_argument("--report", default="harness/reports/latest.json")
    parser.add_argument("--timeout", type=float, default=30)
    parser.add_argument("--reset", action=argparse.BooleanOptionalAction, default=True)
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(asyncio.run(run(parse_args())))

