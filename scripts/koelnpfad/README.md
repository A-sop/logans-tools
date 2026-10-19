# Kölnpfad route builder

Personal helper: builds hike/bike GPX + KML + progress CSV for the Kölnpfad
(OSM relation 54726) into `C:\DATA\10_WORK\lifestack\koelnpfad\`.

```powershell
python scripts/koelnpfad/build_koelnpfad_routes.py --out C:\DATA\10_WORK\lifestack\koelnpfad
```

Flags: `--skip-elevation` `--skip-pois` `--skip-bike` `--skip-geocode-check`

Licence of generated tracks: ODbL (OpenStreetMap). Generator code: MIT same as repo.
