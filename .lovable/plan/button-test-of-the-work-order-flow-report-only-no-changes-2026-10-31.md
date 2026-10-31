# Button test of the work order flow (report only, no changes)

## Goal
Find out why "Edit work order" does not work on the published site, and test every button in the work order flow. No code or data changes, only a report.

## Scope (in priority order)
1. **Planning → work order panel**: Edit work order (open, change a field, save, cancel), Dispatch, Cancel work order, Close/X, switching between the Work Orders, Projects, Installers and Clients views, and period navigation.
2. **Create work order**: open the form, the required-field checks, assigning an installer, the conflict warning and "Boka ändå", and cancelling.
3. **Orders/Projects register**: row actions, bulk actions (Cancel, assign), sorting, import/export buttons (open only, do not import), and Recurring orders (open only).
4. **Installer app (TEST W1 B)**: job card, the Rapportera buttons (Tid, Utlägg, Körning, Avvikelse, Foto, Rapport & signering), Ändra tid, and the Halvdag/Heldag presets.
5. Dashboard and follow-up are left out for now.

## How
- The tests run against both the published site and the preview, so I can tell whether the error only happens on the published site (for example, an old version).
- Signed in as the test accounts TEST W1 A (admin) and TEST W1 B (installer).
- The tests only open dialogs and then cancel them. Saving is tested only on existing TEST orders, with the original value restored afterwards.
- For each button, the test records: works / does nothing / shows an error, plus a screenshot and any console error.

## Deliverable
A short report in chat: a list of buttons that do not work, ordered by severity, with the cause where it is visible (for example, an error message or an old published version). No fixes until you approve them.
