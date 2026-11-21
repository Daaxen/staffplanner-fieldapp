# Reference-table access hardening

**IMPLEMENTATION READINESS: READY — for approval, not execution.**

All eleven findings remain accepted P3 hardening items. This plan changes only their direct client SELECT predicates after approval. No implementation, test-account creation, or finding closure has occurred in this phase.

## Consolidated approach

Use one atomic migration with eleven `ALTER POLICY ... USING (...)` statements. Preserve each existing policy name, SELECT command, and `TO authenticated` audience. Replace only `USING (true)` with the shared staff predicate below. Leave all grants and existing administrator ALL/write policies unchanged.

**Proposed authorized audience for every table:** existing `admin`, `installer`, `hr`, and `superuser` roles, validated through the existing protected role system. This is a conservative staff-wide authorization boundary, not a claim that every staff role currently performs direct reads of every catalogue. Source inspection found no direct reads of these eleven tables in the current frontend or edge-function consumers; retaining staff catalogue access avoids unnecessary role-specific restrictions.

**Denied direct-read audiences:** anonymous users, authenticated accounts with none of those roles, and portal-only accounts without a staff role. Portal membership alone will not grant catalogue access. A portal account with a staff role receives access through that role, not portal membership.

### Technical details

Shared predicate, inlined into each existing SELECT policy; no new helper function:

```sql
auth.uid() IS NOT NULL AND (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'installer'::public.app_role)
  OR public.has_role(auth.uid(), 'hr'::public.app_role)
  OR public.has_role(auth.uid(), 'superuser'::public.app_role)
)
```

`has_role` is an existing SECURITY DEFINER function, executable by authenticated users. It reads protected `user_roles`, not editable account metadata or browser storage, and currently treats superusers as administrators/HR. Preserve its definition and permissions. Existing administrator ALL policies remain additional permissive policies, retaining administrator reads and writes.

All eleven tables currently have RLS enabled, no anonymous SELECT grant, authenticated SELECT, service-role SELECT, owner `postgres`, and no forced RLS. No public view referencing these tables was found. Preserve these properties. No new table, function, role, audience mechanism, or authentication change is needed.

## Table-by-table plan

For every table below: current SELECT is `TO authenticated USING (true)`; proposed SELECT is the same policy with the shared predicate. Exact proposed roles are **admin, installer, hr, superuser**. No customer/portal exception is currently required. Local mirrors and foreign-key validation are not direct catalogue reads.

| # | Table and current SELECT policy | Proposed policy | Direct-read screens/functions and local mirrors | Database dependencies | Installer / admin / portal impact; risk |
|---|---|---|---|---|---|
| 1 | `ref_commercial_status` — `commercial status readable` | Same name + shared predicate | No direct consumer found. `commercial.ts` mirrors stages for Orders Register, Customer 360, Operations Dashboard, invoice preparation. Commercial track remains hidden. | Foreign keys from `projects.commercial_status` and both commercial-transition columns. No named function directly reading this catalogue found. | Installer/staff access retained; admin management unchanged; portal has no catalogue read. FETCH impact limited to access boundary; LOW risk. |
| 2 | `ref_project_status` — `ref_project_status_read` | Same name + shared predicate | No direct consumer found. `controlledValues.ts` and existing labels supply order/planning/installer status displays and choices. Portal formats the order's status locally. | Foreign keys from `projects.status` and both work-transition columns. Status validators read the transition table, not this catalogue. | Installer status workflows and admin order screens preserved; portal uses order data, not this table. LOW risk. |
| 3 | `ref_transport_stop_type` — `ref_transport_stop_type_read` | Same name + shared predicate | No direct consumer found. `TRANSPORT_STOP_TYPES` mirrors pickup/delivery for transport forms and validation. | Foreign key from `transport_stops.type`; no named function directly reading this catalogue found. | Installer/admin transport access retained; no portal direct dependency. Keep Transport and stop codes unchanged. LOW risk. |
| 4 | `ref_document_scope` — `ref_document_scope readable by signed-in users` | Same name + shared predicate | No direct consumer found. `documentsData.ts` provides local scope labels/hints; Documents Manager renders them. | Foreign key from `documents.scope`. Existing document-access predicates and storage rules remain untouched; no named function directly reading this catalogue found. | Installer document viewing and admin classification preserved; HR role remains authorized. Current portal has no document-scope lookup. LOW risk, with document-access negative tests mandatory. |
| 5 | `ref_project_type` — `ref_project_type_read` | Same name + shared predicate | No direct consumer found. `PROJECT_TYPES` and existing labels mirror Installation, Site Survey, Transport for order creation/editing and validation. | Foreign keys from `projects.project_type` and `recurring_order_series.project_type`; no named function directly reading this catalogue found. | Installer/admin order functionality retained; no portal catalogue dependency. LOW risk; test recurring orders as well. |
| 6 | `ref_commercial_status_transition` — `commercial transitions readable` | Same name + shared predicate; direct client reads only | No direct consumer found. `COMMERCIAL_TRANSITIONS` supplies local transition rules; commercial UI stays hidden. | `validate_commercial_status_change()` directly SELECTs this table; SECURITY DEFINER owned by postgres, invoked by enabled `trg_projects_commercial_transition` on projects. Authenticated direct EXECUTE is not granted. | Staff catalogue reads retained; admin writes unchanged; no installer/portal need for direct transition reads found. Validator retains owner access; LOW risk. |
| 7 | `ref_absence_type` — `ref_absence_type_read` | Same name + shared predicate | No direct consumer found. `ABSENCE_TYPES` / `absenceTypeLabels` mirror Vacation, Sick Leave, Personal for absence UI/validation. | Foreign key from `installer_absences.type`. Assignment validation reads absence records, not this catalogue. | Installer/planning and admin absence workflows preserved; no portal direct dependency. Absence-record permissions unchanged. LOW risk. |
| 8 | `ref_time_source` — `ref_time_source_read` | Same name + shared predicate | No direct consumer found. `TIME_SOURCES` mirrors Manual/Timer; reporting writes source codes without a catalogue read. | Foreign key from `time_entries.source`; no named function directly reading this catalogue found. | Installer reporting and admin time screens retained; no portal direct dependency. Existing activity-type access and time-entry locks unchanged. LOW risk. |
| 9 | `ref_installer_type` — `ref_installer_type_read` | Same name + shared predicate | No direct consumer found. `INSTALLER_TYPES` / `installerTypeLabels` mirror Own Staff/Sub-vendor for personnel forms/validation. | Foreign key from `installers.type`; `ensure_installer_record()` is SECURITY DEFINER and inserts a type code, not a catalogue SELECT. | Installer/admin personnel access retained; portal reads installer names, not type catalogue. One-order sub-vendor links unchanged. LOW risk. |
| 10 | `ref_employment_type` — `ref_employment_type_read` | Same name + shared predicate | No direct consumer found. Local `EMPLOYMENT_TYPES` / labels support Profile Editor and Users Manager. | Foreign key from `profiles.employment_type`; no named function directly reading this catalogue found. | Installer/self-profile and admin/HR personnel audiences all retained, not HR-only. No portal direct dependency. Private employee data remains separate. LOW risk. |
| 11 | `ref_project_status_transition` — `status transitions readable` | Same name + shared predicate; direct client reads only | No direct consumer found. `STATUS_TRANSITIONS` / `allowedNextStatuses` / `transitionError` mirror work transitions. | `validate_project_status_change()` directly SELECTs this table; SECURITY DEFINER owned by postgres, invoked by enabled `trg_projects_status_transition`. `start_project_on_time_entry()` indirectly invokes it when advancing an order. Authenticated direct validator EXECUTE is not granted. | Installer/admin status workflows and automatic first-time-entry progress retained; portal only reads order status. Validator owner access preserved; LOW risk. |

## Protected invariants

Do not change reference rows/codes, transition pairs, foreign keys, validation logic, triggers, SECURITY DEFINER definitions/ownership/permissions, administrator permissions, write policies, authentication/signup/role architecture, document/storage permissions, time-entry/absence/order permissions, or FETCH application code/UI/branding. Do not enable the commercial track. Do not force RLS or revoke service-role access.

Before execution, capture definitions and checksums of protected objects, table contents, grants, and unrelated policies. Recheck the live state against this plan; stop for review if it has changed. Migration diff must contain only the eleven planned SELECT predicate replacements.

## Required regression and security plan

Run baseline and post-change checks with actual sessions and direct data-endpoint requests; UI checks alone do not prove RLS. Compare complete returned reference sets, not only successful HTTP status. RLS-denied SELECT may legitimately return an empty array rather than an error.

| Requirement | Proof required after implementation |
|---|---|
| A Anonymous | Every table returns no readable rows; existing anonymous grant denial remains. |
| B Roleless authenticated | Confirm a valid session and zero application roles; all eleven direct SELECTs return zero rows or access denial. |
| C Staff | Test installer, HR, admin, and superuser independently, plus multi-role account; each returns the full unchanged baseline set from all eleven tables. Superuser-only and HR-only sessions must work. |
| D Admin | Existing admin screens load; role checks and reference write policies/grants match baseline. Do not mutate reference data merely to test writes; test existing write permission behavior in rolled-back isolated transactions. |
| E Time | Installer saves manual time with an activity, reloads and reads it back; admin can inspect/edit it. Verify automatic scheduled-to-in-progress advancement, source FK validation, and completed-order installer lock/admin exemption. |
| F Orders | Admin creates/edits synthetic Installation and Site Survey orders; reload confirms values. Exercise recurring order type persistence. |
| G Status | Valid work transitions still persist and emit history; invalid transitions still fail. Test allowed/forbidden commercial transitions in an isolated transaction without enabling commercial UI. |
| H Transport | Create/edit synthetic Transport order with pickup/delivery stops; reload confirms order and stop types. Restricted sub-vendor link still returns only its existing whitelist. |
| I Absences | Authorized absence create/edit/read behavior unchanged; absence conflicts still block assignments and audited admin override still works. Same-day overlapping orders remain allowed. |
| J Personnel | Existing permitted profile/employment-type edits persist; installer identity creation and uniqueness remain valid. Admin/HR personnel behavior unchanged. |
| K Documents | Local classification choices render; permitted document save/read succeeds; unauthorized private/HR/sensitive document and storage reads remain denied. Portal-only account can still view its own permitted orders/reports/photos and cannot gain reference reads. |
| L Database | Protected definition/grant/trigger/FK checksums match baseline; valid inserts pass and invalid reference codes still fail. Both transition triggers remain enabled and emit expected events. No new validator EXECUTE grants. |
| M FETCH | Application source/UI diff is empty; existing commercial-hidden behavior and all unrelated policies match baseline. Only migration metadata and focused security tests may be added. |

Extend existing focused tests for controlled values, time reporting, commercial workflow, documents, installer identity, overlap/absence rules, recurring orders, and sub-vendor links. Add a table-driven live reference-access suite beside existing database tests; one concrete access assertion per table and role. Run relevant tests and signed-in browser flows with real synthetic input and UI readback. Baseline failures are recorded and not repaired under this scope. If a post-change check fails, stop and report; no additional fixes or automatic rollback without owner approval.

## Synthetic accounts and cleanup

- Obtain approval before creating temporary confirmed test users. Use the existing managed test-session mechanism, not modified signup or auto-confirm settings. Never log tokens or passwords.
- Use separate synthetic roleless, installer-only, HR-only, admin-only, superuser-only, and portal-only identities; create multi-role coverage if needed. Assign roles only through approved privileged operations. Never alter real users' roles.
- Prefix fixtures `TEST-` and set supported sandbox flags before operational testing. Use canonical installer IDs. Link the portal-only user solely to a synthetic customer; remove any automatically assigned staff role for roleless/portal-only cases.
- Confirm administrator deletion access before creating fixtures. Track every created ID and storage path; use rollback-only database fixtures where a trusted transactional test runner supports them. Do not create temporary schema helpers to simulate sessions.
- Remove dependent synthetic entries/files/links/assignments/absences/documents/orders/customer records before installers/profiles/accounts as foreign keys require. Remove roles and portal memberships; verify zero remaining fixture records and storage objects with read queries and auth deletion confirmation.
- Preserve all immutable audit/status history. Record the retained audit count separately as accepted protected history, never failed cleanup; do not disable triggers, bypass immutability, or weaken retention.
- After all tests and cleanup pass, recheck only these findings and mark only verified resolved findings fixed. No finding closure in this planning phase.

## Final readiness summary

**SHARED POLICY PATTERN POSSIBLE: YES**

**TABLE-SPECIFIC EXCEPTIONS REQUIRED: None identified.** Transition-table implementation must remain direct-read-only; no portal grant exception is proposed.

**SECURITY DEFINER DEPENDENCIES:** existing `has_role` for all proposed predicates; direct transition readers `validate_commercial_status_change` and `validate_project_status_change`; indirect operational dependents `start_project_on_time_entry` and `ensure_installer_record`. Preserve all unchanged.

**PORTAL/CUSTOMER DEPENDENCIES:** no direct reads of these eleven catalogues found in current portal loader/UI. Existing reads of own orders, installer names, reports, deviations, and signed photos remain outside the migration. Portal-only negative catalogue tests and positive existing portal-flow tests are required.

**FETCH RISK: LOW** — low scope risk, not zero; migration/tests only, no application behavior change intended.

**ESTIMATED REGRESSION RISK: LOW** — subject to the full role, validation, portal, and signed-in workflow checks above.

**STOP: Await System Owner approval.** No implementation or closure of the eleven findings is authorized by this plan.