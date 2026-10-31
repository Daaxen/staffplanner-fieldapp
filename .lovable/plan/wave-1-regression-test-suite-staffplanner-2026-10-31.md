# Wave 1 regression test suite – StaffPlanner

Goal: find out whether the existing flow Customer → Work order → Booking → Time → Correction → Report → Sign-off → Invoice prep is reliable. No business logic, status, schema or permission changes to make tests pass.

## Important safety fact
Preview and the published app share **one database**. There is no separate test environment. So all test data must be clearly tagged and cleaned up:
- Customer `TEST – Golden Customer`, work order `TEST – Golden Project`, order numbers prefixed `TEST-W1-<run id>`.
- Two test installer accounts (`test-a@…`, `test-b@…`) created once, marked as test users.
- Cleanup deletes only rows linked to the tagged test customer/run id (bookings, time, mileage, expenses, reports, deviations, status events). Audit log and job metrics are immutable and will keep a trace of the test run — this is accepted and reported.
- Admin side runs as your superuser session; installer side as the two test accounts.

## Step 1–2: Inspection and Test Map (first deliverable)
Inspect routes (/app/*, /installer, /portal), tables (clients, projects, project_assignees, assignments, time_entries, field_reports, project_status_events, commercial_status_events), status lists and transition tables, roles, and the 30 existing unit tests. Produce `docs/wave1-test-map.md`:

Test ID | Area | Existing implementation | Priority | Supported?

Includes a list of requested items not currently supported (expected candidates: true logout/login inside a test for installers without passwords, invoice-prep "reacting" to corrections if it is a snapshot, multi-user conflict detection).

## Step 3: Tests
Playwright (Python, run from sandbox against localhost:8080), plus database checks after each step to compare UI vs stored data.

- P0-01 Customer → Work order (relation, reopen, reload, no duplicate, same UUID everywhere)
- P0-02 Booking sync (assign A+B, change dates, give B own days, remove B; planning, work-order view, assignments and project_assignees agree; no orphans)
- P0-03 Time reporting (A and B report, correct A; one row edited, totals right, survives reload and re-login)
- P0-04 Report + sign-off (written report required, photos/signature optional; persists after leave/reload; status correct)
- P0-05 Invoice prep (uses current hours incl. correction)
- P1-06 Double submit (rapid Save/Submit on order, booking, time, report → no duplicates)
- P1-07 Interrupted flow (edit → navigate away/reload)
- P1-08 Status flow (forward, allowed back, blocked transitions per existing rules; completion ↔ report ↔ invoice)
- P1-09 Stale data (two sessions editing same order)
- P2-10 Installer role (sees only assigned work, can report time/report, no admin/finance)
- GOLDEN – one end-to-end run of steps 1–13

Each test records: ID, area, preconditions, actions, expected, pass/fail criteria, priority; on failure prints operation, expected, actual, involved order/user ids, and saves screenshot + trace under `/tmp/browser/wave1/`.

## Step 4–5: Run and report
Run once, classify each failure A (app bug) / B (test problem) / C (missing feature) / D (environment/data). Deliver `docs/wave1-report.md` with Passed / Failed / Blocked / Not supported and likely causes for app bugs. **No fixes are applied in this task** — fixes are proposed for your approval afterwards.

## Technical details
- Test scripts live in `e2e/wave1/` (source-controlled), shared helpers for login (session minting per user), DB assertions and cleanup.
- Existing vitest suite runs too as baseline.
- Cleanup runs at start (leftovers from earlier runs) and end, filtered strictly on the TEST tag/run id.
