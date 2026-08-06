# Time, Cost & Mileage Reporting with Admin Invoicing Summary

Installers log hours, third-party costs and mileage per project in the app. Admins get a follow-up view that summarizes everything per client/project/installer/period and exports it for invoicing. Rates live on the client card.

## Installer app

Two missing log screens are re-created (they are currently referenced but absent, which breaks the preview):

- **Project > Log tab** — for the open project: start/stop timer, manual time entry (date, start, end, auto-calculated hours, note), add expense (category, amount, note, optional receipt name), add mileage (km x client rate). Lists that project's entries with delete.
- **Time tab (top level)** — all my entries across projects, grouped by week: total hours, total expenses, total mileage; filter by project and date range.

Everything switches from local device storage to the database, scoped so an installer only sees and edits their own entries.

## Client rates

Client card gets a Rates section:
- Hourly rate (SEK/h)
- Mileage rate (SEK/km) — used to price mileage entries
- Optional overtime/weekend rate
- VAT % applied in summaries

Rates are captured on each entry when logged, so later rate changes don't rewrite historical amounts.

## Admin: Invoicing & Follow-up

New sidebar section "Invoicing":
- Filters: date range, client, project, installer, entry type
- Summary cards: total hours, labour cost, expenses, mileage cost, VAT, grand total
- Grouped table: by client > project > installer, with drill-down to individual entries
- Follow-up flags: projects marked complete with no time reported, entries missing notes/receipts
- Export: XLSX and CSV of the current selection (both a summary sheet and a line-item sheet)

## Technical notes

Database (all with row-level access rules; installers read/write own rows, admins read all):
- `time_entries` — project_id, installer_id, date, start_time, end_time, hours, note, source (timer/manual), hourly_rate_snapshot
- `expense_entries` — project_id, installer_id, date, category (materials/travel/parking/meal/other), amount, note, receipt_url
- `mileage_entries` — project_id, installer_id, date, km, rate_snapshot, amount, from/to note
- `active_timers` — installer_id (unique), project_id, started_at
- `clients` gains `hourly_rate`, `mileage_rate`, `overtime_rate`, `vat_percent`
- Storage bucket for receipt photos, private, installer-scoped paths

Frontend:
- Rewrite `src/hooks/useInstallerLogs.ts` against the database (react-query style fetch + mutations) keeping the existing API shape
- New `src/components/installer/logs/ProjectLogTab.tsx` and `LogsOverview.tsx`
- New `src/components/admin/InvoicingView.tsx` + registration in `AppSidebar.tsx` / `Index.tsx`
- Reuse the existing `xlsx` dependency for export
