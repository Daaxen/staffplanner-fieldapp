# Simplified installer flow: assigned order → report → done

Goal: the installer never starts or completes an order. Being assigned is enough. The installer's job is to report, and the app shows clearly when that is finished. Admin status tools stay as they are.

## What changes for the installer

1. **No more "Start Project" or "Mark Complete"** on the installer's order page or in the technician view. The installer gets no status controls anywhere in the app. Admins keep all status controls, and installer permissions are not widened.
2. **Order page, top down (phone first):**
   - What: order name, customer, work description, important notes
   - Where: address with one tap to open the map, plus the contact person
   - When: the installer's own days and times
   - **Rapportera**: one block of large buttons: Tid · Utlägg · Körning · Avvikelse · Foto · Rapport & signering
   - Project-management information (status picker, economy, other people's bookings) is hidden from installers.
3. **Timer is clearly time tracking.** The button reads "Starta tidtagning" / "Stoppa tidtagning". It never changes the order status.
4. **Time correction from the order.** A "Mina tider på denna order" list sits on the order page. Tapping an entry opens a form with start, end and travel time (in hours). Duration is calculated and shown read-only. Saving updates the same entry, so no duplicate is created. This fixes the bug from the last test where the duration you typed was ignored.
5. **Expense and mileage** open as quick forms that are already linked to the order. Each saved entry shows up straight away in a "Sparat" list on the order, with the amount, km and receipt thumbnail.
6. **Deviation confirmation.** After saving, the form is replaced by a clear "Avvikelse sparad ✓" card showing the saved summary and photos, plus a button to report another one.
7. **Photos stay optional.** Each upload shows its own progress and a confirmation tick.
8. **Sign-off.** Customer signature stays optional. The written report is still required.
9. **"Rapportering klar" state.** This is worked out from data that already exists: the written report is submitted and the required installer sign-offs are done. No new status is added. When it applies, a green banner shows "Rapportering klar – du behöver inte göra något mer här", and the job card in the list gets a "Klar" badge. The order itself keeps its admin status.
10. **No false zeros.** Time totals show a loading placeholder until the data has arrived.
11. **Map/address.** I'll check the address link on the order and fix it only if it is actually broken in the app.

## Permissions

I'll check that installer access to orders is read-only for assigned work. They can create and edit only their own time, expense, mileage, deviation, report and photo records. Nothing about pricing or billing is exposed. If anything needs tightening, it will be narrowed, never widened.

## Retest

Signed in as TEST W1 B on a phone-sized screen, using the order "TEST-installtör", I'll run INST-01…INST-14. That covers reload persistence, no duplicates, correct order linking and no status changes. I'll check the database after each step, then update `docs/installer-test-report.md` with answers to the 10 questions, the three PASS/FAIL verdicts and any remaining blockers.

## Technical details

- `InstallerProjectDetail.tsx`: remove the Start Project (~l.525) and Mark Complete (~l.550) blocks and the `onStatusChange('completed')` path. `TechnicianJob.tsx`: remove the completed-status action (~l.96). `InstallerApp.tsx`: drop the `handleStatusChange` wiring to installer views and keep the active/completed split based on the derived "done" state.
- New helper `isReportingDone(fieldReport, template)` in `completionRequirements.ts`, reusing `missingRequirements` and `submitted_at`, with unit tests.
- Time edit form: store `start_time`/`end_time`/`travel_hours`, compute `hours` from them, and update by id. Add a test for the duration calculation.
- `DeviationForm.tsx`: keep the toast and add a persistent success state.
- Reuse the existing expense, mileage, receipt and photo hooks. No new tables or reporting systems.
