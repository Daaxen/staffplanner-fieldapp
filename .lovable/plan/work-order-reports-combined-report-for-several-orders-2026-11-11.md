# Work order reports (combined report for several orders)

## What you get
A new **Work order reports** page under Planning (admin only).

1. **Pick orders:** a list of work orders with filters for period (this week / last week / month / custom), customer, status and free-text search. For example, type "Scandic" and choose "This week". Use the checkboxes to mark orders, or "Select all" for everything in the filtered list.
2. **Create report:** a button opens a window with:
   - **Type:** Client or Internal. This only changes the report's title.
   - **What to leave out** (checklist): Prices and amounts, Installer time comments, Deviations, Travel time and mileage, Expenses, Photos. Choosing Client ticks Prices, Comments and Deviations as a starting point, and you can change any of them. Internal starts with nothing left out.
   - **Format:** PDF or Excel.
3. **Download:** one combined file.
   - **PDF:** a cover page (customer(s), period, number of orders, grand total). Then one section per order with the report text, comments, photos, deviations and billables. It ends with a summary table, one row per order, plus the total.
   - **Excel:** a summary sheet with one row per order, and sheets for time, mileage, expenses, reports and deviations. Every sheet has an "Order" column.

The report is made from data that's already saved. Nothing is changed or stored.

## Technical
- New view `work-order-reports` in navigation.ts under Planning (admin role) and in the Index router.
- New `WorkOrderReports.tsx`: list from appData projects, filtered with `overlapsRange`, with a selection set.
- New `ReportOptionsDialog.tsx`: type, exclusion checklist with presets, format.
- Refactor `fieldReportExport.ts`:
  - pull data loading out of WorkOrderFieldReport into `loadFieldReportData(projectIds[])`, batching queries with `.in('project_id', ids)`
  - make the export functions accept many orders and an `exclude` set
  - single-order export reuses the same path
- Tests: the exclude rules (amounts hidden when prices are excluded, travel and mileage dropped) and the multi-order totals.

---

# Planning board: one-week view and weekends

## What you get
- **Week view shows exactly one week** (Monday to Sunday). Today it shows two weeks.
- **Weekends are highlighted:** Saturday and Sunday columns get a light gray shade and a "Helg" label, in Day, Week and Month view.
- **By default, orders don't run over the weekend.** An order that spans a weekend is drawn as a solid bar on weekdays and a faded dashed outline on Saturday and Sunday ("not planned"). Weekend days also don't count as required days for time reporting (already the case).
- **Active choice in the work order:** a new switch in Create and Edit work order, **"Arbete pågår över helg (lör–sön)"**. It's off by default. When it's on, the bar stays solid across the weekend with an "Inkl. helg" badge, and Saturday and Sunday count as booked days.

## Technical
- Migration: `projects.works_weekends boolean not null default false`. This is additive, so existing orders get "off".
- Map it in appData.ts (`worksWeekends`), CreateOrderDialog and EditWorkOrderDialog (Switch).
- GanttChart: in week mode, set the visible range to 7 days. Add a weekend column background (semantic token). Render each bar as segments, with weekend segments dashed when `!worksWeekends`.
- Helper `isWeekendIso(date)` in ganttDates.ts, plus tests.
- `timeDaysTone` keeps optional weekends. When `worksWeekends` is on, weekends count as required days.
