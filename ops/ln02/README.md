# ln02 ops

## Comm center (three baskets)

Courier + pick-up wake (Dept2 v3): `ops/ln02/comm-center/` + `install-comm-center.sh`.
Runbook: `src/docs/dabos/comm-center.md`. Clocks in `comm-center/clocks.env.example`
(not hardcoded). Env: `WAKE_<POST>_URL` / `WAKE_<POST>_KEY` (same Bearer contract as wake-if-new).
Does not touch Thu 14:00/14:30 stat scripts or Div3's jobs.

```
bash ops/ln02/install-comm-center.sh                 # plan
bash ops/ln02/install-comm-center.sh --apply         # install
bash ops/ln02/install-comm-center.sh --undo --apply  # remove
```

Also see **wake-if-new** (RR-010 item 3): `wake-if-new/` + `install-wake-if-new.sh` and
`src/docs/dabos/wake-if-new.md`.

## Checkout sync + week-close Div1 clone (RR-010 step 0)

Files installed on ln02 (user `logancontrol`, systemd --user) by `install-ln02-checkout-sync.sh`:

| Source | Installed to | What |
|---|---|---|
| `bin/dabos-checkout-sync.sh` | `~/bin/` | `git fetch` + `git merge --ff-only` for `~/Dev/logans-tools` and `~/Dev/DABOS-weekclose`. Never resets, forces, cleans or pushes. Dirty, diverged, ahead or wrong branch: logged, left untouched, `~/.local/state/dabos/checkout-sync.FAIL`. `npm ci` only when `package-lock.json` changed. |
| `bin/dabos-div1-dry-run.sh` | `~/bin/` | Read-only Div1 artifacts_indexed check for a closed week (SELECTs only). |
| `systemd/dabos-checkout-sync.{service,timer}` | `~/.config/systemd/user/` | Every 15 min at :07/:22/:37/:52. |
| `systemd/dabos-week-close-ln02.service.d/10-div1-wiki-clone.conf` | same, drop-in | `DABOS_WIKI_REPO_ROOT=%h/Dev/DABOS-weekclose` + a DABOS-only pre-sync before the close. |

The clone `~/Dev/DABOS-weekclose` comes from `git@github-dabos:A-sop/DABOS.git` (ln02's existing read-only
deploy key alias). The Seagate mirror is never fetched: the PCs' backups write it.

```
bash ops/ln02/install-ln02-checkout-sync.sh                 # plan + diff, changes nothing
bash ops/ln02/install-ln02-checkout-sync.sh --apply         # install (idempotent)
bash ops/ln02/install-ln02-checkout-sync.sh --undo --apply  # remove (clone kept)
~/bin/dabos-div1-dry-run.sh --week=2026-W44                 # read-only check
touch ~/.config/dabos/PAUSE-checkout-sync                   # pause the sync
```

## Owner and routing of `checkout-sync.FAIL`

Owner post: **Dept12 Production (Div4)**.

- The flag exists while any repo's latest recorded state is a failure (dirty, diverged, ahead, wrong
  branch, fetch or `npm ci` failed). `checkout-sync.status.json` lists every repo's latest state, not
  only this run's.
- It is cleared ONLY by a full run (all repos in `SYNC_ALL_REPOS`) in which every repo synced
  cleanly. The week-close DABOS-only pre-sync, the Thursday 13:45-15:00 skip of logans-tools, a pause
  or a week-close-running skip never clear it.
- Who reads it: the ln02 status digest (logans-tools #61) shows it as a machine alert naming the
  failing repos and the owner post; later the watchman reads it too. Nothing else pages anyone.
- What the owner does: read `~/.local/state/dabos/checkout-sync.status.json`, fix the named repo by
  hand on ln02 (the sync never resets or forces), then
  `systemctl --user start dabos-checkout-sync.service` (a full run) and check the flag is gone.

Acceptance, apply, verify and undo steps: `docs/acceptance/2026-11-01_ln02-checkout-sync-week-close-dabos-clone.ACCEPTANCE.md`.