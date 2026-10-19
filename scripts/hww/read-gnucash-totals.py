#!/usr/bin/env python3
"""Read-only Assets/Liabilities totals from a GnuCash gzip book. Prints JSON only.

Refuses if .LCK exists. Copies the book to a temp file before reading.
Never writes the live book. Values stay on stdout for the HWW builder.
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import shutil
import sys
import tempfile
from collections import defaultdict
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--book", required=True)
    args = ap.parse_args()
    book = Path(args.book)
    lck = Path(str(book) + ".LCK")
    if lck.is_file():
        print(json.dumps({"ok": False, "error": "LCK_PRESENT"}))
        return 2
    if not book.is_file():
        print(json.dumps({"ok": False, "error": "BOOK_MISSING"}))
        return 3

    with tempfile.TemporaryDirectory(prefix="hww-gnucash-") as td:
        tmp = Path(td) / "book.gnucash"
        shutil.copy2(book, tmp)
        xml = gzip.decompress(tmp.read_bytes()).decode("utf-8", errors="replace")

    blocks = re.findall(r'<gnc:account version="2.0.0">.*?</gnc:account>', xml, re.S)
    guid_to_type: dict[str, str] = {}
    guid_to_name: dict[str, str] = {}
    guid_to_parent: dict[str, str] = {}
    for b in blocks:
        n = re.search(r"<act:name>(.*?)</act:name>", b)
        g = re.search(r'<act:id type="guid">(.*?)</act:id>', b)
        t = re.search(r"<act:type>(.*?)</act:type>", b)
        p = re.search(r'<act:parent type="guid">(.*?)</act:parent>', b)
        if n and g and t:
            guid_to_name[g.group(1)] = n.group(1)
            guid_to_type[g.group(1)] = t.group(1)
            if p:
                guid_to_parent[g.group(1)] = p.group(1)

    def full_path(g: str, depth: int = 0) -> str:
        if depth > 30 or g not in guid_to_name:
            return "?"
        name = guid_to_name[g]
        parent = guid_to_parent.get(g)
        if not parent or parent not in guid_to_name:
            return name
        return full_path(parent, depth + 1) + ":" + name

    # Sum splits per account (quantity in commodity units)
    balances: dict[str, int] = defaultdict(int)  # cents-ish via numeric/denom
    split_re = re.compile(
        r'<trn:split>.*?<split:account type="guid">(.*?)</split:account>.*?'
        r"<split:quantity>(.*?)</split:quantity>.*?</trn:split>",
        re.S,
    )
    for m in split_re.finditer(xml):
        acc, qty = m.group(1), m.group(2).strip()
        if "/" in qty:
            num, den = qty.split("/", 1)
            try:
                val = int(num) / int(den)
            except (ValueError, ZeroDivisionError):
                continue
        else:
            try:
                val = float(qty)
            except ValueError:
                continue
        balances[acc] += val

    assets = 0.0
    liabilities = 0.0
    asset_accounts = []
    liability_accounts = []
    for g, bal in balances.items():
        typ = guid_to_type.get(g, "")
        path = full_path(g)
        # Only leaf-ish: still include all with balances under ASSET/LIABILITY/BANK/CASH/CREDIT/PAYABLE/RECEIVABLE
        if typ in ("ASSET", "BANK", "CASH", "STOCK", "MUTUAL", "RECEIVABLE"):
            assets += bal
            if abs(bal) > 0.005:
                asset_accounts.append({"path": path, "type": typ, "balance": round(bal, 2)})
        elif typ in ("LIABILITY", "CREDIT", "PAYABLE"):
            liabilities += bal
            if abs(bal) > 0.005:
                liability_accounts.append({"path": path, "type": typ, "balance": round(bal, 2)})

    net = assets - liabilities
    print(
        json.dumps(
            {
                "ok": True,
                "assets_total": round(assets, 2),
                "liabilities_total": round(liabilities, 2),
                "net_worth": round(net, 2),
                "asset_accounts": sorted(asset_accounts, key=lambda a: a["path"]),
                "liability_accounts": sorted(liability_accounts, key=lambda a: a["path"]),
                "source": str(book),
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
