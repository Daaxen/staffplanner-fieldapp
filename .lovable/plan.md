# Arbetsbeskrivning i mobilvyn + tydligare "Est hours"

## Bakgrund (verifierat)

1. **Arbetsbeskrivning saknas i mobilvyn.**
   - Info-fliken i mobilappen (`InstallerProjectDetail.tsx`) visar beskrivningen bara om den finns ifylld, längst ner under rubriken "Description".
   - Teknikerläget/offlineläget (`TechnicianMode.tsx`) visar **aldrig** beskrivningen — fältet renderas inte alls där.
   - Ordern SCANDIC GO Jönköping har tom `description` i databasen, så även där den renderas syns inget.
2. **"Est hours" är otydligt.** Värdet är ett enda fält (`projects.estimated_hours`) som gäller **hela arbetsordern totalt** — inte per montör. Det återanvänds som planerade timmar i lönsamhets- och avvikelseberäkningar. Ingen etikett någonstans förklarar detta.

## Ändringar

### 1. Arbetsbeskrivning alltid synlig i mobilappen
- `InstallerProjectDetail.tsx` (Info-fliken): sektionen byter rubrik till "Work description", flyttas upp direkt under "Schedule", och visas alltid — med texten "No work description added" när fältet är tomt.
- `TechnicianMode.tsx`: lägg till arbetsbeskrivningen i det utfällbara jobbkortet (under plats/adress), samma fallback-text när den saknas. Ingen logikändring — bara visning.

### 2. Tydlig etikett för estimerade timmar
Betydelsen ändras inte — det är totala timmar för hela arbetsordern. Bara texter förtydligas:
- Mobilvyn: "Est. Hours" → "Estimated hours (total)".
- "Create work order" och "Edit work order": etiketten "Estimated hours" → "Estimated hours (total for the work order)" med hjälptext "Total for the whole work order, shared by all assigned installers."

### 3. Verifiering
- `bunx tsgo --noEmit` + `bunx vitest run` (148 tester) måste passa.
- Playwright i mobilvy: öppna ordern i mobilappen och i teknikerläget, bekräfta att "Work description" syns (med fallback-text på SCANDIC-ordern) och att timmarna heter "Estimated hours (total)".

## Tekniska detaljer
- Berörda filer: `src/components/installer/InstallerProjectDetail.tsx`, `src/components/installer/technician/TechnicianMode.tsx`, `src/components/gantt/CreateOrderDialog.tsx`, `src/components/gantt/EditWorkOrderDialog.tsx`.
- Ingen databasändring, ingen affärslogik ändras, inga nya fält.
