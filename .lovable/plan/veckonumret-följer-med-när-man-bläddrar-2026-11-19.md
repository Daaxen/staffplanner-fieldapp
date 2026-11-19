# Veckonumret följer med när man bläddrar

## Vad ändras
- Knappen mellan pilarna i planeringen visar nu den vecka som faktiskt visas, t.ex. "Vecka 48" när man bläddrat fram en vecka.
- Samma sak gäller i dags- och månadsvyn. Dagsvyn visar det datum som visas och månadsvyn visar den månad som visas.
- Texten blir svensk: "Vecka 48", "19 nov", "december".
- Klickar man på knappen hoppar planeringen tillbaka till idag, precis som förut.

## Tekniska detaljer
- src/components/GanttChart.tsx: `todayLabel` räknas från `startDate` (den visade periodens första dag) i stället för `new Date()`, med `startDate` i beroendelistan.
- Vecka: `Vecka ${getISOWeekNumber(startDate)}`. Dag: `toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })`. Månad: `toLocaleDateString('sv-SE', { month: 'long' })`.
- Ett litet test för att veckonumret räknas från den visade veckan (t.ex. måndag 23 nov 2026 ger vecka 48).
