#!/usr/bin/env python3
"""Build Kölnpfad hike/bike GPX + KML + progress CSV from OSM relation 54726.

Source: OpenStreetMap relation 54726 (Kölnpfad), ODbL 1.0.
© OpenStreetMap contributors — https://www.openstreetmap.org/copyright

Usage:
  python build_koelnpfad_routes.py --out C:\\DATA\\10_WORK\\lifestack\\koelnpfad
  python build_koelnpfad_routes.py --osm path\\to\\relation-54726-full.osm --out ...
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

OSM_RELATION_ID = "54726"
OSM_FULL_URL = f"https://www.openstreetmap.org/api/0.6/relation/{OSM_RELATION_ID}/full"
ATTRIBUTION = (
    "© OpenStreetMap contributors (ODbL 1.0). "
    "Route: OSM relation 54726 Kölnpfad / Kölner Eifelverein. "
    "https://www.openstreetmap.org/copyright"
)

# Official 11 stages (de.wikipedia.org/wiki/Kölnpfad, lengths are published approx).
# Endpoints are place anchors used to split the continuous OSM track.
STAGES: list[dict] = [
    {"n": 1, "from": "Rodenkirchener Rheinbrücke", "to": "Klettenberg", "wiki_km": 22},
    {"n": 2, "from": "Klettenberg", "to": "Bocklemünd", "wiki_km": 18},
    {"n": 3, "from": "Bocklemünd", "to": "Roggendorf/Thenhoven", "wiki_km": 16},
    {"n": 4, "from": "Roggendorf/Thenhoven", "to": "Merkenich", "wiki_km": 11},
    {"n": 5, "from": "Merkenich", "to": "Mülheim Wiener Platz", "wiki_km": 13},
    {"n": 6, "from": "Mülheim Wiener Platz", "to": "Dünnwald", "wiki_km": 14},
    {"n": 7, "from": "Dünnwald", "to": "Thielenbruch", "wiki_km": 12},
    {"n": 8, "from": "Thielenbruch", "to": "Bensberg", "wiki_km": 18},
    {"n": 9, "from": "Bensberg", "to": "Wahn", "wiki_km": 18},
    {"n": 10, "from": "Wahn", "to": "Zündorf", "wiki_km": 20},
    {"n": 11, "from": "Zündorf", "to": "Rodenkirchener Rheinbrücke", "wiki_km": 9},
]

# Nominatim-friendly queries for stage ends (Cologne area).
STAGE_END_QUERIES: list[str] = [
    "Rodenkirchener Brücke, Köln",
    "Klettenbergpark, Köln",
    "Bocklemünd, Köln",
    "Thenhoven, Köln",
    "Merkenich, Köln",
    "Wiener Platz, Köln-Mülheim",
    "Dünnwald, Köln",
    "Thielenbruch, Köln",
    "Schloss Bensberg, Bergisch Gladbach",
    "Wahn, Köln",
    "Zündorf, Köln",
    "Rodenkirchener Brücke, Köln",  # close loop
]

# Places Logan's screenshot named — sanity check against the loop.
SCREENSHOT_PLACES = [
    "Thenhoven",
    "Langel",
    "Rheinkassel",
    "Merkenich",
    "Leverkusen",
    "Auweiler",
    "Sielsdorf",
    "Gleuel",
    "Stotzheim",
]

BROUTER_URL = "https://brouter.de/brouter"
USER_AGENT = "DABOS-koelnpfad-builder/1.0 (personal; contact via github.com/A-sop)"


@dataclass
class Pt:
    lon: float
    lat: float
    ele: float | None = None
    name: str | None = None

    def as_tuple(self) -> tuple[float, float]:
        return (self.lon, self.lat)


def haversine_m(a: Pt, b: Pt) -> float:
    r = 6371000.0
    p1, p2 = math.radians(a.lat), math.radians(b.lat)
    dphi = math.radians(b.lat - a.lat)
    dl = math.radians(b.lon - a.lon)
    x = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(x)))


def path_length_m(pts: list[Pt]) -> float:
    return sum(haversine_m(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def elev_gain_m(pts: list[Pt], min_step_m: float = 3.0) -> float:
    """Cumulative ascent; ignore DEM jitter below min_step_m (EU-DEM noise)."""
    gain = 0.0
    prev = None
    for p in pts:
        if p.ele is None:
            continue
        if prev is not None:
            d = p.ele - prev
            if d > min_step_m:
                gain += d
        prev = p.ele
    return gain


def http_get(url: str, timeout: int = 120) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def http_post(url: str, data: bytes, content_type: str, timeout: int = 120) -> bytes:
    req = urllib.request.Request(
        url,
        data=data,
        headers={"User-Agent": USER_AGENT, "Content-Type": content_type},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def ensure_osm(osm_path: Path) -> Path:
    if osm_path.exists() and osm_path.stat().st_size > 1000:
        return osm_path
    osm_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading OSM relation {OSM_RELATION_ID} full…", file=sys.stderr)
    raw = http_get(OSM_FULL_URL, timeout=180)
    osm_path.write_bytes(raw)
    print(f"Wrote {osm_path} ({len(raw)} bytes)", file=sys.stderr)
    return osm_path


def build_track_from_osm(osm_path: Path) -> tuple[list[Pt], dict[str, str], list[dict]]:
    """Return ordered track points, relation tags, and way segment metadata."""
    nodes: dict[str, Pt] = {}
    ways: dict[str, list[str]] = {}
    way_tags: dict[str, dict[str, str]] = {}
    members: list[tuple[str, str, str]] = []  # type, ref, role
    rel_tags: dict[str, str] = {}

    for event, elem in ET.iterparse(str(osm_path), events=("end",)):
        # Only handle top-level OSM objects. Clearing nested member/nd/tag
        # would wipe their attribs before the parent end event.
        if elem.tag == "node":
            nodes[elem.get("id")] = Pt(float(elem.get("lon")), float(elem.get("lat")))
            elem.clear()
        elif elem.tag == "way":
            wid = elem.get("id")
            ways[wid] = [nd.get("ref") for nd in elem.findall("nd")]
            way_tags[wid] = {t.get("k"): t.get("v") for t in elem.findall("tag")}
            elem.clear()
        elif elem.tag == "relation" and elem.get("id") == OSM_RELATION_ID:
            rel_tags = {t.get("k"): t.get("v") for t in elem.findall("tag")}
            for m in elem.findall("member"):
                members.append((m.get("type"), m.get("ref"), m.get("role") or ""))
            elem.clear()

    track: list[Pt] = []
    segments: list[dict] = []
    last: Pt | None = None

    for typ, ref, role in members:
        if typ != "way" or ref not in ways:
            continue
        node_ids = ways[ref]
        pts = [nodes[nid] for nid in node_ids if nid in nodes]
        if len(pts) < 2:
            continue
        # Orient way to continue from last point.
        if last is not None:
            d_start = haversine_m(last, pts[0])
            d_end = haversine_m(last, pts[-1])
            if d_end < d_start:
                pts = list(reversed(pts))
                node_ids = list(reversed(node_ids))
        tags = way_tags.get(ref, {})
        bicycle_ok = _bicycle_allowed(tags)
        # Skip duplicate join node.
        start_i = 0
        if last is not None and haversine_m(last, pts[0]) < 2.0:
            start_i = 1
        for p in pts[start_i:]:
            track.append(p)
        last = pts[-1]
        segments.append(
            {
                "way_id": ref,
                "role": role,
                "highway": tags.get("highway", ""),
                "bicycle": tags.get("bicycle", ""),
                "foot": tags.get("foot", ""),
                "bicycle_ok": bicycle_ok,
                "n_pts": len(pts) - start_i,
            }
        )

    return track, rel_tags, segments


def _bicycle_allowed(tags: dict[str, str]) -> bool:
    hw = tags.get("highway", "")
    bic = tags.get("bicycle", "")
    if bic in ("yes", "designated", "permissive"):
        return True
    if bic in ("no", "dismount"):
        return False
    if hw in ("steps", "ladder"):
        return False
    if hw == "footway":
        # Urban footways without explicit bicycle=* → detour candidate.
        return False
    if hw == "path" and tags.get("foot") == "designated" and bic == "":
        return False
    if tags.get("access") == "no":
        return False
    return True


def simplify(pts: list[Pt], min_dist_m: float = 8.0) -> list[Pt]:
    if not pts:
        return []
    out = [pts[0]]
    for p in pts[1:]:
        if haversine_m(out[-1], p) >= min_dist_m:
            out.append(p)
    if pts[-1] is not out[-1]:
        out.append(pts[-1])
    return out


def enrich_elevation(pts: list[Pt], chunk: int = 90) -> None:
    """Fill ele via OpenTopoData EU-DEM (free, rate-limited)."""
    if not pts:
        return
    base = "https://api.opentopodata.org/v1/eudem25m"
    for i in range(0, len(pts), chunk):
        batch = pts[i : i + chunk]
        locs = "|".join(f"{p.lat},{p.lon}" for p in batch)
        url = f"{base}?locations={urllib.parse.quote(locs)}"
        try:
            raw = http_get(url, timeout=60)
            data = json.loads(raw.decode("utf-8"))
            results = data.get("results") or []
            for p, r in zip(batch, results):
                elev = r.get("elevation")
                if elev is not None:
                    p.ele = float(elev)
        except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError, ValueError) as e:
            print(f"Elevation batch failed at {i}: {e}", file=sys.stderr)
        time.sleep(1.05)  # free API courtesy


def geocode(query: str) -> Pt | None:
    q = urllib.parse.urlencode(
        {"q": query, "format": "json", "limit": 1, "countrycodes": "de"}
    )
    url = f"https://nominatim.openstreetmap.org/search?{q}"
    try:
        raw = http_get(url, timeout=30)
        data = json.loads(raw.decode("utf-8"))
        if not data:
            return None
        return Pt(float(data[0]["lon"]), float(data[0]["lat"]), name=query)
    except Exception as e:
        print(f"geocode fail {query}: {e}", file=sys.stderr)
        return None
    finally:
        time.sleep(1.1)


def nearest_index(track: list[Pt], target: Pt) -> int:
    best_i, best_d = 0, float("inf")
    for i, p in enumerate(track):
        d = haversine_m(p, target)
        if d < best_d:
            best_d, best_i = d, i
    return best_i


def split_stages(track: list[Pt], anchors: list[Pt]) -> list[list[Pt]]:
    """anchors length = 12 (stage starts + final close)."""
    idxs = [nearest_index(track, a) for a in anchors]
    # Enforce monotonic indices for a loop-ish path; wrap stage 11 across end.
    # Rotate track so first anchor is index 0.
    rot = idxs[0]
    rotated = track[rot:] + track[:rot]
    # Recompute idxs on rotated track.
    idxs = [nearest_index(rotated, a) for a in anchors]
    # Force first=0, last=len-1
    idxs[0] = 0
    idxs[-1] = len(rotated) - 1
    for i in range(1, len(idxs)):
        if idxs[i] <= idxs[i - 1]:
            # push forward to next distinct point
            idxs[i] = min(len(rotated) - 1, idxs[i - 1] + 50)
    stages: list[list[Pt]] = []
    for i in range(len(idxs) - 1):
        a, b = idxs[i], idxs[i + 1]
        seg = rotated[a : b + 1]
        if len(seg) < 2:
            seg = rotated[a : min(len(rotated), a + 2)]
        stages.append(seg)
    return stages


def write_gpx(
    path: Path,
    track_pts: list[Pt],
    name: str,
    waypoints: list[Pt] | None = None,
    desc: str | None = None,
) -> None:
    def esc(s: str) -> str:
        return (
            s.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
        )

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="DABOS koelnpfad builder" '
        'xmlns="http://www.topografix.com/GPX/1/1" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 '
        'http://www.topografix.com/GPX/1/1/gpx.xsd">',
        f"  <metadata><name>{esc(name)}</name>",
        f"  <desc>{esc(desc or ATTRIBUTION)}</desc>",
        f"  <copyright author=\"OpenStreetMap contributors\"><year>2026</year>"
        f"<license>https://opendatacommons.org/licenses/odbl/</license></copyright>",
        "  </metadata>",
    ]
    for wp in waypoints or []:
        lines.append(f'  <wpt lat="{wp.lat:.7f}" lon="{wp.lon:.7f}">')
        if wp.ele is not None:
            lines.append(f"    <ele>{wp.ele:.1f}</ele>")
        if wp.name:
            lines.append(f"    <name>{esc(wp.name)}</name>")
        lines.append("  </wpt>")
    lines.append(f'  <trk><name>{esc(name)}</name><trkseg>')
    for p in track_pts:
        if p.ele is not None:
            lines.append(
                f'    <trkpt lat="{p.lat:.7f}" lon="{p.lon:.7f}"><ele>{p.ele:.1f}</ele></trkpt>'
            )
        else:
            lines.append(f'    <trkpt lat="{p.lat:.7f}" lon="{p.lon:.7f}"></trkpt>')
    lines.extend(["  </trkseg></trk>", "</gpx>"])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_kml(path: Path, stages: list[tuple[str, list[Pt]]], pois: list[Pt]) -> None:
    def esc(s: str) -> str:
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<kml xmlns="http://www.opengis.net/kml/2.2">',
        "<Document>",
        f"<name>Kölnpfad overview</name>",
        f"<description>{esc(ATTRIBUTION)}</description>",
    ]
    for name, pts in stages:
        coords = " ".join(f"{p.lon:.6f},{p.lat:.6f},{p.ele or 0:.1f}" for p in pts)
        parts.append(f"<Folder><name>{esc(name)}</name>")
        parts.append(
            f"<Placemark><name>{esc(name)}</name>"
            f"<LineString><tessellate>1</tessellate>"
            f"<coordinates>{coords}</coordinates></LineString></Placemark>"
        )
        parts.append("</Folder>")
    if pois:
        parts.append("<Folder><name>Points of interest</name>")
        for p in pois:
            parts.append(
                f"<Placemark><name>{esc(p.name or 'POI')}</name>"
                f"<Point><coordinates>{p.lon:.6f},{p.lat:.6f},0</coordinates></Point>"
                f"</Placemark>"
            )
        parts.append("</Folder>")
    parts.extend(["</Document>", "</kml>"])
    path.write_text("\n".join(parts) + "\n", encoding="utf-8")


def fetch_nearby_pois(track: list[Pt], radius_m: int = 80) -> list[Pt]:
    """Sample every ~2 km and query Overpass for amenity=drinking_water|restaurant|cafe and public_transport."""
    if len(track) < 2:
        return []
    samples: list[Pt] = []
    acc = 0.0
    samples.append(track[0])
    for i in range(1, len(track)):
        acc += haversine_m(track[i - 1], track[i])
        if acc >= 2000:
            samples.append(track[i])
            acc = 0.0
    samples.append(track[-1])

    pois: list[Pt] = []
    seen: set[tuple[float, float]] = set()
    for s in samples[:40]:  # cap queries
        q = f"""
[out:json][timeout:25];
(
  node(around:{radius_m},{s.lat},{s.lon})[amenity~"^(drinking_water|restaurant|cafe|fast_food)$"];
  node(around:{radius_m},{s.lat},{s.lon})[public_transport=stop_position];
  node(around:{radius_m},{s.lat},{s.lon})[highway=bus_stop];
  node(around:{radius_m},{s.lat},{s.lon})[railway=station];
);
out body 40;
"""
        try:
            body = ("data=" + urllib.parse.quote(q)).encode("ascii")
            raw = http_post(
                "https://overpass-api.de/api/interpreter",
                body,
                "application/x-www-form-urlencoded",
                timeout=40,
            )
            data = json.loads(raw.decode("utf-8"))
            for el in data.get("elements") or []:
                if "lat" not in el:
                    continue
                key = (round(el["lat"], 5), round(el["lon"], 5))
                if key in seen:
                    continue
                seen.add(key)
                tags = el.get("tags") or {}
                label = tags.get("name") or tags.get("amenity") or tags.get("highway") or "stop"
                kind = tags.get("amenity") or tags.get("public_transport") or tags.get("railway") or tags.get("highway")
                pois.append(Pt(float(el["lon"]), float(el["lat"]), name=f"{kind}: {label}"))
        except Exception as e:
            print(f"POI query skip: {e}", file=sys.stderr)
        time.sleep(1.0)
    return pois


def brouter_leg(a: Pt, b: Pt, profile: str = "trekking") -> list[Pt] | None:
    lonlats = f"{a.lon},{a.lat}|{b.lon},{b.lat}"
    qs = urllib.parse.urlencode(
        {
            "lonlats": lonlats,
            "profile": profile,
            "alternativeidx": "0",
            "format": "gpx",
        }
    )
    url = f"{BROUTER_URL}?{qs}"
    try:
        raw = http_get(url, timeout=90)
        if b"<trkpt" not in raw:
            return None
        root = ET.fromstring(raw)
        pts: list[Pt] = []
        for trkpt in root.iter():
            if not str(trkpt.tag).endswith("trkpt"):
                continue
            pts.append(Pt(float(trkpt.get("lon")), float(trkpt.get("lat"))))
        return pts if len(pts) >= 2 else None
    except Exception as e:
        print(f"BRouter fail: {e}", file=sys.stderr)
        return None


def build_bike_track(track: list[Pt], segments: list[dict]) -> tuple[list[Pt], list[str]]:
    """Follow hike geometry; detour via BRouter across contiguous bicycle-blocked ways."""
    # Map each track point index range is hard without way→point links; approximate:
    # rebuild by walking segments in order with stored point counts.
    bike: list[Pt] = []
    detours: list[str] = []
    # Reconstruct per-segment slices from track using n_pts.
    idx = 0
    i = 0
    while i < len(segments):
        seg = segments[i]
        n = int(seg["n_pts"])
        slice_pts = track[idx : idx + n]
        idx += n
        if seg["bicycle_ok"] or len(slice_pts) < 2:
            if bike and slice_pts and haversine_m(bike[-1], slice_pts[0]) < 2:
                bike.extend(slice_pts[1:])
            else:
                bike.extend(slice_pts)
            i += 1
            continue
        # Collect contiguous blocked run.
        j = i
        blocked_pts: list[Pt] = list(slice_pts)
        while j + 1 < len(segments) and not segments[j + 1]["bicycle_ok"]:
            j += 1
            bn = int(segments[j]["n_pts"])
            more = track[idx : idx + bn]
            idx += bn
            if more:
                if blocked_pts and haversine_m(blocked_pts[-1], more[0]) < 2:
                    blocked_pts.extend(more[1:])
                else:
                    blocked_pts.extend(more)
        a = blocked_pts[0]
        b = blocked_pts[-1]
        if bike:
            a = bike[-1]
        routed = brouter_leg(a, b, profile="trekking")
        km = path_length_m(blocked_pts) / 1000.0
        if routed:
            if bike and haversine_m(bike[-1], routed[0]) < 5:
                bike.extend(routed[1:])
            else:
                bike.extend(routed)
            detours.append(
                f"Detour {len(detours)+1}: hike-blocked ~{km:.2f} km "
                f"({a.lat:.5f},{a.lon:.5f}) → ({b.lat:.5f},{b.lon:.5f}) via BRouter trekking"
            )
        else:
            # Fallback: keep hike line but mark.
            if bike and blocked_pts and haversine_m(bike[-1], blocked_pts[0]) < 2:
                bike.extend(blocked_pts[1:])
            else:
                bike.extend(blocked_pts)
            detours.append(
                f"Detour {len(detours)+1}: BRouter failed; kept hike line for ~{km:.2f} km "
                f"(manual check needed) ({a.lat:.5f},{a.lon:.5f})→({b.lat:.5f},{b.lon:.5f})"
            )
        time.sleep(0.4)
        i = j + 1
    return bike, detours


def write_readme(path: Path, meta: dict) -> None:
    text = f"""# Kölnpfad route pack (hike + bike)

Generated for Logan's personal Garmin / Komoot / Google My Maps / OsmAnd use.

## Source and licence

- **Track:** OpenStreetMap relation [{OSM_RELATION_ID}](https://www.openstreetmap.org/relation/{OSM_RELATION_ID}) (Kölnpfad), operator Kölner Eifelverein
- **Licence:** [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors
- **Stages:** names/order from [de.wikipedia.org/wiki/Kölnpfad](https://de.wikipedia.org/wiki/K%C3%B6lnpfad) (CC BY-SA)
- **Bike detours:** [BRouter](https://brouter.de/) `trekking` profile where OSM tags mark footpath-only / steps / `bicycle=no`
- **Elevation:** OpenTopoData EU-DEM 25 m (where available)

Do not scrape login-gated tour sites. Prefer regenerating from OSM.

## Files

| File | Use |
|------|-----|
| `koelnpfad-full-hike.gpx` | Full loop + stage / amenity waypoints |
| `koelnpfad-stage-01.gpx` … `-11.gpx` | One official stage each |
| `koelnpfad-bike.gpx` | Bike-legal variant (detours listed in `bike-detours.md`) |
| `koelnpfad-overview.kml` | Google My Maps (stages as folders) |
| `koelnpfad-progress.csv` | Tick-off sheet |
| `training-plan.md` | 8–12 week hike build |
| `SOURCE.md` | Machine-readable provenance |

## Totals (this build)

- Hike length: **{meta.get('hike_km', '?')} km**
- Hike elevation gain: **{meta.get('hike_gain_m', '?')} m**
- Bike length: **{meta.get('bike_km', '?')} km**
- Bike detours: **{meta.get('n_detours', '?')}**

## Import

### Garmin Connect → device
1. Open [Garmin Connect](https://connect.garmin.com/) → **Training** → **Courses** → **Import**
2. Upload a `.gpx` (full or a stage)
3. Open the course → **Send to Device** (watch / Edge paired)

### Komoot
1. **Plan** → **Import GPX**
2. Choose hike or bike sport matching the file
3. Save as tour; sync to phone

### Google My Maps
1. [Google My Maps](https://www.google.com/mymaps) → **Create a new map**
2. **Import** → `koelnpfad-overview.kml`
3. Stages appear as layers/folders; share privately

### OsmAnd / Organic Maps
- OsmAnd: **Configure map** → **Tracks** → import GPX from device storage
- Organic Maps: bookmark / open GPX via Files app share sheet

## Progress

Edit `koelnpfad-progress.csv` — fill `date_done_hike` / `date_done_bike` (ISO dates) and notes.

## Regenerate

From logans-tools (or this folder):

```powershell
python scripts/koelnpfad/build_koelnpfad_routes.py --out C:\\DATA\\10_WORK\\lifestack\\koelnpfad
```

Optional: `--skip-elevation` `--skip-pois` `--skip-bike` for a faster rebuild.
"""
    path.write_text(text, encoding="utf-8")


def write_training_plan(path: Path) -> None:
    path.write_text(
        """# Kölnpfad hiking training plan (8–12 weeks)

Realistic build for urban/suburban hiking with public-transport stage ends. No race focus.

## Assumptions

- Baseline: comfortable with a **10 km** walk on mixed paths
- One long day on weekends; one mid-week walk
- Stages themselves are the training (Wikipedia lengths ~9–22 km)

## Schedule

| Week | Mid-week | Weekend long | Goal |
|------|----------|--------------|------|
| 1 | 8–10 km easy (any green belt) | Stage 11 (~9 km) or Stage 4 (~11 km) | Habit + shoes |
| 2 | 10 km | Stage 7 (~12 km) | Steady pace |
| 3 | 10–12 km | Stage 5 or 6 (~13–14 km) | Pack + water habit |
| 4 | 12 km | Stage 3 (~16 km) | First “half day” |
| 5 | Rest or 8 km easy | Stage 2 (~18 km) | Back-to-back prep |
| 6 | 10 km | Stage 9 (~18 km) Königforst/Wahner Heide | Terrain practice |
| 7 | 12 km | Stage 8 (~18 km) | Hills / Hardt |
| 8 | 10 km | Stage 10 (~20 km) | Longest mid-tier |
| 9 (optional) | Rest | Stage 1 (~22 km) | Longest single stage |
| 10 (optional) | Easy 8 km | Back-to-back: Stage 11 + Stage 1 (or 4+5) | Consecutive days |
| 11–12 (optional) | Easy | Two medium stages back-to-back (e.g. 6+7) | Loop readiness |

## Rules of thumb

- If a stage feels hard, repeat it before moving up
- Hot days: start early; Merkenich / Rhine stretches have little shade
- Rain: Wahner Heide and field sections get muddy — shorter stage OK
- Bike project is separate: do not mix long bike + long hike the same weekend until week 8+

## Tick-off

Use `koelnpfad-progress.csv` after each stage.
""",
        encoding="utf-8",
    )


def write_progress_csv(path: Path, stage_stats: list[dict]) -> None:
    fields = [
        "stage",
        "km",
        "climb_m",
        "start",
        "end",
        "public_transport",
        "date_done_hike",
        "date_done_bike",
        "notes",
    ]
    # Rough PT hints from Wikipedia stage ends.
    pt = {
        1: "Stadtbahn 16 (Heinrich-Lübke-Ufer / Klettenbergpark area)",
        2: "Stadtbahn 1 / 3/4 (Müngersdorf / Bocklemünd)",
        3: "Bus / S11 Worringen area (Thenhoven)",
        4: "Stadtbahn 12 Merkenich",
        5: "Stadtbahn 13/18 Slabystr.; Wiener Platz Mülheim",
        6: "S6 Stammheim; Linie 4 Nittumer Weg area",
        7: "Stadtbahn 3/18 Thielenbruch",
        8: "Stadtbahn 1 Bensberg",
        9: "Bus / local to Wahn",
        10: "Stadtbahn 7 Zündorf area",
        11: "Stadtbahn 16 / 7 corridor to Rodenkirchen bridge",
    }
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for s in stage_stats:
            w.writerow(
                {
                    "stage": s["n"],
                    "km": f"{s['km']:.2f}",
                    "climb_m": f"{s['climb_m']:.0f}",
                    "start": s["from"],
                    "end": s["to"],
                    "public_transport": pt.get(s["n"], ""),
                    "date_done_hike": "",
                    "date_done_bike": "",
                    "notes": "",
                }
            )


def screenshot_place_hits(track: list[Pt]) -> list[str]:
    """Geocode screenshot places and report distance to nearest track point."""
    lines = []
    for name in SCREENSHOT_PLACES:
        q = f"{name}, Köln" if name != "Leverkusen" else "Leverkusen, Deutschland"
        p = geocode(q)
        if not p:
            lines.append(f"{name}: geocode miss")
            continue
        i = nearest_index(track, p)
        d_km = haversine_m(track[i], p) / 1000.0
        flag = "ON_LOOP" if d_km < 3.0 else ("NEAR" if d_km < 8.0 else "OFF_LOOP")
        lines.append(f"{name}: {d_km:.1f} km to track ({flag})")
    return lines


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--out",
        type=Path,
        default=Path(r"C:\DATA\10_WORK\lifestack\koelnpfad"),
    )
    ap.add_argument(
        "--osm",
        type=Path,
        default=Path(
            r"C:\DATA\10_WORK\dabos-worker\away-run-2026-10-19\koelnpfad-scratch\relation-54726-full.osm"
        ),
    )
    ap.add_argument("--skip-elevation", action="store_true")
    ap.add_argument("--skip-pois", action="store_true")
    ap.add_argument("--skip-bike", action="store_true")
    ap.add_argument("--skip-geocode-check", action="store_true")
    args = ap.parse_args()

    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)
    cache = out / "_cache"
    cache.mkdir(exist_ok=True)

    osm_path = ensure_osm(args.osm if args.osm else cache / "relation-54726-full.osm")
    # Prefer copying into cache for reproducibility
    cached_osm = cache / "relation-54726-full.osm"
    if osm_path.resolve() != cached_osm.resolve():
        cached_osm.write_bytes(osm_path.read_bytes())

    print("Building ordered track from OSM…", file=sys.stderr)
    track, rel_tags, segments = build_track_from_osm(cached_osm)
    if len(track) < 100:
        print(f"ERROR: track too short ({len(track)} pts)", file=sys.stderr)
        return 1
    track = simplify(track, min_dist_m=6.0)
    print(f"Track points after simplify: {len(track)}", file=sys.stderr)

    if not args.skip_elevation:
        print("Enriching elevation…", file=sys.stderr)
        enrich_elevation(track)

    print("Geocoding stage anchors…", file=sys.stderr)
    anchors: list[Pt] = []
    for q in STAGE_END_QUERIES:
        p = geocode(q)
        if p is None:
            print(f"ERROR: cannot geocode {q}", file=sys.stderr)
            return 1
        anchors.append(p)

    stages_pts = split_stages(track, anchors)
    # Rotate full hike so it starts at Rodenkirchen bridge
    start_i = nearest_index(track, anchors[0])
    full = track[start_i:] + track[:start_i]
    # Ensure closed loop visually
    if haversine_m(full[0], full[-1]) > 50:
        full = full + [full[0]]

    waypoints: list[Pt] = []
    for i, s in enumerate(STAGES):
        wp = Pt(stages_pts[i][0].lon, stages_pts[i][0].lat, stages_pts[i][0].ele, name=f"Etappe {s['n']} Start: {s['from']}")
        waypoints.append(wp)
    waypoints.append(
        Pt(stages_pts[-1][-1].lon, stages_pts[-1][-1].lat, stages_pts[-1][-1].ele, name="Etappe 11 Ende: Rodenkirchener Rheinbrücke")
    )

    pois: list[Pt] = []
    if not args.skip_pois:
        print("Fetching nearby POIs (water/food/PT)…", file=sys.stderr)
        pois = fetch_nearby_pois(full)
        waypoints.extend(pois[:80])

    write_gpx(
        out / "koelnpfad-full-hike.gpx",
        full,
        "Kölnpfad full hike",
        waypoints=waypoints,
    )

    stage_stats: list[dict] = []
    kml_stages: list[tuple[str, list[Pt]]] = []
    for s, pts in zip(STAGES, stages_pts):
        km = path_length_m(pts) / 1000.0
        climb = elev_gain_m(pts)
        stage_stats.append(
            {
                "n": s["n"],
                "from": s["from"],
                "to": s["to"],
                "km": km,
                "climb_m": climb,
                "wiki_km": s["wiki_km"],
            }
        )
        fname = out / f"koelnpfad-stage-{s['n']:02d}.gpx"
        wps = [
            Pt(pts[0].lon, pts[0].lat, pts[0].ele, name=f"Start: {s['from']}"),
            Pt(pts[-1].lon, pts[-1].lat, pts[-1].ele, name=f"End: {s['to']}"),
        ]
        write_gpx(
            fname,
            pts,
            f"Kölnpfad Etappe {s['n']}: {s['from']} → {s['to']}",
            waypoints=wps,
            desc=f"{km:.1f} km, ~{climb:.0f} m gain. {ATTRIBUTION}",
        )
        kml_stages.append((f"Etappe {s['n']}", pts))

    write_kml(out / "koelnpfad-overview.kml", kml_stages, pois[:60])
    write_progress_csv(out / "koelnpfad-progress.csv", stage_stats)
    write_training_plan(out / "training-plan.md")

    bike_pts: list[Pt] = []
    detours: list[str] = []
    if not args.skip_bike:
        print("Building bike variant (BRouter detours)…", file=sys.stderr)
        # Rebuild unsimplified segment-aligned track for bike mapping
        raw_track, _, segs = build_track_from_osm(cached_osm)
        bike_pts, detours = build_bike_track(raw_track, segs)
        bike_pts = simplify(bike_pts, min_dist_m=8.0)
        if not args.skip_elevation:
            enrich_elevation(bike_pts)
        write_gpx(out / "koelnpfad-bike.gpx", bike_pts, "Kölnpfad bike-legal", desc=ATTRIBUTION)
        (out / "bike-detours.md").write_text(
            "# Bike detours\n\n" + ("\n".join(f"- {d}" for d in detours) or "- none") + "\n",
            encoding="utf-8",
        )
    else:
        (out / "bike-detours.md").write_text("# Bike detours\n\nSkipped (--skip-bike).\n", encoding="utf-8")

    hike_km = path_length_m(full) / 1000.0
    hike_gain = elev_gain_m(full)
    bike_km = path_length_m(bike_pts) / 1000.0 if bike_pts else None

    place_report = []
    if not args.skip_geocode_check:
        print("Screenshot place check…", file=sys.stderr)
        place_report = screenshot_place_hits(full)

    meta = {
        "hike_km": f"{hike_km:.1f}",
        "hike_gain_m": f"{hike_gain:.0f}",
        "bike_km": f"{bike_km:.1f}" if bike_km is not None else "n/a",
        "n_detours": str(len(detours)),
        "relation_tags": rel_tags,
        "n_track_pts": len(full),
        "place_check": place_report,
        "stages": stage_stats,
    }
    write_readme(out / "README.md", meta)
    (out / "SOURCE.md").write_text(
        f"""# Provenance

- OSM relation: {OSM_RELATION_ID}
- Download: {OSM_FULL_URL}
- Licence: ODbL 1.0
- Operator tag: {rel_tags.get('operator', '')}
- Mapped length (waymarkedtrails UI, 2026-10-19): ~159 km
- Wikipedia published length: 171 km (official planning figure; OSM geometry may differ)
- Generator: logans-tools `scripts/koelnpfad/build_koelnpfad_routes.py`

## Screenshot place proximity

{chr(10).join('- ' + x for x in place_report) or '- skipped'}

## Stage table (measured from this OSM build)

| Stage | From | To | km (OSM) | climb_m | wiki_km |
|------:|------|----|---------:|--------:|--------:|
"""
        + "\n".join(
            f"| {s['n']} | {s['from']} | {s['to']} | {s['km']:.2f} | {s['climb_m']:.0f} | {s['wiki_km']} |"
            for s in stage_stats
        )
        + f"\n\n**Total hike:** {hike_km:.2f} km, gain {hike_gain:.0f} m\n",
        encoding="utf-8",
    )
    (out / "build-meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(json.dumps({"ok": True, "out": str(out), "hike_km": hike_km, "hike_gain_m": hike_gain, "bike_km": bike_km, "detours": len(detours)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
