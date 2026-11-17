# Utlandstraktamente: ta landet från Google-platsen

## Vad som är fel
Ordern "637 Scandic Vaasa (FI) - Part 1" har landet **Sverige** sparat. När platsen väljs från Googles förslag hämtar appen bara adressen och kartpunkten, inte landet. Landet ligger alltså kvar på Sverige, och Felix får inrikes traktamente.

## Åtgärder
1. **Ta landet från Google:** när man väljer en plats i förslagslistan (ny order, redigera order, kund) hämtar appen även Googles landskod, t.ex. FI, och sätter fältet Land till rätt land, t.ex. Finland. Admin ser det direkt och kan ändra.
2. **Rätta Scandic Vaasa nu:** sätt Land = Finland på ordern. Felix får då utlandstraktamente för Finland.
3. **Gamla ordrar:** ordrar som har Sverige men en kartpunkt utanför Sverige, eller "(FI)/(NO)/(DK)…" i namnet, listas så att du kan godkänna rättningen. Inget ändras utan ditt ja.
4. **Montörens vy:** traktamentet visar "Ordern är i Sverige – fel land? Byt här", så montören ser landet tydligt.

## Tekniskt
- Funktionen `maps-places` (details) lägger till `addressComponents` i fältmasken och returnerar `countryCode` (komponenten med typen `country`, shortText).
- `PlaceSelection` får `countryCode`. Ny `countryFromCode(iso)` i src/lib/perDiem.ts mappar ISO-kod till svenskt landsnamn som matchar `per_diem_rates`, med tester för FI→Finland, SE→Sverige, NO→Norge och okänd kod (ingen ändring).
- CreateOrderDialog och EditWorkOrderDialog sätter `country` i onSelect.
- Rättningen av data görs med en datafråga, inte en migration.
