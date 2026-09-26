# Add a "Cancel work order" action

## Current state
- Cancelling is only possible indirectly: Edit work order → Status dropdown → Cancelled.
- No dedicated button, no confirmation, no reason captured.
- The booking layer already handles it: `cancelled` is a non-booking status, so assigned installers' bookings are released automatically when the status changes.

## What to build

1. **Cancel button in the work order detail panel** (the slide-out panel in Planning)
   - New "Cancel work order" button below Edit, in a muted/destructive style.
   - Hidden when the order is already cancelled or completed.

2. **Confirmation dialog**
   - "Cancel work order X?" with a warning that assigned installers are released.
   - Optional reason field (free text), stored on the order's description/log if present — kept simple: appended to the order notes.
   - Confirm → status set to `cancelled`; Cancel → closes without changes.

3. **Same action in the Orders register**
   - Row action / bulk action "Cancel" that runs the same confirmation flow.

4. **Behaviour after cancel**
   - Status becomes Cancelled (grey), bookings released, order disappears from installers' schedules, and the existing "cancelled" change-notification to affected installers fires (already built in GanttChart).
   - Order remains visible in registers and history — never deleted.

## Technical details
- `src/components/ProjectDetailPanel.tsx`: add button + dialog state.
- `src/components/gantt/GanttChart.tsx`: wire `onCancel` → `handleUpdateProject(id, { status: 'cancelled' })` (existing change-tracking already notifies assignees).
- `src/components/orders/OrdersRegister.tsx`: add cancel to row/bulk actions reusing the same dialog component.
- New small shared component `CancelWorkOrderDialog.tsx` for the confirm + reason.
- Verify with `bunx tsgo --noEmit` and `bunx vitest run`.
