"""
Flakiness Analyzer
------------------
Reads accumulated test run history (JSON Lines, one record per test per run),
computes a flip-rate flakiness score per test, and:

  1. Writes quarantine.json for any test crossing the flakiness threshold
     (Playwright reads this at run time to skip quarantined tests).
  2. Opens a GitHub issue for any newly-quarantined test (skips if an open
     issue for that test already exists).

Flip rate, not raw fail rate, is the key metric: a test that fails 100% of
the time is broken, not flaky. A flaky test is one whose outcome changes
between consecutive runs on the same code. Flip rate = (# of status changes
between consecutive runs) / (total runs - 1).

Usage:
    python flakiness_analyzer.py --history ../history/test-history.jsonl \
        --quarantine ../quarantine.json --min-runs 5 --flip-threshold 0.15
"""

import argparse
import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import urllib.request
import urllib.error


def load_history(history_path: Path) -> dict:
    """Group historical run records by test_name, preserving run order."""
    runs_by_test = defaultdict(list)
    if not history_path.exists():
        return runs_by_test

    with open(history_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            runs_by_test[record["test_name"]].append(record)

    # Ensure chronological order per test (history file is append-only,
    # but sort defensively in case of out-of-order writes).
    for test_name in runs_by_test:
        runs_by_test[test_name].sort(key=lambda r: r["timestamp"])

    return runs_by_test


def compute_flip_rate(runs: list) -> float:
    """Flip rate = fraction of consecutive run pairs where status changed."""
    if len(runs) < 2:
        return 0.0
    flips = 0
    for i in range(1, len(runs)):
        if runs[i]["status"] != runs[i - 1]["status"]:
            flips += 1
    return flips / (len(runs) - 1)


def analyze(runs_by_test: dict, min_runs: int, flip_threshold: float) -> list:
    """Return list of dicts describing tests that qualify as flaky."""
    flaky = []
    for test_name, runs in runs_by_test.items():
        if len(runs) < min_runs:
            continue  # not enough data yet to make a confident call

        flip_rate = compute_flip_rate(runs)
        pass_count = sum(1 for r in runs if r["status"] == "passed")
        fail_count = sum(1 for r in runs if r["status"] == "failed")

        if flip_rate >= flip_threshold:
            flaky.append({
                "test_name": test_name,
                "total_runs": len(runs),
                "pass_count": pass_count,
                "fail_count": fail_count,
                "flip_rate": round(flip_rate, 3),
                "last_seen": runs[-1]["timestamp"],
            })

    flaky.sort(key=lambda t: t["flip_rate"], reverse=True)
    return flaky


def write_quarantine(flaky_tests: list, quarantine_path: Path) -> None:
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "quarantined_tests": flaky_tests,
    }
    quarantine_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def get_existing_quarantine_names(quarantine_path: Path) -> set:
    if not quarantine_path.exists():
        return set()
    data = json.loads(quarantine_path.read_text(encoding="utf-8"))
    return {t["test_name"] for t in data.get("quarantined_tests", [])}


def open_github_issue(test_info: dict, repo: str, token: str) -> None:
    """Open a GitHub issue for a newly-flagged flaky test. Best-effort:
    logs and continues on failure rather than crashing the whole run."""
    url = f"https://api.github.com/repos/{repo}/issues"
    title = f"Flaky test detected: {test_info['test_name']}"
    body = (
        f"**Flakiness report**\n\n"
        f"- Test: `{test_info['test_name']}`\n"
        f"- Flip rate: {test_info['flip_rate']}\n"
        f"- Total runs analyzed: {test_info['total_runs']}\n"
        f"- Pass / Fail: {test_info['pass_count']} / {test_info['fail_count']}\n"
        f"- Last seen: {test_info['last_seen']}\n\n"
        f"This test has been auto-quarantined (see `quarantine.json`) and "
        f"skipped in CI runs until it is fixed and manually removed from quarantine."
    )
    payload = json.dumps({
        "title": title,
        "body": body,
        "labels": ["flaky-test", "auto-quarantined"],
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Opened issue for {test_info['test_name']}: status {resp.status}")
    except urllib.error.HTTPError as e:
        print(f"Failed to open issue for {test_info['test_name']}: {e}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--history", type=Path, required=True)
    parser.add_argument("--quarantine", type=Path, required=True)
    parser.add_argument("--min-runs", type=int, default=5)
    parser.add_argument("--flip-threshold", type=float, default=0.15)
    parser.add_argument("--github-repo", type=str, default=os.environ.get("GITHUB_REPOSITORY", ""))
    parser.add_argument("--github-token", type=str, default=os.environ.get("GITHUB_TOKEN", ""))
    args = parser.parse_args()

    runs_by_test = load_history(args.history)
    previously_quarantined = get_existing_quarantine_names(args.quarantine)
    flaky_tests = analyze(runs_by_test, args.min_runs, args.flip_threshold)

    write_quarantine(flaky_tests, args.quarantine)
    print(f"Analyzed {len(runs_by_test)} tests, {len(flaky_tests)} flagged as flaky.")

    newly_flagged = [t for t in flaky_tests if t["test_name"] not in previously_quarantined]
    if newly_flagged and args.github_repo and args.github_token:
        for test_info in newly_flagged:
            open_github_issue(test_info, args.github_repo, args.github_token)
    elif newly_flagged:
        print(f"{len(newly_flagged)} newly flagged, but no GITHUB_REPOSITORY/GITHUB_TOKEN set - skipping issue creation.")


if __name__ == "__main__":
    main()
