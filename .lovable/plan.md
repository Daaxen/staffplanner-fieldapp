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
