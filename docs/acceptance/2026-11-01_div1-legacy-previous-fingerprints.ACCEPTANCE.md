# Acceptance: Div1 week-close reconstructs legacy previous-week fingerprints

Recorded before any code (criterion 2). Found on ln02 1 Nov 2026: `dabos-div1-dry-run.sh
--week=2026-W44` exits 2 because the active W43 Div1 row (value 0, week-close-poster, 22 Oct)
predates `basis.page_fingerprints`. `loadPreviousDiv1Fingerprints` throws; W44 cannot verify its
posted 60. Built by Div4. Owner post: Dept12 Production (Div4).

Fingerprint function (unchanged, #50): `pageFingerprint` / `wikiPageFingerprints` in
`src/lib/dabos/artifacts-indexed.ts` — lowercase hex SHA-256 of the UTF-8 normalised wiki target
(no salt), first 16 hex chars; unique; sorted ascending.

## Acceptance lines

1. When the previous-week active Div1 row (`superseded_at is null`, Div1, department_id NULL,
   `artifacts_indexed`) **lacks** `basis.page_fingerprints` (key absent, or value null/undefined —
   the pre-fingerprint poster / W31–W43 backfill shape), the previous fingerprint set is
   **reconstructed deterministically** from the wiki git history at the previous window end
   (current window start): newest commit touching `docs/wiki/index.md` on `origin/main` with
   committer time strictly before that boundary, full history, same fetch/trust rules as #50, then
   `wikiPageFingerprints` over that index text. Never silently treat missing as an empty set.
2. The posted / dry-run result names `basis:reconstructed-prev` via `start_source:
   'reconstructed-prev'` (RESULT line: `start reconstructed-prev`).
3. Any other malformed basis where `page_fingerprints` is **present but invalid** (not an array of
   16-lowercase-hex strings) still fails closed with the existing clear reason; no reconstruction.
4. If reconstruction is impossible (not a trusted git work tree, not fetched since the previous
   close, shallow history that does not reach the snapshot, index unreadable, or source snapshot),
   fail closed with a clear reason naming reconstruction — never a silent 0.
5. Valid fingerprints on the previous row keep today’s behaviour (`start_source: 'previous_row'`).
6. Tests: (a) legacy previous row → reconstruction used and `start_source` is `reconstructed-prev`;
   (b) invalid present fingerprints → still NOT POSTED / lookup fails closed; (c) W44 = 60 either
   from a feasible in-repo fixture or documented ln02 verification. Full vitest green.
7. No Neon writes in this PR. No merge without Dept13 PASS and Logan’s own yes.

## ln02 verification (W44 = 60)

After merge and ln02 pull of main (checkout-sync / week-close DABOS clone fetched):

```bash
~/bin/dabos-div1-dry-run.sh --week=2026-W44
```

Expect exit 0, RESULT would post 60, `start reconstructed-prev` (W43 row still has no fingerprints),
and neon MATCH on value / git_end_commit / fingerprints against the active W44 row (292 fps).
W45 dry-run (previous = W44 with fingerprints) stays `start previous_row` and does not reconstruct.
