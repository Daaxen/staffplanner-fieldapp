# Rapporteringsgrad – periodval och separata totaler

## Periodval
Överst i Tidsöversikt läggs knappar: **Vecka · Halvmånad · Månad**, med pilar ‹ › för föregående/nästa period och en etikett, t.ex. "v.46 (9–15 nov)", "1–15 nov", "november 2026".
- Vecka = måndag–söndag.
- Halvmånad = 1–15 eller 16–sista dagen i månaden.
- Månad = hela kalendermånaden.
- Valet styr Från/Till-datumen (som finns kvar för egna intervall) och därmed både rapporteringsgraden och tabellen.

## Arbetstid och restid helt separerade
Varje rad i Rapporteringsgrad får två egna kolumner med var sin stapel och total:

```text
             Arbetstid                      Restid
Felix A.     ████████████░  36 / 40 h  90 %   ███░░  6 h
Thea P.      ████████░░░░░  28 / 40 h  70 %   █░░░░  2 h
---------------------------------------------------------
Teamet       Arbetstid 64 / 80 h  80 %        Restid 8 h
```
- Arbetstid: procent mot tillgänglig tid och färg (grön/gul/röd) som idag.
- Restid: egen amber-stapel och egen summa i timmar, ingen procent och ingen färgbedömning.
- Hopfällt läge visar båda totalerna: "Arbetstid 80 % · Restid 8 h".
- Ingen sammanlagd total (arbetstid + restid) i rutan.

## Tekniskt
- Ny ren funktion `periodRange(kind, anchor)` och `shiftPeriod` i `src/lib/timeReporting.ts`; test för vecka (mån–sön), halvmånad (1–15, 16–30/31, februari) och månad.
- `ReportingRateCard` får två kolumner och en teamrad; TimeOverview får periodknapparna och sätter from/to.
