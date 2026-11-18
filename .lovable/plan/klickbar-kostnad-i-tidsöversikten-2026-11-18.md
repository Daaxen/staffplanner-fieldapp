# Klickbar kostnad i Tidsöversikten

## Vad du får
Klicka på ett belopp i kolumnerna Utlägg, Mil eller Traktamente så öppnas en liten ruta bredvid som visar vad beloppet består av. Klick utanför stänger den.

- **Utlägg:** en rad per utlägg – kategori (t.ex. material, hotell), beskrivning, belopp och länk "Visa kvitto" om kvitto finns.
- **Mil:** sträcka (från → till om ifyllt), km, ersättning per mil och belopp.
- **Traktamente:** typ (heldag/halvdag, inrikes/utrikes), land, eventuella måltidsavdrag ("Vem betalade?") och belopp.
- Längst ner: summa, som ska vara samma som siffran i cellen.

Tomma celler (0) går inte att klicka på.

## Tekniskt
- `useCostRows`: hämta även id, kategori/beskrivning, kvitto-sökvägar, km/från/till, traktamentestyp, land och måltidsflaggor (kolumnnamn bekräftas mot tabellerna innan bygget).
- `mergeCosts`: spara de enskilda posterna per rad (`expenseItems`, `mileageItems`, `perDiemItems`) utöver summorna.
- Ny `CostBreakdownPopover` (shadcn Popover) som används i de tre kostnadscellerna i `TimeOverview`.
- Kvittolänk via signerad länk från lagringen, öppnas i ny flik.
- Utöka `mergeCosts`-testet: att posterna följer med och att summan stämmer.
