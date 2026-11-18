# Kostnader i Tidsöversikt

## Vad du får
- Nya kolumner i tabellen: **Utlägg (kr)**, **Mil (km)**, **Mil (kr)** och **Traktamente (kr)**.
- Kostnaderna läggs på samma rad som tiden när det är samma montör, order och dag.
- Kostnader utan tidsrad samma dag visas som egna rader (tomma timmar) så inget försvinner.
- Filtren (period, medarbetare, kund, projekt, order) gäller även kostnaderna. Testdata döljs som vanligt.
- Nya summarutor överst: Utlägg, Mil och Traktamente för vald period.
- Kolumnerna går att sortera och följer med i XLSX-exporten.

## Teknisk sektion
- useTimeReporting hämtar också expense_entries, mileage_entries och per_diem_entries för perioden (samma sandbox-filter och realtid).
- Ny ren funktion i src/lib/timeReporting.ts som slår ihop kostnader per (installer, order, datum) med tidsraderna och skapar egna rader för kostnader utan tid; test i src/test.
- TimeOverview: nya kolumner, summor och EXPORT_COLUMNS utökas.
