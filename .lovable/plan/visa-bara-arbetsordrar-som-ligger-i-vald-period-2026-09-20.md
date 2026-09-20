# Visa bara arbetsordrar som ligger i vald period

## Problem

Planeringstavlan listar alla arbetsordrar som finns, oavsett datum. När en stående order genererar hundratals framtida tillfällen blir listan flera hundra rader lång, trots att bara två veckor visas i tidsaxeln. Raderna utan stapel i vyn är rent brus.

## Lösning

Filtrera bort ordrar som inte överlappar den period som visas, i alla fyra planeringsvyer (Work Orders, Projects, Clients, Installers).

- En order visas när dess datumintervall överlappar den synliga perioden, även delvis (börjar innan och slutar inom, eller börjar inom och fortsätter framåt).
- Byter man till Vecka eller Månad, eller bläddrar framåt/bakåt, fylls listan på med de ordrar som ryms i den nya perioden.
- I Projects-vyn visas ett projekt bara om det har minst en order i perioden, och antalet i projektrubriken räknar bara de ordrar som visas.
- Installers-vyn behåller alla montörsrader (så tomma rader syns som ledig kapacitet), men bara ordrar inom perioden ritas.
- Status- och montörsfiltren fungerar som idag, ovanpå periodfiltret.
- Toolbaren visar antalet ordrar i perioden, t.ex. "12 work orders in view", så det syns att listan är periodbegränsad.

## Teknisk detalj

- Ny hjälpfunktion i `src/lib/ganttDates.ts`: `overlapsRange(startStr, endStr, rangeStart, rangeEnd)` som jämför kalenderdagar (samma UTC-dagslogik som `dayOffset`/`dayCount`).
- `src/components/GanttChart.tsx`: härled `rangeStartStr`/`rangeEndStr` ur `days[0]` och `days[days.length - 1]` och skicka ned till vyerna (eller filtrera listan centralt innan den skickas vidare — filtrering sker centralt i GanttChart så alla vyer får samma beteende).
- `ProjectsView.tsx`, `ClientsView.tsx`, `InstallersView.tsx`: gruppering/radberäkning körs på den redan filtrerade listan; `InstallersView` behåller sin fulla montörslista.
- Ingen ändring i datamodell, bokningar, status eller återkommande-logik.
- Verifiering: `bunx tsgo --noEmit`, `bunx vitest run` samt ett nytt testfall för `overlapsRange`.
