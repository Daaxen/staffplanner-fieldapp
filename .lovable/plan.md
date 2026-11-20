# Keep technicians' unsaved input until they save

## What the technician will notice
- Anything typed in the technician app stays put if they switch to another app, press back, change tab, or the phone closes the app in the background. It is all still there when they come back to the order.
- This covers:
  - **Logg:** work time, travel time, note, the ÄTA-timmar box, the date, mileage, expenses and attached receipts
  - **Traktamente:** day type, overnight stay, meals and the 50 km box
  - **ÄTA form:** what needs doing, extra time/material, who approved it, photos
  - **Deviation form:** category, severity, description, photos
- The app also reopens the order on the tab they were on, such as Logg.
- A small note, "Osparat utkast återställt", shows when saved input comes back, along with a "Rensa" button to clear it.
- The draft is deleted as soon as they save, or after 7 days.
- Drafts are kept separately for each technician and each order, so one person's draft never shows on someone else's order or phone login.
- The installation report already keeps its draft today and stays as it is.

## Technical details
- New hook `src/hooks/useFormDraft.ts`: `useFormDraft(key, initial)` returns `[state, setState, { restored, clear }]`. It saves to localStorage under `fetch.draft.<installerId>.<projectId>.<form>[.<date>]`, writes 300 ms after each change and also on `visibilitychange` (hidden) and `pagehide`, and stores `savedAt` so entries older than 7 days are dropped.
- Replace the plain `useState` form fields with grouped draft state in ProjectLogTab (time, mileage and expense groups), PerDiemSection (keyed per date; the stored entry still wins when it exists), AtaForm and DeviationForm. Call `clear()` after each successful save.
- Photos and receipts: store only the already-uploaded paths and queued photo IDs in the draft, never file data.
- InstallerProjectDetail: keep the active tab in sessionStorage for each order.
- Small shared `DraftRestoredNote` component for the note and the clear button.
- Tests in `src/test/formDraft.test.ts` check that a draft is restored, cleared after save, ignored after 7 days, and kept apart for each installer and order.
