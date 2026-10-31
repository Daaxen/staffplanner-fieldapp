# Lås tid när ordern är klar + förenkla statusar

## 1. Förenkla statusar
- Det ekonomiska spåret (Quote → Order Received → … → Ready For Invoice → Invoiced → Paid → Closed) döljs i hela systemet för nu: inga kolumner, filter, knappar, historikrutor eller pipeline-siffror.
- Arbetsstatusen ("Completed" som sista steg) blir den enda som syns.
- Inget raderas – data ligger kvar så att det kan slås på igen senare.

## 2. Lås tid när ordern är Completed
- När ordern har status **Completed** kan montören inte längre ändra, lägga till eller ta bort tid på den.
- Pennan "Ändra tid" byts mot en låsikon (orderns tidlista, Tid-fliken "Recent time" och Min tid). Tryck visar: "Ordern är klar. Kontakta admin om tiden behöver ändras."
- Öppnas ordern igen blir tiden fri igen.
- Spärren gäller även i databasen, så den kan inte kringgås.

## 3. Admin
- Kan alltid ändra, lägga till och ta bort tid.
- Får en gul varning i ändra-dialogen: "Ordern är redan klar. Ändringen påverkar redan stängda siffror." Spara fungerar ändå.

## Technical details
- Feature flag `COMMERCIAL_TRACK_ENABLED = false` i `src/lib/commercial.ts`; alla UI-ställen som visar commercial status (OrdersRegister, ProjectDetailPanel, dashboards, InvoicePrep m.fl.) renderas villkorat. DB-trigger för commercial lämnas orörd.
- DB: utöka tidsvalidering (BEFORE INSERT/UPDATE/DELETE på time_entries) — om projektets status = 'completed' och användaren inte är admin/superuser → RAISE `TIME_LOCKED`.
- `isTimeLocked(project)` i `src/lib/timeReporting.ts` + test (completed → låst, in_progress → öppen).
- `EditTimeDialog`, `ProjectLogTab`, `LogsOverview`, `MyTime` visar lås/varning; `TIME_LOCKED` översätts till svensk text.
