# Acceptance: 2026-10-31 gfp-live W27-W42 supersede-and-repost (Dept11, not applied)

Recorded before any code for this correction (Dept13 criterion 2). Requested by Div7 2026-10-31;
basis: founder rulings 2026-10-30 (stat week closes Thu 14:00 Berlin; leads count in the week they
arrived, bookings in the week they were booked). Model: scripts/dabos/sql/2026-10-31_supersede_gfp_live_w43_w44.sql (#45).

Acceptance line:

> After applying, gfp-live W27–W42 have exactly one non-superseded row per metric per week, with recorded_at at that week's Thursday-14:00-Berlin close minus 1 ms and the same values as before; the old rows are marked superseded and not deleted; no gfp-live row's recorded_at falls inside a later week's window.

Not applied to any database. Applying needs a Dept13 PASS and Logan's explicit yes to the merge.
