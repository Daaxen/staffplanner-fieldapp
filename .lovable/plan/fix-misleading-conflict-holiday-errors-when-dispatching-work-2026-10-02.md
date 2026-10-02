# Fix: misleading conflict/holiday errors when dispatching work orders

## What was checked
- Holidays/absences in the database: **0 rows**. No leftover mockup data there.
- Sample data file in the app: all lists (installers, orders, distances) are empty – nothing from the mockup is used.
- Existing bookings (7) all belong to real orders; none are orphaned.

So it is not mockup junk. The likely causes are:
1. **One error text for everything.** The booking rule in the database says "Booking conflict for this installer…" for both double bookings and absences, without naming which order clashes – so it reads like a holiday problem.
2. **Multi-day orders block whole days and nights.** A booking runs continuously from the first day's start time to the last day's end time (e.g. Teamsdagarna 28 Sep 08:00 → 1 Oct 20:00). Any other order for the same installer in that span – even a short evening job – is rejected.
3. **Recurring orders (MIAV Wed–Fri)** can line up against such blocks and fail one by one, giving many errors at once.

## Changes
1. **Clear error messages** – the database rule returns which order (name, dates) or which absence caused the clash; the app shows it in Swedish/English plainly ("Martin Olsson är redan bokad på Teamsdagarna 28/9–1/10").
2. **Admin override from the dispatch flow** – when a conflict appears, admins get the existing override dialog (with a reason) instead of a dead-end error.
3. **Same check before saving** – the planner warning and the database rule use the same logic, so what you see in the edit dialog is what will be accepted.
4. **Reproduce first** – before changing anything, reproduce the exact error with your orders (Teamsdagarna / MIAV / LEGO) to confirm which of the causes above it is.

## Technical details
- Update `validate_assignment()` to raise a message containing the first conflicting project name/dates or absence type (keep the conflicts JSON for the override log).
- In `bookings.ts` / GanttChart dispatch + edit save: catch the booking error, parse it, open `BookingOverrideDialog` for admins.
- Align `schedulingConflicts.installerConflicts` time-window logic with the DB (day start/end per order) so warnings match.
- Keep one continuous booking per order (no schema change); optional follow-up: per-day bookings if you want evenings free on multi-day orders.
