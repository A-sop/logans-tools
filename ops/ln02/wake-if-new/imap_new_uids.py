#!/usr/bin/env python3
"""Count IMAP UIDs greater than a cursor. Prints JSON: {"n":N,"max_uid":M}. No bodies."""
from __future__ import annotations

import imaplib
import json
import os
import ssl
import sys


def main() -> int:
    host = os.environ.get("WAKE_MAIL_IMAP_HOST") or os.environ.get("MAIL_TRIAGE_IMAP_HOST") or ""
    port = int(os.environ.get("WAKE_MAIL_IMAP_PORT") or os.environ.get("MAIL_TRIAGE_IMAP_PORT") or "993")
    user = os.environ.get("WAKE_MAIL_IMAP_USER") or os.environ.get("MAIL_TRIAGE_IMAP_USER") or ""
    password = os.environ.get("WAKE_MAIL_IMAP_PASSWORD") or os.environ.get("MAIL_TRIAGE_IMAP_PASSWORD") or ""
    folder = os.environ.get("WAKE_MAIL_IMAP_FOLDER") or os.environ.get("MAIL_TRIAGE_IMAP_FOLDER") or "INBOX"
    cursor = os.environ.get("STATE_CURSOR") or "0"
    try:
        cursor_uid = int(cursor)
    except ValueError:
        cursor_uid = 0

    if not host or not user or not password:
        print(json.dumps({"error": "missing-imap-env"}), file=sys.stderr)
        return 2

    ctx = ssl.create_default_context()
    client = imaplib.IMAP4_SSL(host, port, ssl_context=ctx)
    try:
        client.login(user, password)
        typ, _ = client.select(folder, readonly=True)
        if typ != "OK":
            print(json.dumps({"error": "select-failed"}), file=sys.stderr)
            return 3
        # UID SEARCH for UIDs strictly after cursor
        criteria = f"UID {cursor_uid + 1}:*"
        typ, data = client.uid("SEARCH", None, criteria)
        if typ != "OK":
            print(json.dumps({"error": "search-failed"}), file=sys.stderr)
            return 4
        raw = (data[0] or b"").decode("ascii", "ignore").strip()
        uids = [int(x) for x in raw.split() if x.isdigit() and int(x) > cursor_uid]
        max_uid = max(uids) if uids else cursor_uid
        print(json.dumps({"n": len(uids), "max_uid": max_uid}))
        return 0
    finally:
        try:
            client.logout()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
