# Wave 1 test map — proposed docs/wave1-test-map.md

Inspected source and live information_schema; no repository files modified.

Test ID | Area | Existing implementation | Priority | Supported?
---|---|---|---|---
P0-01 | Customer/order | appData.ts, customerLink.ts, clientStore.ts; clients → projects.client_id; customerLink/customer RLS tests | P0 | Implemented surface; runtime blocked D
P0-02 | Booking sync | bookings.ts, appData.ts; assignments/project_assignees; bookingSync/bookings tests | P0 | Implemented surface; runtime blocked D
P0-03 | Time reporting | useTimeReporting.ts, timeReporting.ts; time_entries; timeReporting/installersSelfService tests | P0 | Implemented surface; runtime blocked D
P0-04 | Report/sign-off | useFieldWork.ts, offline/fieldWork.ts, completionRequirements.ts; field_reports; fieldReportPersistence tests | P0 | Implemented surface; runtime blocked D
P0-05 | Invoice preparation | invoicePrep.ts buildInvoiceSuggestion; invoicePrep/profitability tests | P0 | Implemented surface; runtime blocked D
P1-06 | Double submit | appData.ts upserts, booking/field report persistence; no dedicated browser rapid-submit test | P1 | Implemented surface; runtime blocked D
P1-07 | Interrupted flow | appData.ts subscription/cache and offline field-work queue; no browser navigation regression | P1 | Implemented surface; runtime blocked D
P1-08 | Status flow | validation/controlledValues.ts, commercial.ts; project_status_events/commercial_status_events; controlledValues/commercialWorkflow tests | P1 | Implemented surface; runtime blocked D
P1-09 | Stale data | appData.ts writes; booking conflict logic exists but is not stale-write detection | P1 | Implemented surface; runtime blocked D
P2-10 | Installer role | ProtectedRoute.tsx, useAuth.tsx, navigation.ts, installerIdentity.ts; installer identity/self-service tests | P2 | Implemented surface; runtime blocked D
GOLDEN | Full workflow | Composition of preceding implementation, not an existing 13-step integration test | GOLDEN | Implemented surface; runtime blocked D

## Routes and permissions
`/app/:view` includes orders, planner, resources, my-time, time-overview, invoice-prep and installer-preview. `/installer` and `/portal` are authenticated. App navigation roles: admin, hr, installer. ProtectedRoute supports requireRole but App routes do not supply it; actual page/backend authorization requires dedicated identity testing. Superuser handling lives in useAuth; view-as is not an authorization test.

## Statuses
Operational edges: open → scheduled/on-hold/cancelled; scheduled → open/in-progress/on-hold/cancelled; in-progress → completed/on-hold/cancelled; on-hold → open/scheduled/in-progress/cancelled; completed → in-progress; cancelled → open. Same-state is accepted.
Commercial track: quote → order_received → planned → scheduled → in_progress → ready_for_invoice → invoiced → paid → closed; backward edges are defined in commercial.ts, including closed → paid. Most non-closed states permit closing. Database transition tables/triggers are covered by existing source-based unit tests; live writes were not exercised.

## Persistence and completion
projects.id is the database UUID; ref is the app-facing reference. clients.id links projects.client_id, with compatibility name/ref snapshots. project_assignees links installers; assignments carries booking timestamps/status. time_entries holds reported time. field_reports is upserted by offline field-work persistence. Report must be nonempty; checklist and template installer sign-offs are required. Customer signature is optional; photos recommended with explicit skip supported.
Invoice suggestions are computed by buildInvoiceSuggestion from current inputs; do not assume a persisted snapshot or promise live cross-session refresh without runtime testing.

## Unsupported / unverified items
- Password-based installer logout/login cannot be tested with passwordless minted sessions (D).
- Dedicated A+B installer creation/role grants not safely available in this run (D); never use real installers.
- Optimistic stale-write conflict detection not established; booking scheduling conflicts are a different feature. Treat requested conflict warnings as unverified, not confirmed supported.
- Snapshot auto-reactivity is not an established invoice contract; current-input calculation is supported.
- Required SQL CLI explicitly read-only: tagged delete cleanup unavailable (D).
- Baseline is 30 test files / 201 tests, not 30 individual tests. Includes source-text assertions, so green unit tests do not prove live persistence or RLS.
