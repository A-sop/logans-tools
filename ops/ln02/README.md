# ln02 ops: checkout sync + week-close Div1 clone (RR-010 step 0)

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

Acceptance, apply, verify and undo steps: `docs/acceptance/2026-11-01_ln02-checkout-sync-week-close-dabos-clone.ACCEPTANCE.md`.