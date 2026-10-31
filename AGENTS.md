# Architecture rules
- Field report updates and uploads must preserve newer offline edits; manual submission waits for draft uploads before confirming persistence, so autosave cannot overwrite a submitted report.
- Shared snapshot triggers compare row fields through JSON rather than direct record access, because reporting tables do not all expose the same snapshot columns.
- Manual work-day shortcuts use the shared normal-day duration and fill consistent start/end times in order forms, so database hour recalculation cannot change the chosen duration.