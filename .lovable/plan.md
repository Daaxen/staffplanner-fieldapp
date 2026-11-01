# Show the installer's report on the work order

## Where things are today
For Scandic Park, Felix has sent in his report (at 21:49), and there are 9 time rows with comments. He added no photos and logged no deviations.
- **Comments on time rows:** Tidsrapportering → Tidsöversikt (filter on Felix / Scandic Park).
- **Written report:** right now it only shows in Customer register → Customer 360 (pick the customer, then open the order), or in Field Operations → Active jobs.
- **Deviations (with photos):** Field Operations → Field deviations.

There's no single place on the work order itself, which is the gap.

## Proposal
Add a **"Field report"** section to the work order panel (Planning board and Work orders register) that shows, for each installer:
- the written installation report, and when it was sent in
- sign-offs and checklist
- photos (as thumbnails that open larger)
- comments from their time rows, by day
- any deviations on the order

This only reads what's already saved. Nothing about how reports are submitted changes.

## Technical
- New read-only `WorkOrderFieldReport` component. It reads field_reports, time_entries, deviations and documents by project_id. Photos use signed storage URLs.
- Mount it in the work order detail panel.
