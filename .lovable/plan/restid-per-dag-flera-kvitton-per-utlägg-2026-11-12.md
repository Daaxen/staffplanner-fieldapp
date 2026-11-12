# Restid per dag + flera kvitton per utlägg

## 1. Restid fritt under orderns gång
Idag kräver "Spara tid" start- och sluttid, så montören kan inte lägga in bara restid en dag.

- I Rapportera → Tid: restidshjulet kan sparas ensamt för vilken dag som helst inom orderns period (även helg), utan start/slut.
- Knappen blir "Spara restid" när bara restid är ifylld, "Spara tid" när arbetstid finns.
- Flera restidsrader samma dag tillåts (t.ex. dit på morgonen, hem på kvällen); dagsummering visar "X h arbete + Y h restid".
- Restidsrader visas i listan med amber "Restid"-märkning, kan ändras/raderas och låses när ordern är Completed (som idag).
- Dagchips/grönfärg: en dag med enbart restid räknas inte som "arbetsdag med tid" (bara arbetstid gör dagen grön), så kraven ändras inte.
- Samma i Min tid (MyTime) och på sub-vendor-sidan.
- Gränser oförändrade: max 12 h restid per rad, max 24 h totalt per dag.

## 2. Utlägg: obegränsat antal bilder/skanningar
- Utläggsformuläret får "Lägg till kvitto" som kan väljas flera gånger och tar flera filer åt gången (bild eller PDF, 10 MB per fil).
- Miniatyrer med ta-bort-knapp innan sparning; befintliga utlägg kan få fler kvitton i efterhand tills ordern är låst.
- Kvittokravet uppfylls om minst ett kvitto finns.
- Alla kvitton syns i Field report, fakturaunderlag och PDF/Excel-export (antal + länkar/bilder).
- Gäller även sub-vendor-länken.

## Teknik
- Time: ta bort start/slut-kravet i ProjectLogTab/MyTime när travelHours > 0 och ingen arbetstid; skicka hours=0, start/end null. DB-triggern validate_time_entry tillåter redan detta för order-rader. Kontrollera dubblett-triggern (a_reject_duplicate_time_entry) så två restidsrader samma dag inte avvisas felaktigt (lägg note/created-baserad skillnad eller tillåt). timeDaysTone räknar bara hours > 0.
- Expenses: ny kolumn expense_entries.receipt_paths jsonb NOT NULL DEFAULT '[]', backfill från receipt_path; receipt_path markeras DEPRECATED. validate_expense_entry kollar jsonb_array_length > 0 (eller receipt_path). Uppdatera useInstallerLogs, useProjectReceipts, receipts.ts (uppladdning av flera), WorkOrderFieldReport, InvoicingView, fieldReportExport, subvendor-access.
- Tester: restid utan arbetstid sparas; kvittokrav uppfylls med flera kvitton.
