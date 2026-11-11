# Sub-vendor link for a single work order

## What you get
- On a work order (Edit work order / order panel): **"Add sub-vendor via link"**. Choose an existing sub-vendor or type a new name (company + person, optional phone/email).
- FETCH creates a private link, e.g. `fetch.../uv/<code>`. Copy it or send by SMS/email from your phone.
- The sub-vendor opens the link on their phone — **no account, no password** — and sees only that one work order, in the same mobile view as your installers: what/where/when, description, documents, and the "Rapportera" buttons (time with the hour wheels, travel, mileage, expenses, deviations, photos, report and sign-off).
- They cannot see other orders, the planning board, or other people's details.
- **Hidden from sub-vendors:** all client-sensitive info: prices, rates, billables, order value, budget, margins, contract/invoice details, customer number, internal notes, sensitive or internal documents.
- **Shown to sub-vendors:** only site specifics: order name/number, site address and map, on-site contact person (name, phone), dates/times, work description, checklist, installer-visible guides.
- The sub-vendor is booked on the order like a normal installer (shows on Planning, clash checks, time overview, reports, billables).

## Who sees whom
- Your installers on the order see a "Team" row: names, with the sub-vendor marked with a **"UE"** badge plus company name.
- The sub-vendor sees the same team list (names only, no phone numbers unless you choose to show them).

## When the link stops working
- Automatically: **5 days after the order is set to Completed**, or 5 days after the order's end date — whichever comes first. During those 5 days they can still fix missing time; the normal time lock still applies once you've completed it (they are told to contact admin).
- Manually: admin can **Revoke** or **Renew** the link anytime. A list on the order shows status (Active / Expires DD/MM / Revoked) and when it was last used.
- Opening an expired link shows a friendly "This link is no longer active — contact <company>" page.

## Technical details
- Sub-vendor stored as a normal `installers` row (type `sub-vendor`, no profile_id), assigned via existing `assignments` so all existing rules apply.
- New table `work_order_links` (token hash, project_id, installer_id, expires_at, revoked_at, last_used_at, created_by); admin-only RLS. Expiry recomputed by trigger on project status/end-date change.
- New public backend function `subvendor-access` validates token on every call and reads/writes only that project + installer, returning a whitelisted set of site fields only (never rates, economy, billing/contract fields or sensitive documents) (order data, field report, time/mileage/expense/deviation entries, photo uploads to existing bucket). All writes go through existing triggers (validation, time lock, audit log with actor "sub-vendor via link").
- New route `/uv/:token` reusing the installer mobile components with a link-based data source; installer app gets a Team section showing UE badge.
- Tests for expiry rule (completed + 5 days, end date + 5 days, revoked) and that a token cannot read another order.

## Open question (assumed unless you say otherwise)
- Link is the only key — anyone who has it can report. Optional extra: require a 4-digit PIN sent separately. Not included by default.
