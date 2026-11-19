# Inga resdagar på transportuppdrag

## Vad som ändras
- **Skapa uppdrag:** rutan "Resdagar" visas bara för Montage. Byter man till Transport döljs rutan, och resdagarna sparas som av.
- **Redigera uppdrag:** rutan "Resdagar" döljs för transportuppdrag.
- **Planeringen:** transportuppdrag visar aldrig det gula "Resa"-fältet, inte heller om ett äldre transportuppdrag har resdagar sparade.
- **Teknikerappen:** transportuppdrag får inga extra resdagar i datumlistan.

## Tekniska detaljer
- `src/lib/travelDays.ts`: `travelDates()`/`reportingRange()` ger inga resdagar när `type === 'transport'`, så planeringen och teknikerappen följer samma regel.
- `CreateOrderDialog.tsx`: visa `TravelDayToggles` bara när `projectType !== 'transport'`. Spara `travelBefore`/`travelAfter` som false för transport.
- `EditWorkOrderDialog.tsx`: dölj `TravelDayToggles` för transport. Spara false för transport.
- `DraggableBar`-anropen i planeringens vyer: skicka resdagar bara för uppdrag som inte är transport.
- Lägg till ett test i `src/test/travelDays.test.ts`: ett transportuppdrag med `travelBefore`/`travelAfter` får inga resdagar.
