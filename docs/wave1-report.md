# Wave 1 regression report – 2026-10-31

Runner: `python3 e2e/wave1/backend_suite.py` (replays the app's own write paths as TEST W1 A / TEST W1 B and checks what is stored). Baseline: `bunx vitest run` – 30 files, 201 tests pass.
Test data: customer "TEST – Golden Customer", order "TEST – Golden Project" (ref TEST-W1-<run>). Everything created was deleted at the end of the run (no orders or customers left over). Rows in the audit log can't be removed, so they stay as a record of the test run.

## Release gate: NOT MET (one release-blocking bug)

| Test | Pri | Result | Class | Finding |
|---|---|---|---|---|
| P0-01 Customer → work order | P0 | PASS | – | Linked by client_id, saving again with the same ref gives no duplicate, the UUID stays the same |
| P0-02 Booking sync | P0 | PASS | – | Assign A+B, change dates/times, remove B: bookings = assignees each step, no orphans |
| P0-03 Time + correction | P0 | PASS | – | Correction edits the same row; total 13.5 h; B sees only own time, cannot edit A's |
| P0-04 Report + sign-off | P0 | **FAIL** | **A** | Report and sign-off persist, but **setting the order to Completed fails** |
| P0-05 Invoice prep inputs | P0 | PASS | – | Uses the corrected hours (13.5 h × 600 = 8 100) |
| P1-06 Double submit | P1 | FAIL | A (minor) | Orders, bookings and reports: no duplicates. Two time rows saved at the same instant both get stored; only the UI's saving lock prevents this |
| P1-07 Interrupted flow | P1 | NOT RUN | – | Needs UI automation; covered partly by existing unit tests for offline report saving |
| P1-08 Status flow | P1 | BLOCKED | – | Could not reach Completed because of the P0-04 bug |
| P1-09 Stale data | P1 | FAIL | A | Saving an older copy of an order overwrites a newer edit (last save wins, no warning) |
| P2-10 Installer role | P2 | PASS | – | B sees only assigned order, cannot edit it, cannot read client rates or create customers |
| GOLDEN | P0 | **FAIL** | A | Steps 1–9 and 11 pass; step 10 (complete order) fails – same bug as P0-04 |

## Bug 1 (release-blocking): orders with reported time cannot be completed
- Error: `null value in column "entity_type" of relation "audit_log"`.
- Likely cause: on completion, the system copies the order's figures into the AI-planning statistics. The audit-log trigger on that table was created without the entity-name argument, so the audit write is rejected and the whole completion is rolled back. The statistics table holds 0 rows today, which means no order has been completed since the trigger was added.
- Proposed fix: recreate the audit trigger on the statistics table with the entity name (e.g. `audit_row_change('job_metrics','order_id')`) and add a test for it.

## Bug 2: stale save overwrites newer edits (P1)
The work-order save sends the entire order every time. Two people editing the same order means the last save silently wins. Proposed fix: compare the order's `updated_at` before saving and show "the order was changed by someone else".

## Bug 3: time entries saved twice in the same instant (P1, low)
Time entries have no natural key. Today only the disabled Save button stops a double tap, so a double tap on a slow phone could still give two rows. Proposed fix: send a client-generated id per save, or add a short duplicate check.

## Not currently supported / not covered
- UI-level interrupted-flow and two-browser tests (P1-07, the UI half of P1-09) are not automated yet.
- Invoice-prep amounts are worked out live in the browser; no stored invoice copy exists to check against.
