# Tidsrapportering – ny modul

## Analys (redovisning enligt specen)

1. **Återanvänds:** kundregistret (clients), projekt (project_groups), ordrar (projects), bokningar (assignments), montörer/användare (installers + profiles), roller (user_roles/has_role), befintlig tidtabell `time_entries`, xlsx-exporten som redan finns.
2. **Kund 9999 finns:** "Dynamic Places AB", kundnummer 9999 (kund-ID 1077). Återanvänds – ingen ny kund skapas. Visas som "9999 – Dynamic Places Intern".
3. **Ingen ny tidtabell.** Tidigare beslut: inga nya rapporteringstabeller. Befintliga `time_entries` utökas i stället (se tekniskt avsnitt). Enda nya tabell: aktivitetstyper.
4. **Koppling:** kund krävs; projekt valfritt (måste tillhöra kunden); order valfri (måste tillhöra kunden/projektet). "Skapa från bokning" förifyller datum, kund, projekt, order.
5. **Risker:** montörsappens nuvarande tid per order, lönsamhet, fakturaunderlag och tidsavvikelse läser `time_entries`. Befintliga rader får kund ifylld från ordern, så inget försvinner. Rader utan order hoppas över i order-baserade beräkningar.
6. **Byggordning:** nedan.

## Vad du får

Ny menygrupp **Tidsrapportering** (operativa delen), med:
- **Min tid** (alla roller, även i montörsappen): välj dag, lägg till flera rader utan att lämna sidan, redigera/ta bort/kopiera egna rader, "Skapa från bokning" (dagens bokningar listas), snabbval "Intern eller osäker kund". Dagsvy med total, antal rader och skillnad mot normaldag (8 h); veckovy med tid per dag, veckototal och tomma dagar markerade.
- **Tidsöversikt** (admin): filter datum, medarbetare, kund, projekt, order, aktivitet; tabell med alla kolumner i specen; summeringar per kund/projekt/medarbetare/aktivitet samt total mot 9999.
- **Export** (admin): XLSX enligt aktiva filter, filnamn `tidsrapport_YYYY-MM-DD_YYYY-MM-DD.xlsx`, exakt specens kolumner.

Ingen debiterbarhet, status eller attest någonstans.

## Regler
- Datum, kund, aktivitet, timmar krävs; timmar > 0 och ≤ 24 per rad och ≤ 24 per person och dag.
- Kund 9999: beskrivning krävs, minst ~15 tecken och inte bara "internt/övrigt/diverse"; bara projekt som hör till 9999.
- Svenska felmeddelanden; Spara-knappen låses under sparning.

## Tekniska detaljer

Steg 1 – databas (en migration):
- `time_activity_types` (id, name, active, sort_order, timestamps) med de 17 startvärdena; alla inloggade läser, admin ändrar.
- `time_entries`: `project_id` (order) blir valfri; nya kolumner `client_id` (FK clients), `project_group_id` (FK project_groups, valfri), `activity_type_id` (FK), `description`, `source_assignment_id` (FK assignments, valfri). Befintliga rader: `client_id` fylls från ordern, `activity_type_id` = Installation. Index på entry_date, installer_id, client_id, project_group_id, project_id, activity_type_id.
- Valideringstrigger utökas: projekt/order ska matcha kund, 9999-regler, 24 h-tak per rad och per dag (över work + travel).
- Medarbetare = `installer_id` via `current_installer_id()` (sätts i trigger, kan inte manipuleras). Befintliga RLS (egna rader / admin allt) behålls; admins och HR utan installer-post får en egen post automatiskt (befintlig ensure_installer_record).
- Order-baserade vyer (lönsamhet, fakturaunderlag, avvikelse) filtrerar bort rader utan order.

Steg 2–4 – `src/components/timereporting/` MyTime (dag/vecka, rad-dialog, från bokning), `src/lib/timeReporting.ts` (zod-regler, summering, export), hook `useTimeReporting`. Navigation: ny grupp `time-reporting` (my-time, time-overview, time-export) + flik i montörsappen.

Steg 5–6 – TimeOverview + TimeExport (xlsx), återanvänder filterstate.

Steg 7 – tester: vitest för valideringsregler, summering, 9999, export (kolumner/summor, inga förbjudna fält); SQL-RLS-test för egen/andras tid och user-manipulation; Playwright-kontroll mobil + desktop; befintliga tester ska passera.
