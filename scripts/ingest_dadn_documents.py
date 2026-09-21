"""Register and ingest the local DADN HK242 source documents through the public API."""

import argparse
import sys
from pathlib import Path

import httpx

DOCUMENTS = (
    {
        "id": "dadn-hk242-rubric",
        "title": "Hướng dẫn chấm bài môn Đồ án Đa ngành",
        "source_path": "data/sample-documents/dadn-2026/dadn-rubric.pdf",
    },
    {
        "id": "dadn-hk242-course-plan",
        "title": "Kế hoạch môn học Đồ án Đa ngành HK242",
        "source_path": "data/sample-documents/dadn-2026/dadn-course-plan.pdf",
    },
    {
        "id": "dadn-hk242-work-plan",
        "title": "Kế hoạch làm việc Đồ án Đa ngành HK242",
        "source_path": "data/sample-documents/dadn-2026/dadn-work-plan.pdf",
    },
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8000")
    args = parser.parse_args()

    repository_root = Path(__file__).resolve().parents[1]
    missing = [
        item["source_path"]
        for item in DOCUMENTS
        if not (repository_root / item["source_path"]).is_file()
    ]
    if missing:
        print("Missing local source documents:\n" + "\n".join(missing), file=sys.stderr)
        return 1

    with httpx.Client(base_url=args.base_url, timeout=60) as client:
        for item in DOCUMENTS:
            payload = {
                **item,
                "course_id": "DADN-HK242",
                "document_type": "PDF",
                "version": "HK242-archival",
            }
            registered = client.post("/api/v1/documents", json=payload)
            if registered.status_code not in (201, 409):
                print(f"Could not register {item['id']}: {registered.text}", file=sys.stderr)
                return 1
            ingested = client.post(f"/api/v1/documents/{item['id']}/ingest")
            if not ingested.is_success:
                print(f"Could not ingest {item['id']}: {ingested.text}", file=sys.stderr)
                return 1
            result = ingested.json()
            print(f"{item['id']}: {result['status']} ({result['chunk_count']} chunks)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
