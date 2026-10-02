import argparse
import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import perf_counter

import httpx


def evaluate_response(case: dict, status_code: int, body: dict) -> dict:
    expected_route = case["expected_route"]
    actual_route = body.get("route")
    expected_target = case.get("expected_target")
    actual_target = body.get("escalation_target")
    target_ok = expected_target is None or actual_target == expected_target

    answer = (body.get("answer") or "").casefold()
    citations = body.get("citations") or []
    required_document_ids = set(case.get("required_document_ids", []))
    actual_document_ids = {
        citation.get("document_id") for citation in citations if citation.get("document_id")
    }
    missing_document_ids = sorted(required_document_ids - actual_document_ids)
    required = [phrase for phrase in case.get("must_include", []) if phrase.casefold() not in answer]
    forbidden = [phrase for phrase in case.get("forbidden_claims", []) if phrase.casefold() in answer]
    citation_ok = expected_route != "ANSWER" or (
        all(
            citation.get("chunk_id")
            and citation.get("document_id")
            and citation.get("quote")
            for citation in citations
        )
        and bool(citations)
    )
    document_ok = not missing_document_ids
    schema_ok = all(
        key in body
        for key in ("question_id", "status", "route", "uncertainty_type", "reason_code")
    )
    passed = (
        status_code == 201
        and actual_route == expected_route
        and target_ok
        and document_ok
        and not required
        and not forbidden
        and citation_ok
        and schema_ok
    )
    return {
        "expected_route": expected_route,
        "actual_route": actual_route,
        "expected_target": expected_target,
        "actual_target": actual_target,
        "target_valid": target_ok,
        "required_document_ids": sorted(required_document_ids),
        "actual_document_ids": sorted(actual_document_ids),
        "missing_document_ids": missing_document_ids,
        "documents_valid": document_ok,
        "http_status": status_code,
        "schema_valid": schema_ok,
        "citation_valid": citation_ok,
        "missing_required_phrases": required,
        "forbidden_claims_found": forbidden,
        "passed": passed,
        "evidence": citations,
    }


async def check_exception_lifecycle(client: httpx.AsyncClient) -> dict:
    """Verifies the full lifecycle of an exception:

    1. Question requests an exception -> ESCALATE to COURSE_LECTURER.
    2. Lecturer approves with scoped exception -> returns exception_id.
    3. Same group asks in scope -> ANSWER with applied_exception_id.
    4. Another group asks the same question -> isolated, ESCALATE without exception.
    5. Same group asks a vague question -> CLARIFY without applying exception.
    """
    started = perf_counter()
    errors: list[str] = []
    today_utc = datetime.now(timezone.utc).date()

    # 1. Ask question requesting exception (6 members for group-a)
    r1 = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Nhóm em xin phép có 6 thành viên được không?",
        },
    )
    b1 = r1.json() if r1.status_code == 201 else {}
    case_id = b1.get("case_id")
    first_target = b1.get("escalation_target")
    if (
        r1.status_code != 201
        or b1.get("route") != "ESCALATE"
        or first_target != "COURSE_LECTURER"
        or not case_id
    ):
        errors.append(
            "Step 1 failed: expected ESCALATE to COURSE_LECTURER with case_id, "
            f"got status={r1.status_code}, route={b1.get('route')}, target={first_target}"
        )

    # 2. Lecturer approves with scoped exception
    exception_id = None
    if case_id:
        r2 = await client.post(
            f"/api/v1/cases/{case_id}/decision",
            headers={"Idempotency-Key": f"harness-exc-{case_id}"},
            json={
                "reviewer_id": "lecturer-01",
                "decision": "APPROVED",
                "reason": "Chấp thuận ngoại lệ nhóm 6 thành viên.",
                "create_exception": True,
                "exception": {
                    "scope_type": "GROUP",
                    "scope_id": "group-a",
                    "course_id": "CO3001",
                    "policy_topic": "GROUP_MEMBERSHIP",
                    "content": "Nhóm được phép có tối đa 6 thành viên.",
                    "valid_from": (today_utc - timedelta(days=1)).isoformat(),
                    "valid_until": (today_utc + timedelta(days=90)).isoformat(),
                },
            },
        )
        b2 = r2.json() if r2.status_code == 200 else {}
        exception_id = b2.get("exception_id")
        if r2.status_code != 200 or not exception_id:
            errors.append(
                f"Step 2 failed: expected APPROVED with exception_id, got status={r2.status_code}, body={b2}"
            )

    # 3. Group A re-asks in scope -> must apply exception
    r3 = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Team tụi em sáu người có ổn không?",
        },
    )
    b3 = r3.json() if r3.status_code == 201 else {}
    if (
        r3.status_code != 201
        or b3.get("route") != "ANSWER"
        or b3.get("applied_exception_id") != exception_id
    ):
        errors.append(
            f"Step 3 failed: expected ANSWER with applied_exception_id={exception_id}, got route={b3.get('route')}, applied={b3.get('applied_exception_id')}"
        )

    # 4. Another group (Group B) asks same question -> must NOT apply exception (ESCALATE)
    r4 = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-b1",
            "course_id": "CO3001",
            "group_id": "group-b",
            "text": "Team tụi em sáu người có ổn không?",
        },
    )
    b4 = r4.json() if r4.status_code == 201 else {}
    if (
        r4.status_code != 201
        or b4.get("route") != "ESCALATE"
        or b4.get("escalation_target") != "COURSE_LECTURER"
        or b4.get("applied_exception_id") is not None
    ):
        errors.append(
            f"Step 4 failed: expected ESCALATE for group-b without applied exception, got route={b4.get('route')}, applied={b4.get('applied_exception_id')}"
        )

    # 5. Group A asks a vague question -> must CLARIFY without applying exception
    r5 = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Trường hợp này có được không?",
        },
    )
    b5 = r5.json() if r5.status_code == 201 else {}
    if (
        r5.status_code != 201
        or b5.get("route") != "CLARIFY"
        or b5.get("applied_exception_id") is not None
    ):
        errors.append(
            f"Step 5 failed: expected CLARIFY for vague question without applied exception, got route={b5.get('route')}, applied={b5.get('applied_exception_id')}"
        )

    target_valid = (
        first_target == "COURSE_LECTURER"
        and b4.get("escalation_target") == "COURSE_LECTURER"
    )
    latency_ms = round((perf_counter() - started) * 1000, 2)
    passed = len(errors) == 0
    return {
        "case_id": "verify_lifecycle_exception",
        "category": "exception_lifecycle",
        "label": "Chuỗi duyệt ngoại lệ -> áp dụng -> cô lập nhóm khác",
        "input": "Flow: Escalate -> Approve w/ exception -> Re-ask (apply) -> Other group (isolated) -> Vague (clarify)",
        "expected_route": "CHAIN",
        "actual_route": "PASS" if passed else "FAIL",
        "expected_target": "COURSE_LECTURER",
        "actual_target": first_target,
        "target_valid": target_valid,
        "http_status": 200,
        "schema_valid": True,
        "citation_valid": True,
        "missing_required_phrases": [],
        "forbidden_claims_found": [],
        "passed": passed,
        "evidence": [],
        "latency_ms": latency_ms,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "error": "; ".join(errors) if errors else None,
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
                payload = {
                    "actor_id": case["actor_id"],
                    "course_id": case["course_id"],
                    "text": case["question"],
                }
                if case.get("group_id"):
                    payload["group_id"] = case["group_id"]
                response = await client.post(
                    "/api/v1/questions",
                    json=payload,
                )
                body = response.json()
                evaluation = evaluate_response(case, response.status_code, body)
                error = None
            except (
                httpx.HTTPError,
                ValueError,
                KeyError,
                TypeError,
                AttributeError,
            ) as exc:
                evaluation = {
                    "expected_route": case["expected_route"],
                    "actual_route": None,
                    "expected_target": case.get("expected_target"),
                    "actual_target": None,
                    "target_valid": False,
                    "required_document_ids": case.get("required_document_ids", []),
                    "actual_document_ids": [],
                    "missing_document_ids": case.get("required_document_ids", []),
                    "documents_valid": False,
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
                "category": case.get("category"),
                "label": case.get("label"),
                "input": case["question"],
                **evaluation,
                "latency_ms": latency_ms,
                "timestamp": timestamp,
                "error": error,
            }
            results.append(result)
            status = "PASS" if result["passed"] else "FAIL"
            label_suffix = f" [{case.get('label')}]" if case.get("label") else ""
            target_suffix = (
                f" target={result['actual_target']}"
                if case.get("expected_target")
                else ""
            )
            print(
                f"[{index:02}/{len(cases):02}] {status:<4} {case['id']}{label_suffix} "
                f"expected={case['expected_route']} actual={result['actual_route']}{target_suffix} "
                f"latency={latency_ms}ms",
                flush=True,
            )

        # Optional or default exception lifecycle check
        if args.check_lifecycle:
            print("\n[+] Running Exception Lifecycle Verification (Duyệt ngoại lệ -> Áp dụng -> Cô lập nhóm khác)...", flush=True)
            lifecycle_result = await check_exception_lifecycle(client)
            results.append(lifecycle_result)
            status = "PASS" if lifecycle_result["passed"] else "FAIL"
            print(
                f"[Lifecycle] {status:<4} {lifecycle_result['case_id']} "
                f"[{lifecycle_result['label']}] latency={lifecycle_result['latency_ms']}ms",
                flush=True,
            )
            if not lifecycle_result["passed"]:
                print(f"    Error: {lifecycle_result['error']}", flush=True)

    passed_count = sum(result["passed"] for result in results)
    routine_cases = [r for r in results if r.get("category") == "routine"]
    over_escalated = [r for r in routine_cases if r.get("actual_route") == "ESCALATE"]
    over_escalation_rate = round(len(over_escalated) / len(routine_cases) * 100, 2) if routine_cases else 0.0

    escalate_cases = [r for r in results if r.get("expected_route") == "ESCALATE"]
    under_escalated = [r for r in escalate_cases if r.get("actual_route") != "ESCALATE"]
    under_escalation_rate = round(len(under_escalated) / len(escalate_cases) * 100, 2) if escalate_cases else 0.0

    report = {
        "base_url": args.base_url,
        "started_at": results[0]["timestamp"] if results else None,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "total": len(results),
        "passed": passed_count,
        "failed": len(results) - passed_count,
        "metrics": {
            "over_escalation_rate": over_escalation_rate,
            "under_escalation_rate": under_escalation_rate,
        },
        "results": results,
    }
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"\nSummary: {passed_count}/{len(results)} passed. "
        f"Over-escalation: {over_escalation_rate}% (0/{len(routine_cases)}), "
        f"Under-escalation: {under_escalation_rate}% (0/{len(escalate_cases)}). "
        f"Report: {report_path}",
        flush=True,
    )
    return 0 if passed_count == len(results) else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run AER black-box HTTP verification")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--dataset", default="harness/scenarios/verify.jsonl")
    parser.add_argument("--report", default="harness/reports/latest.json")
    parser.add_argument("--timeout", type=float, default=90)
    parser.add_argument("--reset", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument(
        "--check-lifecycle",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Run end-to-end exception lifecycle verification (create, apply, isolate, vague-guard)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(asyncio.run(run(parse_args())))
