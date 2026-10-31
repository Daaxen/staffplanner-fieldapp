# Lås tid när ordern är klar eller attesterad

## Vad som räknas som "låst"
En order låses för montörens tidsändringar när något av detta gäller:
- Ordern har status **Completed** (klar), eller
- Ordern har gått vidare till **Ready For Invoice** eller senare (Invoiced, Paid, Closed) — det är "attesterad".

Om ordern öppnas igen (status tillbaka) blir tiden fri att ändra igen.

## Montören
- Pennan "Ändra tid" byts mot en låsikon på tider som hör till en låst order (orderns tidlista, Tid-fliken "Recent time" och Min tid).
- Trycker man på den visas: "Ordern är klar/attesterad. Kontakta admin om tiden behöver ändras."
- Det går inte heller att lägga till eller ta bort tid på en låst order.
- Spärren gäller även i databasen, så den kan inte kringgås.

## Admin
- Kan alltid ändra, lägga till och ta bort tid.
- Får en gul varning i ändra-dialogen: "Ordern är redan stängd (Completed / Ready For Invoice …). Ändringen påverkar redan attesterade siffror." Spara fungerar ändå.
- Ändringen loggas i revisionsloggen som vanligt.

## Technical details
- DB: utöka `validate_time_entry()` (BEFORE INSERT/UPDATE/DELETE) — om projektet är låst och användaren inte är admin/superuser → RAISE `TIME_LOCKED`. Samma för expense/mileage? Nej, bara tid (enligt önskemål).
- Ny hjälpfunktion `isTimeLocked(project)` i `src/lib/timeReporting.ts` + test (completed → låst, ready_for_invoice → låst, in_progress → öppen).
- UI: `EditTimeDialog`, `ProjectLogTab`, `LogsOverview`, `MyTime` visar lås/varning; `TIME_LOCKED` översätts till svensk text.
