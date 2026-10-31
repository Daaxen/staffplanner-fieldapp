# Wave 1 continuation report

## Release gate: INCONCLUSIVE — suite incomplete
Baseline rerun: **30 files / 201 tests passed**, 2.99s (`/tmp/wave1-vitest.log`). No app, schema, permission, or status changes made. TEST A session restored successfully; real admin session not used. Previous authentication and cleanup blockers are resolved.

Test | Result | Classification / scope
---|---|---
P0-01 | Blocked | B: customer creation and REST persistence assertion succeeded; order automation incomplete
P0-02 | Blocked | B: no persisted Golden order; booking actions not executed
P0-03 | Blocked | B: time workflow not executed
P0-04 | Blocked | B: report/sign-off not executed
P0-05 | Blocked | B: invoice assertions not executed
P1-06 | Blocked | B: rapid submissions not executed
P1-07 | Blocked | B: interrupted edits not executed
P1-08 | Blocked | B: status transitions not executed
P1-09 | Blocked | B: two-context edits not executed
P2-10 | Blocked | B: TEST B role isolation not executed
GOLDEN | Blocked | B: customer step only; not end-to-end

Passed 0 complete scenarios; Failed 0 established app failures; Blocked 11; Not supported 0 established. These are implementation limitations, NOT renewed environment blockers. The requested full suite was not implemented or run. No application defect is established.

## Actual actions and evidence
Restored TEST A localStorage session and visited clients, planner, orders, and my-time. Created two TEST – Golden Customer records through New client → Save, with customer numbers TEST-W1-1793440640 and TEST-W1-1793440688. REST reads confirmed persistence. First order-picker attempt used an incorrect exact text selector; second encountered duplicate accessible names; narrowed to run-specific customer number. Final order form remained disabled. Source requires template mandatory fields as well as dates and linked client; runner did not finish satisfying those preconditions. This is B, not evidence of failed order persistence. No order submission succeeded.

Current evidence: `/tmp/browser/wave1/P0-01-form.png`, `P0-01-form.txt`, `P0-01-current.zip`, `created-clients.json`, `cleanup-current.json`. Older per-case artifacts/results in that directory belong to the preceding blocked run; do not represent current coverage. Traces can contain authenticated browser state: keep private.

## Cleanup
Deleted only captured customer IDs after confirming zero referencing projects:
- 011ae4b4-950c-4392-97cc-8d0712db3530
- f7820210-d582-4833-908b-387fec5faf51
Post-delete REST reads returned [] for both. Initial combined name filter matched nothing (Unicode URL encoding issue); corrected to captured IDs after readback verified exact names and run numbers. No project, booking, time, report, or status rows created. Both TEST users left untouched. No real customer/order was modified.

## Proposed next changes — test files only
Repository unchanged. Proposed files remain under `/tmp/wave1-proposed/`.
- `e2e/wave1/run.py`: replace incomplete creation block with template-aware mandatory-field completion; wrap every browser action in try/finally trace capture and captured-ID cleanup; restore dynamic run IDs (current diagnostic draft pins its run ID and is not reusable).
- Implement the remaining scenario actions and DB assertions before claiming suite completion; current helper and diagnostic finish.py are not a comprehensive runner.
- `docs/wave1-test-map.md`: retain implementation/status mapping, replace obsolete session/cleanup blockers with the continuation note.
- `docs/wave1-report.md`: use this full staged replacement.
No app-code replacement is proposed without a reproduced defect. Stale-write protection and installer authorization remain unverified, not confirmed missing features.
