import { supabase } from '@/integrations/supabase/client';
import { ensureProjectRowId } from '@/lib/appData';

/**
 * Resource bookings (public.assignments) are the authoritative scheduling source.
 * project_assignees remains the membership/RLS source and is kept in sync by a
 * database trigger whenever a booking is created.
 */

export const ACTIVE_BOOKING_STATUSES = ['planned', 'confirmed', 'in_progress'] as const;

export type BookingStatus =
  | 'planned'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface BookingConflict {
  kind: 'booking' | 'absence';
  installerId: string;
  detail: string;
  from: string;
  to: string;
}

export const OVERRIDE_REASON_MIN = 10;

function dayStart(date: string, time?: string) {
  return new Date(`${date}T${time && time.length >= 4 ? time : '00:00'}:00`).toISOString();
}
function dayEnd(date: string, time?: string) {
  return new Date(`${date}T${time && time.length >= 4 ? time : '23:59'}:00`).toISOString();
}

export function bookingWindow(
  startDate: string,
  endDate: string,
  startTime?: string,
  endTime?: string,
) {
  return { start: dayStart(startDate, startTime), end: dayEnd(endDate, endTime) };
}

/** Conflicts for the given installers in a window — shown before saving. */
export async function findBookingConflicts(
  installerIds: string[],
  start: string,
  end: string,
  excludeProjectRowId?: string,
): Promise<BookingConflict[]> {
  if (!installerIds.length) return [];
  const out: BookingConflict[] = [];

  const { data: bookings } = await supabase
    .from('assignments')
    .select('id, project_id, installer_id, planned_start_at, planned_end_at, assignment_status')
    .in('installer_id', installerIds)
    .in('assignment_status', ACTIVE_BOOKING_STATUSES as unknown as string[])
    .lt('planned_start_at', end)
    .gt('planned_end_at', start);

  for (const b of bookings ?? []) {
    if (excludeProjectRowId && b.project_id === excludeProjectRowId) continue;
    out.push({
      kind: 'booking',
      installerId: b.installer_id,
      detail: 'Already booked on another order in this period',
      from: b.planned_start_at,
      to: b.planned_end_at,
    });
  }

  const { data: absences } = await supabase
    .from('installer_absences')
    .select('id, installer_id, type, label, start_date, end_date')
    .in('installer_id', installerIds)
    .lte('start_date', end.slice(0, 10))
    .gte('end_date', start.slice(0, 10));

  for (const a of absences ?? []) {
    out.push({
      kind: 'absence',
      installerId: a.installer_id,
      detail: `Planned absence (${a.label || a.type})`,
      from: a.start_date,
      to: a.end_date,
    });
  }

  return out;
}

export interface SaveBookingsResult {
  ok: boolean;
  conflict: boolean;
  error?: string;
}

/**
 * Replaces the bookings for an order. A conflicting booking is only written
 * when an admin supplies an override reason (audited in assignment_overrides).
 */
export async function saveBookings(params: {
  projectRef: string;
  installerIds: string[];
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  status?: BookingStatus;
  overrideReason?: string;
}): Promise<SaveBookingsResult> {
  const rowId = await ensureProjectRowId(params.projectRef);
  if (!rowId) return { ok: false, conflict: false, error: 'Order not found in the database' };

  const { start, end } = bookingWindow(
    params.startDate,
    params.endDate,
    params.startTime,
    params.endTime,
  );
  const reason = params.overrideReason?.trim() || null;

  await supabase.from('assignments').delete().eq('project_id', rowId);

  if (!params.installerIds.length) return { ok: true, conflict: false };

  const { error } = await supabase.from('assignments').insert(
    params.installerIds.map(installerId => ({
      project_id: rowId,
      installer_id: installerId,
      planned_start_at: start,
      planned_end_at: end,
      assignment_status: params.status ?? 'planned',
      override_reason: reason,
    })),
  );

  if (error) {
    const msg = error.message || '';
    const conflict =
      msg.includes('assignments_no_overlap') ||
      msg.toLowerCase().includes('conflict') ||
      msg.includes('override reason');
    return { ok: false, conflict, error: msg };
  }

  return { ok: true, conflict: false };
}
