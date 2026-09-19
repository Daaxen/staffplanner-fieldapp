# StaffPlanner navigation redesign

## Scope
Reorganize navigation only. Preserve all current screens, data flows, and business logic.

## Desktop navigation
- Replace the flat list with collapsible workflow groups: Dashboard, Orders, Planning, Field Operations, Finance, Customers, Resources, Reports, and Administration.
- Keep Feedback, My Profile, and Sign out as utilities.
- Rename ambiguous entries, including “Deviations” to “Field deviations”, “Deviation analysis” to “Estimate accuracy”, and “Customer portal” to “Portal access”.
- Keep the current active screen highlighted, auto-open its group, and preserve the mini sidebar when collapsed.
- Remove the mock installer-name list from navigation; installer management remains under Resources.

## Role visibility
- Admin: all existing destinations.
- HR: operational overview, planning, resources, reports, administration, feedback, and profile; hide finance and commercial customer views.
- Installer: use the dedicated installer navigation; no admin-only destinations.
- Enforce destination visibility in the page shell as well as the menu, without changing underlying permissions or business rules.

## Mobile installer navigation
- Replace the eight equal tabs with five primary destinations: Active jobs, Reporting, Deviations, Sign-off, and More.
- Reuse existing screens: Active jobs combines project access and schedule context; Reporting opens existing time/reporting tools; Deviations and Sign-off lead into the relevant existing project workflow; More exposes OrderBox, full schedule, inbox, documents, feedback, profile, field mode, and sign out.
- Preserve selected project handling, offline behavior, reminders, uploads, and reporting logic.

## Route compatibility
- Add stable URL-backed admin destinations while retaining `/` and the existing `/installer` and `/portal` routes.
- Redirect legacy destination URLs to their new canonical locations and keep direct links/refresh working.
- Preserve the unsaved-planning navigation warning.

## Verification
- Run focused navigation tests plus the existing test suite and type checks through the project harness.
- Verify desktop and mobile layouts and exercise direct/legacy URLs in the browser.
