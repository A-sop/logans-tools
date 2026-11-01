# Acceptance: ln02 checkout sync + week-close reads a fetched DABOS clone for Div1 (RR-010 step 0)

Recorded before any code. Ordered by Logan on Sun 1 Nov 2026 14:54 Berlin via LDW Communicator
("Update ln02 and dry-run the week-close before Thursday? Yes to step 0"). Built by Div4.
Closes Div1's 1 Nov ask: logans-tools #50 (Div1 artifacts_indexed poster, merge 7d5e8bef) is merged
but not live on ln02, so the Thu 14:30 Berlin close logs `Div1 artifacts_indexed: missing_emit`.

Scope: ln02 only. ln02's week-close stays the real one. The Vercel `week-close` cron is NOT touched
here (removed in a later step, only after ln02 is verified). No Neon writes in this PR or its apply.

## Found on ln02 (read-only, Sun 1 Nov 2026 ~14:55-15:30 Berlin)

- `~/Dev/logans-tools`: origin `https://github.com/A-sop/logans-tools.git`, branch `main`, HEAD = origin/main =
  `e9220f2` (30 Oct 22:51 Berlin), tracked tree clean, last fetch 30 Oct 22:51 Berlin. Anonymous
  `git ls-remote` works (origin/main today `d18cc3b`). `package-lock.json` changed since `e9220f2`
  (`@electric-sql/pglite` devDependency), so `npm ci` is needed.
- The week-close wrapper `~/bin/dabos-week-close-ln02.sh` (not versioned in any repo) hard-codes
  `DABOS_REPO_ROOT=/mnt/backup-seagate/dabos-backups/<LDW|HZR52>/Dev/DABOS` (the Seagate mirror of the
  PCs' own DABOS working copies). It overwrites any `DABOS_REPO_ROOT` given by systemd.
- The mirror is written by the PCs' backups (LDW pushes `Dev/DABOS/docs` at Thu 14:00 and full
  backups at night). Its `.git` is a copy of LDW's clone: origin/main `2d017f3` (17 Jun), FETCH_HEAD
  1 Jun, ~345 modified tracked paths, origin over HTTPS with no credential. A fetch there would fight
  the backup (rsync overwrites `.git`) and cannot authenticate, so it is not used.
- With #50 and the mirror as root, Div1 is `NOT POSTED` (stale `.git`, fetch older than the close).
- ln02 has a DABOS deploy key behind the ssh alias `github-dabos`; `ssh -T` answers for `A-sop/DABOS`
  and `git ls-remote git@github-dabos:A-sop/DABOS.git` works (origin/main `bafe3c3`). No new secret.
- `DRY_RUN=1` in the wrapper runs every check but stops before `npm run dabos:week-close`, so it
  never reaches the Div1 code. `scripts/dabos/week-close.ts` has no `--week` argument and no dry run.

## Acceptance lines

1. `postDivisionWeeklyStats` reads the Div1 wiki source root from `DABOS_WIKI_REPO_ROOT` when set,
   else `DABOS_REPO_ROOT`, else `C:\Dev\DABOS` (unchanged default). Only Div1 uses it: ship-log,
   validation and establishment inputs stay on `DABOS_REPO_ROOT` (the mirror on ln02), unchanged.
   Exported as `resolveDiv1WikiRepoRoot(env)`; a vitest covers set / unset / blank / precedence.
2. `scripts/dabos/div1-artifacts-dry-run.ts` (`npm run dabos:div1-dry-run -- --week=YYYY-Www`) computes
   Div1 artifacts_indexed for a closed org week with the same code and env as the poster, and runs
   SELECTs only (no INSERT/UPDATE/DELETE anywhere in the file). It prints method, git ref, origin/main
   commit, fetch signal, pages start/end/added, and compares with the active Neon Div1 row for that
   week (value, `git_end_commit`, fingerprints): exit 0 = ok (and equal when a row exists),
   2 = NOT POSTED, 3 = differs from the active row, 1 = error.
3. `ops/ln02/bin/dabos-checkout-sync.sh`, for each repo in `SYNC_REPOS` (default
   `~/Dev/logans-tools ~/Dev/DABOS-weekclose`): refuses unless branch `main` is checked out and the
   tracked tree is clean; `git fetch --prune origin`; then fast-forward only (`git merge --ff-only
   origin/main`) when HEAD is an ancestor of origin/main. Diverged or local-ahead: logs, leaves the
   repo untouched, marks the repo failed. It never runs `reset`, `checkout -f`, `clean`, `push` or
   `--force`. For logans-tools, `npm ci` runs only when `package-lock.json` changed in the
   fast-forward, and `node_modules/.bin/tsx` must exist afterwards.
4. The sync writes `~/.local/state/dabos/checkout-sync.status.json` and keeps
   `~/.local/state/dabos/checkout-sync.FAIL` while any repo failed (removed on a clean run); exit code
   non-zero when a repo failed. `~/.config/dabos/PAUSE-checkout-sync` present = nothing runs, exit 0.
   It does not take the week-close lock. It skips everything while `dabos-week-close-ln02.service`
   is active/activating (except when called by that unit's ExecStartPre), and skips the logans-tools
   update (fetch included) on Thursdays 13:45-15:00 Berlin so `npm ci` never overlaps the close.
5. `dabos-checkout-sync.timer` runs the sync every 15 min at :07/:22/:37/:52 (so a fetch lands at
   14:07 and 14:22 Berlin on Thursday, after the 14:00 close and before 14:30, never at :30).
6. Drop-in `dabos-week-close-ln02.service.d/10-div1-wiki-clone.conf` sets
   `Environment=DABOS_WIKI_REPO_ROOT=%h/Dev/DABOS-weekclose` (no secret) and
   `ExecStartPre=-` one DABOS-only sync, so origin/main is fetched after the close right before the
   poster. A failed pre-sync does not stop the close (Div1 is then NOT POSTED with a reason, the
   other divisions still post). The shipped week-close unit, timer and wrapper are not edited.
7. `ops/ln02/install-ln02-checkout-sync.sh` is idempotent: without `--apply` it changes nothing and
   prints the plan plus a unified diff for every file it would install; with `--apply` it backs up
   any replaced file to `~/.local/state/dabos/bak-checkout-sync-<UTC stamp>/`, installs, clones
   `git@github-dabos:A-sop/DABOS.git` to `~/Dev/DABOS-weekclose` if absent (full history, not
   shallow; refuses if the path exists with another origin), runs `daemon-reload` and enables the
   timer. `--undo` (with `--apply`) disables the timer and removes exactly what it installed; the
   clone is left in place and named in the output. Re-running `--apply` on an installed box changes
   nothing.
8. A vitest runs the real sync script with bash on temporary git repos: behind -> fast-forwarded and
   status ok; diverged -> untouched, FAIL flag, non-zero; dirty tracked tree -> refused, untouched;
   wrong branch -> refused; PAUSE file -> no-op. Skipped where no POSIX bash exists. Full suite passes.
9. Files under `ops/ln02/` are committed with LF line endings (`ops/ln02/.gitattributes`).
10. No Neon write, no Vercel change, no secret read or printed. Nothing is applied on ln02 without a
    Dept13 PASS and Logan's merge yes; any push after a PASS needs re-validation.

## Apply steps (ln02, as logancontrol, after Dept13 PASS + merge)

1. One-off fast-forward of the deploy checkout (brings #50 and this PR):
   `cd ~/Dev/logans-tools && git status --porcelain --untracked-files=no` (must be empty) then
   `git fetch origin && git merge --ff-only origin/main && PATH="$(ls -d ~/.nvm/versions/node/*/bin | tail -1):$PATH" npm ci --no-audit --no-fund`
   and check `ls node_modules/.bin/tsx`.
2. Plan: `bash ~/Dev/logans-tools/ops/ln02/install-ln02-checkout-sync.sh` (no changes; read the diff).
3. Apply: `bash ~/Dev/logans-tools/ops/ln02/install-ln02-checkout-sync.sh --apply`.

## Verify steps

1. `bash ~/Dev/logans-tools/ops/ln02/install-ln02-checkout-sync.sh` again prints "no changes".
2. `systemctl --user list-timers dabos-checkout-sync.timer` shows the next :07/:22/:37/:52 run;
   `systemctl --user start dabos-checkout-sync.service`; `cat ~/.local/state/dabos/checkout-sync.status.json`
   shows both repos `ok`; no `checkout-sync.FAIL`.
3. `systemctl --user show dabos-week-close-ln02.service -p Environment -p ExecStartPre` shows the
   drop-in values; `systemd-analyze --user verify` on the new units prints no error.
4. Pre-close dry run (any time before Thu 5 Nov 14:00): `~/bin/dabos-div1-dry-run.sh --week=2026-W44`
   exits 0, method `git`, and equals the active W44 Div1 row in Neon (value, `git_end_commit`,
   fingerprints). This proves the #50 code path is live, the clone's origin/main is fresh, and Div1 is
   neither missing_emit nor NOT POSTED for a stale ref. W45 itself cannot be computed before its close.
5. Wrapper checks: `DRY_RUN=1 SOFT=0 STRICT=1 FORCE=1 TEST_IGNORE_EXISTING=1 DABOS_WIKI_REPO_ROOT=$HOME/Dev/DABOS-weekclose ~/bin/dabos-week-close-ln02.sh`
   ends `dry_run_ok` (no Neon writes; it overwrites week-close-ln02.status.json with the dry-run status).
6. Thu 5 Nov between 14:07 and 14:29 Berlin: `~/bin/dabos-div1-dry-run.sh --week=2026-W45` exits 0
   (no existing row yet). After 14:30: the week-close log line `Div1 artifacts_indexed=<n>` and no
   `Div1 artifacts_indexed: missing_emit` in the Dept3 crawl.

## Undo steps

1. `bash ~/Dev/logans-tools/ops/ln02/install-ln02-checkout-sync.sh --undo --apply` (timer disabled,
   units, drop-in and the two ~/bin scripts removed, `daemon-reload`). Week-close then reads the
   mirror for Div1 again (NOT POSTED, as today). Optional: `rm -rf ~/Dev/DABOS-weekclose`.
2. Code: revert the merge commit of this PR on main (no data to undo; the dry run writes nothing).
3. The one-off fast-forward of `~/Dev/logans-tools` is not undone by the script. Going back to
   `e9220f2` is `git -C ~/Dev/logans-tools checkout e9220f2` (detached) and only with Logan's yes; the sync
   then refuses to touch that checkout until `main` is checked out again.
