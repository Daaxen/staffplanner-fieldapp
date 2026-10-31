# Installer test – TEST-installtör (2026-10-31)

Tested as **TEST W1 B** (installer role only) in the installer app at phone size (390×844), against the live preview.
Order `TEST-installtör` (TEST-INST-01, customer "TEST – Installer Customer", 31 Oct → 2 Nov) was created by an admin and booked on TEST W1 B. No app code, schema, permissions or statuses were changed.

| ID | Area | Result |
|---|---|---|
| INST-01 | Find assigned order | PASS |
| INST-02 | Open and understand order | PASS |
| INST-03 | Operational workflow (start work / status) | **FAIL** |
| INST-04 | Report completed work (checklist, deviation) | PASS |
| INST-05 | Report time | PASS |
| INST-06 | Time correction | **FAIL** |
| INST-07 | Work report can be completed | PASS |
| INST-08 | Report persists after reload | PASS |
| INST-09 | Sign-off | PASS (customer sign-off is optional; not signed) |
| INST-10 | Complete assignment | **FAIL** |
| INST-11 | Completed data persists | PASS for what was saved; order never reached Completed |
| INST-12 | End-to-end | **FAIL** |

## Failures

### INST-03 / INST-10 – Installer cannot change the order status (release-blocking)
1. Attempted: Order → "▶ Start Project", then "Mark Complete".
2. Expected: order goes to In Progress, then Completed.
3. Actual: the screen shows "In Progress", but a red message "Could not save changes: [object Object]" appears and the database refuses the save (row-level security: installers have read-only access to orders). After reload the order is back to **Scheduled**. "Mark Complete" can therefore never be saved, and the error message stays on top of the button.
4. Where: Installer app → order → bottom button.
5. Type: Permission/role issue (+ UX: optimistic status, unreadable error). Not seen before because the main tester account is both admin and installer.

### INST-06 – Editing hours on a clock-based time entry is silently ignored
1. Attempted: More → Min tid → Redigera on the clock entry (0.03 h), set 1,5 h + description, Spara.
2. Expected: 1.5 h saved.
3. Actual: description saved, hours stayed 0.03 h; app showed it as saved. The database recalculates hours from start/end time, which the edit form doesn't show. Travel time (0.5 h) is also not shown in the edit form, though included in the total.
4. Where: Min tid edit dialog.
5. Type: Application bug / UX. No duplicate was created.

## UX findings (not fixed)
- Two different start buttons on one order: green "Starta jobb" (starts the clock, status stays Scheduled) and "▶ Start Project" (changes status). Confusing.
- Correcting time is only possible under More → Min tid; the order's Log tab only offers delete.
- After "Report deviation" the form simply clears; easy to miss that it saved (it did, with photo).
- Once after reload, Min tid briefly showed "0 h / Ingen tid registrerad" before data loaded – looks like time was lost.
- Map on the order fails to load (Google Maps key not allowed from this address).
- Double-tap on "Spara tid" created only one entry (good).

## Persistence
Report text, submitted flag, all 5 checklist items, deviation (with photo), 2 time entries and the time correction's description all persisted across reloads and fresh browser sign-ins. A real log out/log in was not tested.

## Verdict
**INSTALLER FLOW: FAIL**

Release-blocking:
1. Installers (without admin role) cannot start or complete an order – status changes are rejected and silently reverted.

Test data left in place for inspection: order TEST-installtör, customer "TEST – Installer Customer", its time entries, report and deviation.
