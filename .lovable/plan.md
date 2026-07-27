## Goal
Let installers log **time** and **expenses (incl. mileage)** in their mobile app so the office can invoice from those entries. Mock-data only, no approval flow.

## UX

### 1. Inside a project — new "Log" tab
`InstallerProjectDetail` gets a 5th tab `Log` (between Report and Sign-off). Two sub-sections:

- **Time**
  - Big **Clock In / Clock Out** button. While running: shows elapsed timer + start time; second tap stops and saves an entry (date, start, end, hours).
  - "Add manually" opens a small form: date, start time, end time (hours auto-calc), note.
  - List of entries for this project with total hours at top.
- **Expenses**
  - "+ Expense" — date, category (Materials / Travel / Parking / Meal / Other), amount (SEK), note, receipt photo (mock upload).
  - "+ Mileage" — date, km, rate (SEK/km, default 25), auto-total, note. Stored as an expense of category `mileage`.
  - List with per-category subtotals + grand total.

### 2. Top-level "Time & Expenses" tab
New tab in `InstallerApp` (icon: `Clock`), between Projects and Docs. Contents:

- **Week picker** (defaults to current week, prev/next arrows).
- **Summary cards**: Total hours · Expenses (SEK) · Mileage (km) for the selected week.
- **Grouped list** by project → entries for that week, each with quick edit/delete.
- **"+ New"** button opens a picker: choose project, then Time or Expense form (same components as project tab).

Entries created in either place share the same store, so they always match.

### 3. Bottom sticky bar unchanged
Start/Complete buttons stay; new Log tab does not add extra actions.

## Data model (mock, in-memory)

```ts
type TimeEntry = {
  id: string; projectId: string; installerId: string;
  date: string;               // YYYY-MM-DD
  startTime?: string;         // HH:MM (timer or manual)
  endTime?: string;
  hours: number;              // computed / manual
  note?: string;
  source: 'timer' | 'manual';
  createdAt: string;
};

type ExpenseCategory = 'materials' | 'travel' | 'parking' | 'meal' | 'mileage' | 'other';

type ExpenseEntry = {
  id: string; projectId: string; installerId: string;
  date: string;
  category: ExpenseCategory;
  amount: number;             // SEK (for mileage: km * rate)
  km?: number;                // mileage only
  rate?: number;              // mileage only (SEK/km)
  note?: string;
  receiptName?: string;       // mock file name
  createdAt: string;
};
```

Add `src/data/logsData.ts` with a few seeded entries against `inst-1`'s current projects so the UI is populated on first load. Persist changes in `localStorage` under `installer-logs-v1` so a page refresh keeps them.

An active timer per installer is tracked separately in memory + localStorage:
```ts
type ActiveTimer = { projectId: string; startedAt: string /* ISO */ };
```

## Files to add
```text
src/data/logsData.ts                                  // types, seeds, storage helpers
src/hooks/useInstallerLogs.ts                         // CRUD + timer, backed by localStorage
src/components/installer/logs/TimerControl.tsx        // clock in/out + elapsed display
src/components/installer/logs/TimeEntryForm.tsx       // manual time form
src/components/installer/logs/ExpenseForm.tsx         // expense + mileage form (mode prop)
src/components/installer/logs/ProjectLogTab.tsx       // used inside InstallerProjectDetail
src/components/installer/logs/LogsOverview.tsx        // top-level Time & Expenses tab
```

## Files to change
- `src/pages/InstallerApp.tsx` — add `Time & Expenses` tab + route the hook.
- `src/components/installer/InstallerProjectDetail.tsx` — add `Log` tab, mount `ProjectLogTab`.

## Out of scope
- Admin-side approvals, invoice generation, PDF export, backend persistence — flagged as next steps once the data model is confirmed.
