# Separate work orders from projects

Today one record does double duty: the planner calls it a project, the register calls it an order. This introduces a real two-level model — a project can group several work orders, and a work order can stand alone — and aligns all wording.

## The model

```text
Project (optional grouping)
 ├── Work order  (scheduled, assigned, reported, invoiced)
 ├── Work order
Work order (standalone, no project)
```

- A work order is exactly what exists today: dates, installers, checklists, reports, time, expenses, economy. Nothing about it changes.
- A project is a new lightweight grouping record: name, project number, customer, optional period, description, status summary.
- A work order may belong to one project or to none. Deleting a project never deletes its work orders; they become standalone.

## Wording

- Planning board button: "New Project" becomes **Create work order**.
- Menu group "Orders" becomes **Orders/Projects**, with entries **Work orders** (today's register) and **Projects**.
- Register heading, dialogs, bulk actions and column labels use "work order" consistently. The installer app keeps the plain word "job" in the field views.
- Reports, invoicing, Customer 360 and dashboards keep counting work orders, with a project column where a work order belongs to one.

## Screens

**Work orders** (existing register, renamed): unchanged listing, filters, import and bulk actions, plus a Project column and a bulk action "Assign to project". Standalone work orders appear as ordinary rows with an empty project — no separate tab.

**Projects** (new): list of projects with customer, period, number of work orders and aggregated status; create/edit a project; open a project to see its work orders, add existing work orders, or create a new work order inside it (opens the same create dialog pre-filled with the project's customer and address).

## Technical notes

- New table `public.project_groups` (user-facing "Projects"): name, project_number, client_id, description, start_date, end_date, status, timestamps, with GRANTs, RLS (admin/HR manage; installers read only groups they have a work order in) and an updated_at trigger. The existing `projects` table stays as-is and remains the work-order record, so no data migration and no risk to reporting, assignments, invoicing or the installer app.
- `projects.project_group_id` added as a nullable FK with `ON DELETE SET NULL`, plus an index.
- `src/lib/appData.ts` gains `projectGroupId` on the Project type and in its column mapping; a new `src/lib/projectGroups.ts` handles group CRUD and the work-order link.
- Navigation: group `orders` relabelled, entry `orders` relabelled "Work orders", new view `project-groups` with a legacy-safe path `/app/project-groups`. Existing routes and redirects keep working.
- Business logic (scheduling, conflicts, completion rules, economy, commercial status) is untouched.

## Verification

Type check plus the existing test suite, new tests for the group link rules, and a browser pass over planning, the work order register and the new Projects screen.
