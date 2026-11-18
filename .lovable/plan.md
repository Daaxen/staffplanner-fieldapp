# Överlappande work orders och utlägg utan kvitto

## 1. Samma montör på flera work orders samma dag
**Nu:** om en montör redan är bokad på en annan order samma dag stoppas bokningen ("Bokningskrock"). Bara en admin kan boka ändå, och måste då skriva ett skäl.

**Efter ändringen:**
- En montör kan bokas på flera work orders som överlappar, även samma dag, utan stopp och utan att någon behöver skriva ett skäl.
- I Planning ligger överlappande ordrar på egna rader under montören, precis som i dag.
- Montören kan rapportera timmar på båda ordrarna samma dag. Det fungerar redan, och taket på 24 h per dag och person ligger kvar.
- **Frånvaro stoppar fortfarande.** Semester och sjukdom ger samma varning som i dag, och admin kan boka ändå med ett skäl.
- Montörsförslagen räknar fortfarande med att en montör som redan är bokad har mindre tid över.

## 2. Inget krav på kvitto för utlägg
- Montörerna kan spara utlägg utan kvitto, i alla kategorier och för alla belopp.
- Man kan fortfarande bifoga obegränsat antal kvitton.
- Stjärnan och den röda texten "Kvitto krävs" tas bort från formuläret.
- Taket för hur stort ett utlägg får vara ligger kvar.

## Teknisk sektion
- Ny migration:
  - Ändra uteslutningsregeln `assignments_no_overlap` så att den inte längre blockerar överlapp mellan ordrar. Den tas bort.
  - `validate_assignment` samlar bara in frånvaro som konflikt. Överlapp mot andra assignments räknas inte längre.
  - Sätt `expense_rules.requires_receipt = false` för alla kategorier. Det är en dataändring och görs med en vanlig fråga mot databasen. `validate_expense_entry` står kvar, så kravet kan slås på igen med data.
- `src/lib/schedulingConflicts.ts`: ta bort överlapp som blockerande konflikt. Restidskontrollen ligger kvar som varning.
- `src/lib/bookings.ts`: `findBookingConflicts` returnerar bara frånvaro.
- `src/lib/receipts.ts` och `src/lib/validation/reporting.ts` följer reglerna: `requiresReceipt` blir false.
- Uppdatera befintliga tester för krockar och kvitton, och lägg till ett test för varje regel:
  - Två överlappande ordrar på samma montör går att spara.
  - Ett utlägg utan kvitto går att spara.
- Uppdatera minnet "Scheduling & completion validation" och AGENTS.md.
