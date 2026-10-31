# Architecture rules
- Field report updates and uploads must preserve newer offline edits; manual submission waits for draft uploads before confirming persistence, so autosave cannot overwrite a submitted report.
- Shared snapshot triggers compare row fields through JSON rather than direct record access, because reporting tables do not all expose the same snapshot columns.