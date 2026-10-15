# Montörer på delar av en arbetsorder

## Mål
Varje montör på en order kan ha egna dagar (t.ex. Thea bara 2 av dagarna på SCANDIC Park). Standard är fortfarande hela ordern, men det går att flexa fritt per montör.

## Läget idag
- Planeringens montörsvy har redan stöd för "bara den här montören" när man drar en stapel, men det är bara visuellt.
- Själva bokningen (som styr krockkontroll, mobilappen och tidsrapporteringen) bokar alltid varje montör över hela orderns period. Därför krockar t.ex. Thea även de dagar hon inte är med.

## Vad som byggs
1. **"Edit work order" – montörernas dagar:** under varje vald montör visas "Hela ordern" eller egna start-/slutdatum (och tider). Datumen måste ligga inom orderns period. Krockvarning räknas på montörens egna dagar.
2. **Planering, montörsvyn:** dra/ändra längd på en montörs stapel → välj "Bara denna montör" så sparas det som montörens egna dagar (och bokas på riktigt).
3. **Bokningen:** varje montör bokas bara på sina egna dagar. Krock- och semesterkontroll gäller bara de dagarna, så Thea kan ligga på annan order resten av veckan.
4. **Orderns datum ändras:** montörer på "hela ordern" följer med. Montörer med egna dagar flyttas med samma förskjutning och kapas till orderns period.
5. **Mobilappen:** montören ser ordern bara på sina dagar, och dagknapparna i tidsredovisningen visar bara de dagarna. "Min tid → från bokning" använder montörens egna tider.
6. **Detaljpanelen:** listar montörerna med deras dagar, t.ex. "Thea – 6–7 okt".

## Tester
- En montör med egna dagar bokas bara på de dagarna; övriga på hela ordern.
- Egna dagar utanför orderns period stoppas.
- Flytt av ordern flyttar egna dagar med samma antal dagar.

## Teknisk sektion
- Ingen ny tabell. Bokningstabellen har redan start/slut per montör. Egna dagar sparas i orderns befintliga `installerDateOverrides` (källa för formuläret) och skrivs till bokningen via `bookingRowsFor`, som använder override per montör när den finns.
- `bookingRowsFor` / `syncProjectBookings` i `src/lib/bookings.ts`, `installerConflicts` i `schedulingConflicts.ts`, `EditWorkOrderDialog.tsx`, `InstallersView.tsx` (handleConfirmOne), `ProjectDetailPanel.tsx`, montörsappens schema och `ProjectLogTab.tsx`.
- Vid inläsning byggs overrides även från bokningsraderna när de skiljer sig från orderns period, så data aldrig glider isär.
- Nya testfall i `src/test/bookingSync.test.ts`.
