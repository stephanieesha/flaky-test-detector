"""
Parses Playwright's JUnit XML report and appends one JSON-line record per
test case to the history file. Run this immediately after `playwright test`
in CI, before the analyzer.

Usage:
    python record_run.py --junit ../results/junit.xml --history ../history/test-history.jsonl
"""

import argparse
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path


def parse_junit(junit_path: Path, run_id: str) -> list:
    tree = ET.parse(junit_path)
    root = tree.getroot()
    timestamp = datetime.now(timezone.utc).isoformat()

    records = []
    # Playwright's JUnit reporter nests <testcase> under <testsuite> under <testsuites>
    for testcase in root.iter("testcase"):
        classname = testcase.get("classname", "")
        name = testcase.get("name", "unknown")
        test_name = f"{classname} > {name}" if classname else name

        status = "passed"
        if testcase.find("failure") is not None or testcase.find("error") is not None:
            status = "failed"
        elif testcase.find("skipped") is not None:
            status = "skipped"

        records.append({
            "test_name": test_name,
            "status": status,
            "run_id": run_id,
            "timestamp": timestamp,
        })
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--junit", type=Path, required=True)
    parser.add_argument("--history", type=Path, required=True)
    parser.add_argument("--run-id", type=str, default=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S"))
    args = parser.parse_args()

    args.history.parent.mkdir(parents=True, exist_ok=True)
    records = parse_junit(args.junit, args.run_id)

    # Skip quarantined-and-therefore-not-run tests: JUnit simply won't list them,
    # so nothing extra to filter here - they naturally stop accumulating history,
    # which is correct (we don't want the quarantine itself to look like a "pass").
    with open(args.history, "a", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record) + "\n")

    print(f"Recorded {len(records)} test results from run {args.run_id}.")


if __name__ == "__main__":
    main()
