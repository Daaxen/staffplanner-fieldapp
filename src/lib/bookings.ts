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

/** Orders in these states hold no resource booking. */
export const NON_BOOKING_STATUSES = ['cancelled', 'completed', 'open'] as const;

/** Booking state mirrors where the order itself is. */
export function bookingStatusForProject(status: string): BookingStatus {
  if (status === 'in-progress') return 'in_progress';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'planned';
}

export interface InstallerDates { startDate: string; endDate: string }

interface BookableProject {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  assigneeIds: string[];
  installerDateOverrides?: Record<string, InstallerDates>;
}

/**
 * The days one installer works on an order. Own days (a part of the order)
 * win over the order period, but are always clamped inside it.
 */
export function installerDatesFor(
  project: Pick<BookableProject, 'startDate' | 'endDate' | 'installerDateOverrides'>,
  installerId: string,
): InstallerDates {
  const o = project.installerDateOverrides?.[installerId];
  if (!o?.startDate || !o?.endDate) return { startDate: project.startDate, endDate: project.endDate };
  let s = o.startDate < project.startDate ? project.startDate : o.startDate;
  let e = o.endDate > project.endDate ? project.endDate : o.endDate;
  if (s > project.endDate || e < project.startDate || e < s) {
    s = project.startDate; e = project.endDate;
  }
  return { startDate: s, endDate: e };
}

/** True when own days lie inside the order period and end ≥ start. */
export function isValidInstallerRange(orderStart: string, orderEnd: string, d: InstallerDates): boolean {
  return !!d.startDate && !!d.endDate && d.startDate <= d.endDate && d.startDate >= orderStart && d.endDate <= orderEnd;
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diffDays = (a: string, b: string) =>
  Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000);

/**
 * When the order moves, own days move by the same number of days and are then
 * clamped to the new order period. Overrides equal to the whole order are dropped.
 */
export function shiftInstallerOverrides(
  overrides: Record<string, InstallerDates> | undefined,
  oldStart: string,
  newStart: string,
  newEnd: string,
): Record<string, InstallerDates> {
  const shift = diffDays(oldStart, newStart);
  const out: Record<string, InstallerDates> = {};
  for (const [id, o] of Object.entries(overrides ?? {})) {
    const moved = { startDate: addDays(o.startDate, shift), endDate: addDays(o.endDate, shift) };
    const d = installerDatesFor({ startDate: newStart, endDate: newEnd, installerDateOverrides: { [id]: moved } }, id);
    if (d.startDate !== newStart || d.endDate !== newEnd) out[id] = d;
  }
  return out;
}

export interface BookingRow {
  project_id: string;
  installer_id: string;
  planned_start_at: string;
  planned_end_at: string;
  assignment_status: BookingStatus;
  override_reason: string | null;
}

/** The exact booking rows an order should have — one per installer, on that installer's days. */
export function bookingRowsFor(
  project: BookableProject,
  rowId: string,
  overrideReason?: string,
): BookingRow[] {
  if (project.status === 'cancelled') return [];
  const installerIds = Array.from(new Set(project.assigneeIds ?? [])).filter(Boolean);
  if (!installerIds.length) return [];
  return installerIds.map(installerId => {
    const d = installerDatesFor(project, installerId);
    const { start, end } = bookingWindow(d.startDate, d.endDate, project.startTime, project.endTime);
    return {
      project_id: rowId,
      installer_id: installerId,
      planned_start_at: start,
      planned_end_at: end,
      assignment_status: bookingStatusForProject(project.status),
      override_reason: overrideReason?.trim() || null,
    };
  });
}

/**
 * The one write path for bookings. Creating an order, moving it in the plan,
 * changing dates or times, swapping, adding or removing an installer and bulk
 * assignment all end up here, so assignments always match the order.
 */
export async function syncProjectBookings(
  project: BookableProject,
  opts: { rowId?: string; overrideReason?: string } = {},
): Promise<SaveBookingsResult> {
  const rowId = opts.rowId ?? (await ensureProjectRowId(project.id));
  if (!rowId) return { ok: false, conflict: false, error: 'Order not found in the database' };

  const rows = bookingRowsFor(project, rowId, opts.overrideReason);
  const installerIds = rows.map(r => r.installer_id);

  // Anything no longer on the order loses its booking — never leave orphans behind.
  const stale = supabase.from('assignments').delete().eq('project_id', rowId);
  const { error: delError } = installerIds.length
    ? await stale.not('installer_id', 'in', `(${installerIds.join(',')})`)
    : await stale;
  if (delError) return { ok: false, conflict: false, error: delError.message };

  if (!rows.length) return { ok: true, conflict: false };

  const { error } = await supabase
    .from('assignments')
    .upsert(rows.map(r => ({ ...r, updated_at: new Date().toISOString() })), {
      onConflict: 'project_id,installer_id',
    });


  if (error) return { ok: false, conflict: isConflictError(error.message), error: error.message };
  return { ok: true, conflict: false };
}

/** True when the database refused the booking because of a clash or absence. */
export function isConflictError(message: string | undefined | null): boolean {
  const msg = (message ?? '').toLowerCase();
  return (
    msg.includes('assignments_no_overlap') ||
    msg.includes('conflict') ||
    msg.includes('override reason') ||
    msg.includes('absence') ||
    msg.includes('bokningskrock')
  );
}

/** Friendly Swedish wording for a refused booking. */
export function bookingErrorMessage(message: string | undefined | null): string {
  if (isConflictError(message)) {
    const m = /Bokningskrock: (.*?)(?:\. En admin|$)/.exec(message ?? '');
    return m
      ? `Bokningskrock: ${m[1]}.`
      : 'Bokningen krockar med en annan order eller planerad frånvaro.';
  }
  return `Bokningen kunde inte sparas: ${message ?? 'okänt fel'}`;
}

/** Removes every booking for an order (used when the order itself is removed). */
export async function deleteProjectBookings(rowId: string): Promise<void> {
  await supabase.from('assignments').delete().eq('project_id', rowId);
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
  return syncProjectBookings(
    {
      id: params.projectRef,
      status: params.status === 'in_progress' ? 'in-progress' : 'scheduled',
      startDate: params.startDate,
      endDate: params.endDate,
      startTime: params.startTime,
      endTime: params.endTime,
      assigneeIds: params.installerIds,
    },
    { overrideReason: params.overrideReason },
  );
}
