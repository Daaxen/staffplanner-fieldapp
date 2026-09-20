# Återkommande arbetsordrar (stående ordrar)

Idag finns ingen repetitionslogik alls — varje arbetsorder skapas manuellt. Planen inför en **serie** (mall) som genererar riktiga, fristående arbetsordrar, t.ex. MIAV onsdag–fredag varje vecka för samma kund.

## Så fungerar det för dig

1. I **Orders/Projects** finns en ny flik **Recurring orders**.
2. Du skapar en serie med samma fält som en vanlig arbetsorder (kund, plats, tider, estimerade timmar, beskrivning, ordertyp, ev. projekt) plus:
   - Veckodagar: ons, tors, fre
   - Intervall: varje vecka / varannan vecka
   - Startdatum och **slutdatum** (obligatoriskt)
   - **Pausperioder**: datumintervall som hoppas över, t.ex. 21 dec–6 jan
   - Kryssruta **Hoppa över röda dagar** (svenska helgdagar)
3. Du ser en förhandsvisning: "Skapar 34 arbetsordrar, 6 datum hoppas över".
4. Vid Spara skapas alla tillfällen direkt som vanliga arbetsordrar med status **Open** och **utan montör** — du planerar dem i Planning som vanligt.
5. Ordrar i en serie är märkta med en liten repeat-ikon och namnges `MIAV – 2026-09-23`.
6. Ändrar du ett enskilt tillfälle påverkas bara det. Serien rörs inte.
7. Ändrar du själva serien påverkas bara **framtida, ännu ej planerade** tillfällen (dvs. fortfarande Open och utan montör). Redan planerade eller rapporterade ordrar lämnas orörda.
8. Tar du bort en serie frågar systemet om framtida oplanerade tillfällen ska tas bort också.

## Operativ nytta

- Planeringen fylls i förväg, så kapacitetsvyn och resursplaneringen visar den stående belastningen.
- Varje tillfälle får egen tid-, kostnads- och avvikelserapportering, egen lönsamhet och egna job_metrics — precis som idag.
- Fakturaunderlag per vecka fungerar oförändrat eftersom varje tillfälle är en riktig order.

## Teknisk plan

**Databas (en migration)**

- Ny tabell `public.recurring_order_series`: id, name, client_id, project_group_id, project_type, location/street/postal_code/region/lat/lng, contact_*, start_time, end_time, estimated_hours, description, hourly_rate, mileage_rate, vehicle_type, template_id, `weekdays smallint[]` (1–7, ISO), `interval_weeks int default 1`, `series_start date`, `series_end date`, `skip_holidays boolean default true`, `pauses jsonb default '[]'` (array av `{from,to}`), `active boolean default true`, created_by, timestamps.
- `projects.recurrence_series_id uuid` nullable FK → `recurring_order_series(id) ON DELETE SET NULL`, plus index.
- GRANT SELECT/INSERT/UPDATE/DELETE till `authenticated`, ALL till `service_role`; RLS på: admin och HR full åtkomst via `has_role`, installatörer får SELECT endast på serier vars ordrar de är med i (samma mönster som `project_groups`).

**Frontend**

- `src/lib/recurrence.ts` – ren, testbar funktion `expandSeries(series): string[]` som räknar ut datum från veckodagar, intervall, start/slut, pauser och `src/utils/swedishHolidays.ts`. Ingen databaskod.
- `src/lib/recurringOrders.ts` – ladda/spara serier, generera ordrar via befintlig insert-väg i `src/lib/appData.ts` (samma fält som `CreateOrderDialog` använder, så `ref`/ordernummer, client_id-koppling och snapshot beter sig identiskt).
- `src/components/orders/RecurringOrdersRegister.tsx` – lista över serier + dialog för att skapa/redigera, med förhandsvisning av datum.
- `src/lib/navigation.ts` – ny vy `recurring-orders` ("Recurring orders") i gruppen Orders/Projects; rutt `/app/recurring-orders` i `src/pages/Index.tsx`.
- `src/components/orders/OrdersRegister.tsx` och Gantt-staplarna: repeat-ikon när `recurrenceSeriesId` är satt.
- `src/lib/appData.ts`: `recurrenceSeriesId` i Project-typen, kolumnmappning och upsert.

**Tester**

- `src/test/recurrence.test.ts`: veckodagsexpansion, varannan vecka, pausperiod över jul, svenska röda dagar exkluderade, slutdatum inklusive, tomt resultat vid ogiltigt intervall.

**Rör inte**: ingen ändring i bokningslogik (`bookings.ts`), rapportering, job_metrics eller status-workflow. Genererade ordrar är vanliga ordrar.
