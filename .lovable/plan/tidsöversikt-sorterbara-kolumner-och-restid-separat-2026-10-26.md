# Tidsöversikt: sorterbara kolumner och restid separat

## Sortering
- Alla kolumnrubriker i tabellen blir klickbara: klick 1 stigande, klick 2 fallande, klick 3 tillbaka till ursprunglig ordning (samma som i kundregistret).
- En pil visar vilken kolumn som sorterar och åt vilket håll. Datum och timmar sorteras som tal och datum, inte som text.
- Sorteringen sker efter filtren, så den gäller bara de rader som syns.

## Arbetstid och restid separat
- Kolumnen "Timmar" ersätts med tre kolumner: **Arbetstid**, **Restid** och **Totalt**.
- Summeringsrutorna (per kund, projekt, medarbetare, aktivitet) visar arbetstid, restid och totalt på varje rad.
- Totalsumman överst delas upp på samma sätt.
- Excel-exporten får också egna kolumner för arbetstid och restid.

## Tekniskt
- `src/components/timereporting/TimeOverview.tsx`: sort-state (kolumn + riktning), sorterbar header, nya kolumner.
- `src/lib/timeReporting.ts`: `sumBy` returnerar work/travel/total; exportkolumner utökas. Ingen databasändring (`hours` och `travel_hours` finns redan).
- Test i `src/test/timeReporting.test.ts` att summor delar upp arbetstid och restid korrekt.
