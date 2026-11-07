#!/usr/bin/env python3
"""Count GitHub PRs for a division updated after cursor. Prints n|iso_max. No bodies/secrets."""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

DIV_DEPTS = {
    "Div1": ["Dept1", "Dept2", "Dept3"],
    "Div2": ["Dept4", "Dept5", "Dept6"],
    "Div3": ["Dept7", "Dept8", "Dept9"],
    "Div4": ["Dept10", "Dept11", "Dept12"],
    "Div5": ["Dept13", "Dept14", "Dept15"],
    "Div6": ["Dept16", "Dept17", "Dept18"],
    "Div7": ["Dept19", "Dept20", "Dept21"],
}


def parse_cursor(raw: str) -> datetime:
    raw = (raw or "").strip() or "1970-01-01T00:00:00Z"
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return datetime(1970, 1, 1, tzinfo=timezone.utc)


def main() -> int:
    token = os.environ.get("WAKE_GITHUB_TOKEN") or ""
    div = os.environ.get("STATUS_DIVISION") or ""
    cursor = parse_cursor(os.environ.get("STATE_CURSOR") or "")
    if not token or div not in DIV_DEPTS:
        print("0|", end="")
        return 2
    depts = DIV_DEPTS[div]
    div_re = re.compile(rf"\b{re.escape(div)}\b", re.I)
    dept_re = re.compile(r"\b(" + "|".join(re.escape(d) for d in depts) + r")\b", re.I)
    n = 0
    newest: datetime | None = None
    for repo in ("A-sop/logans-tools", "A-sop/DABOS"):
        url = f"https://api.github.com/repos/{repo}/pulls?state=all&sort=updated&direction=desc&per_page=20"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "User-Agent": "dabos-wake-if-new",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                prs = json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
            return 3
        for pr in prs:
            title = pr.get("title") or ""
            upd = pr.get("updated_at") or ""
            try:
                udt = datetime.fromisoformat(upd.replace("Z", "+00:00"))
            except ValueError:
                continue
            if udt <= cursor:
                continue
            if not (div_re.search(title) or dept_re.search(title)):
                continue
            n += 1
            if newest is None or udt > newest:
                newest = udt
    stamp = newest.strftime("%Y-%m-%dT%H:%M:%SZ") if newest else ""
    print(f"{n}|{stamp}", end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
