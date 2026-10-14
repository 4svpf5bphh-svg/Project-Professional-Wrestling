#!/usr/bin/env python3
"""Conservative, manually dispatched GitHub branch retirement.

Requires a reviewed register on main. No preview deployments or game code changed.
"""
import json
import os
import re
import subprocess
from pathlib import Path
from urllib.parse import quote

REGISTER = Path("docs/FINAL-GITHUB-BRANCH-DELETE-LISTS-2026-10-14.md")
MODE = os.environ.get("MODE", "preview")
CONFIRMATION = os.environ.get("CONFIRMATION", "")
REPO = os.environ["GH_REPO"]
PROTECTED = {"main", "alpha-1a", "work/neon-cleanup-batched"}
report = []

def gh(method, endpoint):
    p = subprocess.run(
        ["gh", "api", "--method", method, "--include", endpoint],
        capture_output=True, text=True,
    )
    if p.returncode:
        raise RuntimeError(p.stderr.strip()[:300])
    parts = p.stdout.split("\r\n\r\n", 1)
    if len(parts) == 1:
        parts = p.stdout.split("\n\n", 1)
    return json.loads(parts[-1]) if parts[-1].strip().startswith(("{", "[")) else {}

def api(endpoint):
    p = subprocess.run(["gh", "api", endpoint], capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(p.stderr.strip()[:300])
    return json.loads(p.stdout)

def record(name, status, reason):
    report.append({"branch": name, "status": status, "reason": reason})
    print(f"{status:9} {name}: {reason}", flush=True)

def main():
    if MODE not in {"preview", "delete"}:
        raise ValueError("Unknown mode")
    if MODE == "delete" and CONFIRMATION != "DELETE-APPROVED-174":
        raise ValueError("Delete mode requires exact confirmation")
    source = REGISTER.read_text()
    section = source.split("## LIST A", 1)[1].split("## LIST B", 1)[0]
    names = re.findall(r"^- \[ \] \[`([^`]+)`\]", section, re.M)
    if len(names) != 174 or len(set(names)) != 174:
        raise ValueError(f"Expected exactly 174 distinct approved candidates; found {len(names)}")
    repo = api(f"repos/{REPO}")
    default = repo["default_branch"]
    if default not in {"main", "alpha-1a"}:
        raise ValueError(f"Unrecognized default branch {default!r}; refusing")
    PROTECTED.add(default)
    for name in names:
        if name in PROTECTED or name.startswith("recovery/") or name.startswith("backup/"):
            record(name, "SKIP", "protected or recovery/backup name")
            continue
        encoded = quote(name, safe="")
        try:
            branch = api(f"repos/{REPO}/branches/{encoded}")
            if branch.get("protected"):
                record(name, "SKIP", "branch protection")
                continue
            sha = branch["commit"]["sha"]
            comparison = api(f"repos/{REPO}/compare/main...{encoded}")
            if comparison.get("ahead_by") != 0:
                record(name, "SKIP", "unique commits ahead of main")
                continue
            prs = api(f"repos/{REPO}/pulls?state=open&head={REPO.split('/')[0]}:{quote(name, safe='')}&per_page=100")
            if prs:
                record(name, "SKIP", "open pull request")
                continue
            if MODE == "preview":
                record(name, "READY", sha[:12])
                continue
            # Optimistic concurrency: re-read the branch immediately before deleting.
            fresh = api(f"repos/{REPO}/branches/{encoded}")
            if fresh["commit"]["sha"] != sha or fresh.get("protected"):
                record(name, "SKIP", "branch changed or became protected")
                continue
            p = subprocess.run(
                ["gh", "api", "--method", "DELETE", f"repos/{REPO}/git/refs/heads/{encoded}"],
                capture_output=True, text=True,
            )
            if p.returncode:
                record(name, "ERROR", p.stderr.strip()[:180])
            else:
                record(name, "DELETED", sha[:12])
        except Exception as exc:
            record(name, "ERROR", str(exc)[:200])
    Path("branch-retirement-report.json").write_text(json.dumps(report, indent=2) + "\n")
    counts = {s: sum(x["status"] == s for x in report) for s in ["READY", "DELETED", "SKIP", "ERROR"]}
    Path("branch-retirement-report.txt").write_text(
        f"Mode: {MODE}\nRepo: {REPO}\nCounts: {counts}\n\n" +
        "\n".join(f"{x['status']}\t{x['branch']}\t{x['reason']}" for x in report) + "\n"
    )
    print("SUMMARY", counts)
    if counts["ERROR"]:
        raise RuntimeError(f"{counts['ERROR']} branch checks or deletions failed")

if __name__ == "__main__":
    main()
