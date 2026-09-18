# Installer sign-in and dashboard — status and next step

## Already working (verified now)

- The installer app requires a real sign-in and loads the signed-in person's own installer record from the shared database.
- Two real installer accounts exist and are linked to logins: Martin Olsson and Felix Örneklint. The installer list is no longer empty.
- Anyone signed in without installer access sees a clear "no installer account linked" screen with a sign-out button instead of a broken page.
- New installer accounts are created automatically in the database the moment an administrator gives someone installer access.

Nothing in this area needs rebuilding.

## Proposed next step: create installer logins from the admin side

Today a new installer only appears after someone with backend access assigns the role. This adds that to the admin interface:

1. An "Add installer" action in the admin user area that invites a person by email and name and grants them installer access.
2. The new person appears immediately in the installer list and in planning, with a pending-invite marker until their first sign-in.
3. An administrator can remove installer access again; the person's history (hours, expenses) stays intact.
4. End-to-end check: invite a test account, confirm it appears in the planner and in the installer app after sign-in, then remove it.

## Technical notes

- Reuses `useInstallers` / `useCurrentInstaller` and the existing `ensure_installer_record` trigger on `user_roles`.
- Invite sent through a small backend function using the admin invite API; role row inserted on accept, which fires the existing trigger.
- Admin-only access enforced with the existing `has_role(auth.uid(), 'admin')` rules.
