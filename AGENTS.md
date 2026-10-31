# Architecture rules
- Field report updates and uploads must preserve newer offline edits; manual submission waits for draft uploads before confirming persistence, so autosave cannot overwrite a submitted report.
- Shared snapshot triggers compare row fields through JSON rather than direct record access, because reporting tables do not all expose the same snapshot columns.
- Manual work-day shortcuts use the shared normal-day duration and fill consistent start/end times in order forms, so database hour recalculation cannot change the chosen duration.- Time-entry locking on completed orders is enforced by a DB trigger (admins/superusers exempt) and mirrored in UI via `isTimeLocked()`, so installers cannot bypass the lock from any screen.
- The commercial track is hidden behind `COMMERCIAL_TRACK_ENABLED` in src/lib/commercial.ts; data and DB rules are kept so it can be re-enabled without migrations.
