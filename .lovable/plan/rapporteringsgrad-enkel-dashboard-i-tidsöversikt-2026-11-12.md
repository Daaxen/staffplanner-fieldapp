# Rapporteringsgrad – enkel dashboard i Tidsöversikt

## Vad du får
Överst i Tidsöversikt en ny ruta "Rapporteringsgrad" som visar, per medarbetare, hur mycket tid som rapporterats jämfört med tillgänglig tid för vald period.

```text
Rapporteringsgrad  v.46 (mån–fre)          Snitt hela teamet: 82 %
Felix A.     ██████████████████░░  36 / 40 h   90 %   (grön)
Thea P.      ██████████████░░░░░░  28 / 40 h   70 %   (gul)
Mats K.      ██████░░░░░░░░░░░░░░  12 / 32 h   38 %   (röd)  1 dag frånvaro
```

- **Tillgänglig tid** = vardagar i perioden × 8 h, minus inlagd frånvaro (semester/sjuk). Helger räknas inte, men helgtid som rapporterats räknas med.
- **Rapporterad tid** = arbetstid (restid visas inte i procenten, bara som liten extra siffra).
- **Färger:** grön ≥ 90 %, gul 60–89 %, röd < 60 %.
- Följer samma periodval och medarbetarfilter som resten av Tidsöversikt. Sorteras lägst % först så du ser vem som ligger efter.
- Klick på en rad filtrerar tabellen under på den personen.
- Uppdateras live när montörer rapporterar.
- **Fällbar flik:** rubriken "Rapporteringsgrad ▾" fäller ut och döljer rutan med ett klick. Hopfälld visas bara rubriken och teamets snitt-%. Valet sparas i webbläsaren så den förblir som du lämnade den.

## Tekniskt
- Ny komponent `src/components/timereporting/ReportingRateCard.tsx`, renderas överst i TimeOverview (ej i exportläget).
- Ny ren funktion `reportingRate(entries, installers, absences, range)` i `src/lib/timeReporting.ts` med `NORMAL_DAY_HOURS`; frånvaro hämtas via befintlig absence-data (useResourceData/useInstallers).
- Bara aktiva montörer (inga sub-vendors).
- Test i `src/test/reportingRate.test.ts`: 5 vardagar = 40 h, frånvarodag drar 8 h, helg ger 0 tillgänglig, färggränser 90/60.
