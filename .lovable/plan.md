# Fix: "Assign an installer before dispatching" on staffed-looking orders

## Root cause (verified against the database)

The order SCANDIC GO Jönköping has **no installer saved anywhere**: empty in the order's stored snapshot, no rows in `project_assignees`, no rows in `assignments`. So the dispatch check is correct — the problem is that assignments can *look* saved in the planner without ever reaching the database:

1. **`loadProjects()` never reads `project_assignees`.** Assignees after a reload come only from the order's cached `data` snapshot. Anything written through the bookings/assignments path (the authoritative source since Wave 1.4) is invisible to the planner.
2. **Failed saves are not rolled back.** When a drag-assign or edit fails to persist (e.g. a booking conflict/absence rejection), a toast appears but the planner keeps showing the installer assigned. After reload the assignment is gone — the screen and the database disagree.
3. **No obvious assign UI in the order panel/edit dialog.** `EditWorkOrderDialog` has no installer field, so the likely place a user "assigns" doesn't exist; the only paths are drag-drop in the Installers view or installer pick at creation.
4. **Stale detail panel.** Assigning via drag while the order panel is open doesn't update the open panel, so Dispatch checks an outdated copy of the order.

## Fix

### 1. Load assignees from the database
- Extend `loadProjects()` in `src/lib/appData.ts` to also fetch `project_assignees` and merge those installer ids into each project's `assigneeIds` (database wins over the cached snapshot).

### 2. Roll back optimistic state when saving fails
- In `useProjects`' setter / `diffAndPersist`: on persist error, restore the previous project list, notify listeners, and show the existing error toast — so what you see is always what's saved.

### 3. Add installer assignment to the edit dialog
- `EditWorkOrderDialog` gets an installer multi-select (same installer list, with conflict warnings via `installerConflicts`), saved through the same `handleUpdateProject` → booking sync path, so assignment from the panel persists exactly like drag-drop.

### 4. Keep the open panel and dispatch check fresh
- `handleDispatchProject` looks up the current order from `projectsList` by id instead of trusting the (possibly stale) panel prop.
- `handleDropProject` updates `selectedProject` when the dragged order is the open one.

## Out of scope
- No changes to booking conflict rules, override flow, or dispatch notifications.
- No database schema changes (all tables already exist).

## Verification
- Typecheck + full test suite (148 tests).
- Browser check: create a TEST order, assign an installer three ways (drag, create dialog, edit dialog), reload, confirm the assignment survives, and dispatch succeeds; then unassign and confirm dispatch is blocked with the same message. Clean up TEST data afterwards.
