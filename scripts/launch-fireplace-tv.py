#!/usr/bin/env python3
"""Pointer — canonical launcher lives in DABOS.

SSOT: C:\\Dev\\DABOS\\scripts\\dept09-assets\\launch-fireplace-tv.py
Runbook: C:\\Dev\\DABOS\\docs\\reference\\dept09-assets\\fireplace-ambiance-reza-mini-2026-11-18.md
"""
from pathlib import Path
import runpy
import sys

canonical = Path(r"C:\Dev\DABOS\scripts\dept09-assets\launch-fireplace-tv.py")
if not canonical.is_file():
    sys.exit(f"Missing canonical launcher: {canonical}")
runpy.run_path(str(canonical), run_name="__main__")
