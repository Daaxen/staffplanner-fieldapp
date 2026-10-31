# Färger per dag, färg i undersidorna och fetare text

## 1. Tid-knappen följer orderns dagar
- **Grön:** alla montörens dagar fram till idag har sparad tid.
- **Gul:** några dagar har tid, men minst en saknar.
- **Blå:** ingen tid alls än.
- Bara montörens egna dagar räknas (även om han har "egna dagar" på ordern). Framtida dagar räknas inte förrän de har passerat.
- Under knappen står t.ex. **"2 av 3 dagar"** så man ser vad som fattas.
- Utlägg, Körning och Foto: grön när något är sparat, som idag. De hör inte till varje dag. Avvikelse är fortfarande röd.

## 2. Färg i undersidorna
- **Dagväljaren under Tid:** varje dag får en färgad ruta: grön = tid sparad, blå = ingen tid, grå = framtida dag.
- **Sparade rader (Tid, Utlägg, Körning):** grön kant till vänster. Låsta rader (klar order) blir grå med låsikon.
- **Tid-fliken och Min tid:** samma gröna kant på raderna. Sammanfattningen överst blir grön.
- **Avvikelse:** röd rubrikrad, och allvarlighetsgraden visas i färg (gul / orange / röd).
- **Rapport & signering:** varje krav visar grön bock när det är klart och röd ruta när det saknas. Valfria saker är grå.
- **Spara-knapparna** i undersidorna blir gröna.

## 3. Fetare text där det hjälper
- **Fet stil:** ordernamn, datum och tid, timsummor ("7,5 h"), statusbrickor, rubriker i undersidorna och dagarna i dagväljaren.
- Hjälptexten är fortfarande vanlig text så den feta stilen sticker ut.

Layout och knappar ändras inte, bara färg och typsnittets tjocklek.

## Tekniskt
- `src/lib/installerTone.ts`: ny `timeDaysTone(days, entries, today)`. Den returnerar `{ tone, covered, total }` och räknar unika `date` per dag för montören. Dagarna hämtas via befintlig `installerDatesFor` (filtrerad till dagar ≤ idag).
- `InstallerProjectDetail.tsx`: Tid-knappen använder den nya funktionen och visar en räknare.
- `ProjectLogTab.tsx`, `LogsOverview.tsx`, `MyTime.tsx`, `DeviationForm.tsx`, rapport-/signeringsvyn: lägger till `toneClasses`-kant/yta och `font-semibold`/`font-bold`. Bara semantiska tokens.
- Tester i `src/test/installerTone.test.ts`: alla dagar har tid → grön, delvis → gul, ingen → blå, framtida dagar räknas inte.
