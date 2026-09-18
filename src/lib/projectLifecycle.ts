// Project lifecycle: statuses, transition rules and presentation helpers.

export type ProjectStatus =
  | 'draft'
  | 'quoted'
  | 'quote-accepted'
  | 'planned'
  | 'assigned'
  | 'in-progress'
  | 'waiting-for-customer'
  | 'on-hold'
  | 'completed-on-site'
  | 'documentation-pending'
  | 'reported'
  | 'customer-approved'
  | 'invoiced'
  | 'closed'
  | 'cancelled';

/** Main sequence — required order, no skipping. */
export const statusSequence: ProjectStatus[] = [
  'draft',
  'quoted',
  'quote-accepted',
  'planned',
  'assigned',
  'in-progress',
  'completed-on-site',
  'documentation-pending',
  'reported',
  'customer-approved',
  'invoiced',
  'closed',
];

/** Statuses that pause the flow and return to where they came from. */
export const pausedStatuses: ProjectStatus[] = ['waiting-for-customer', 'on-hold'];

export const allStatuses: ProjectStatus[] = [
  'draft',
  'quoted',
  'quote-accepted',
  'planned',
  'assigned',
  'in-progress',
  'waiting-for-customer',
  'on-hold',
  'completed-on-site',
  'documentation-pending',
  'reported',
  'customer-approved',
  'invoiced',
  'closed',
  'cancelled',
];

export const statusLabels: Record<ProjectStatus, string> = {
  'draft': 'Draft',
  'quoted': 'Quoted',
  'quote-accepted': 'Quote Accepted',
  'planned': 'Planned',
  'assigned': 'Assigned',
  'in-progress': 'In Progress',
  'waiting-for-customer': 'Waiting For Customer',
  'on-hold': 'On Hold',
  'completed-on-site': 'Completed On Site',
  'documentation-pending': 'Documentation Pending',
  'reported': 'Reported',
  'customer-approved': 'Customer Approved',
  'invoiced': 'Invoiced',
  'closed': 'Closed',
  'cancelled': 'Cancelled',
};

/** Tailwind background classes (semantic tokens only). */
export const statusColorMap: Record<ProjectStatus, string> = {
  'draft': 'bg-status-cancelled',
  'quoted': 'bg-status-open',
  'quote-accepted': 'bg-status-open',
  'planned': 'bg-status-scheduled',
  'assigned': 'bg-status-scheduled',
  'in-progress': 'bg-status-in-progress',
  'waiting-for-customer': 'bg-status-on-hold',
  'on-hold': 'bg-status-on-hold',
  'completed-on-site': 'bg-status-completed',
  'documentation-pending': 'bg-status-in-progress',
  'reported': 'bg-status-completed',
  'customer-approved': 'bg-status-completed',
  'invoiced': 'bg-status-confirmed',
  'closed': 'bg-status-cancelled',
  'cancelled': 'bg-status-cancelled',
};

export const statusTextMap: Record<ProjectStatus, string> = {
  'draft': 'text-status-cancelled',
  'quoted': 'text-status-open',
  'quote-accepted': 'text-status-open',
  'planned': 'text-status-scheduled',
  'assigned': 'text-status-scheduled',
  'in-progress': 'text-status-in-progress',
  'waiting-for-customer': 'text-status-on-hold',
  'on-hold': 'text-status-on-hold',
  'completed-on-site': 'text-status-completed',
  'documentation-pending': 'text-status-in-progress',
  'reported': 'text-status-completed',
  'customer-approved': 'text-status-completed',
  'invoiced': 'text-status-confirmed',
  'closed': 'text-status-cancelled',
  'cancelled': 'text-status-cancelled',
};

export const statusBorderMap: Record<ProjectStatus, string> = Object.fromEntries(
  allStatuses.map(s => [s, statusColorMap[s].replace('bg-', 'border-')]),
) as Record<ProjectStatus, string>;

/** Statuses that count as work no longer active on the board. */
export const closedStatuses: ProjectStatus[] = ['closed', 'cancelled'];
export const doneOnSiteStatuses: ProjectStatus[] = [
  'completed-on-site',
  'documentation-pending',
  'reported',
  'customer-approved',
  'invoiced',
  'closed',
];
/** Statuses where the job is planned/assigned but work has not finished. */
export const activeBoardStatuses: ProjectStatus[] = [
  'draft', 'quoted', 'quote-accepted', 'planned', 'assigned',
  'in-progress', 'waiting-for-customer', 'on-hold',
];

export const isUnassignedStatus = (s: ProjectStatus) =>
  s === 'draft' || s === 'quoted' || s === 'quote-accepted' || s === 'planned';

/** Where work may pause from, and which statuses may be resumed into. */
const PAUSE_FROM: ProjectStatus[] = ['assigned', 'in-progress', 'documentation-pending'];
const RESUME_TO: ProjectStatus[] = ['assigned', 'in-progress', 'documentation-pending'];

/**
 * Allowed next statuses. Forward movement is strictly one step along the
 * sequence; steps can never be skipped. Work can pause and resume, and any
 * open project can be cancelled.
 */
export const allowedTransitions = (from: ProjectStatus): ProjectStatus[] => {
  if (from === 'closed' || from === 'cancelled') return [];

  if (pausedStatuses.includes(from)) {
    return [...RESUME_TO, ...pausedStatuses.filter(s => s !== from), 'cancelled'];
  }

  const idx = statusSequence.indexOf(from);
  const next: ProjectStatus[] = [];
  if (idx >= 0 && idx < statusSequence.length - 1) next.push(statusSequence[idx + 1]);
  if (idx > 0) next.push(statusSequence[idx - 1]); // step back to correct a mistake
  if (PAUSE_FROM.includes(from)) next.push(...pausedStatuses);
  next.push('cancelled');
  return Array.from(new Set(next));
};

export const canTransition = (from: ProjectStatus, to: ProjectStatus): boolean =>
  from === to || allowedTransitions(from).includes(to);

export const transitionError = (from: ProjectStatus, to: ProjectStatus): string | null => {
  if (canTransition(from, to)) return null;
  if (from === 'closed' || from === 'cancelled') {
    return `${statusLabels[from]} is final — this order can no longer change status.`;
  }
  const fromIdx = statusSequence.indexOf(from);
  const toIdx = statusSequence.indexOf(to);
  if (fromIdx >= 0 && toIdx > fromIdx + 1) {
    const missing = statusSequence.slice(fromIdx + 1, toIdx).map(s => statusLabels[s]).join(' → ');
    return `Steps cannot be skipped. ${statusLabels[to]} requires ${missing} first.`;
  }
  return `${statusLabels[from]} cannot move directly to ${statusLabels[to]}.`;
};

/** Map statuses saved before the lifecycle redesign onto the new ones. */
const LEGACY: Record<string, ProjectStatus> = {
  'open': 'planned',
  'scheduled': 'assigned',
  'confirmed': 'assigned',
  'completed': 'completed-on-site',
  'in-progress': 'in-progress',
  'on-hold': 'on-hold',
  'cancelled': 'cancelled',
};

export const normalizeStatus = (value: string | null | undefined): ProjectStatus => {
  if (!value) return 'draft';
  if ((allStatuses as string[]).includes(value)) return value as ProjectStatus;
  return LEGACY[value] ?? 'draft';
};

/** Soft translucent background (Gantt bars). */
export const statusSoftMap: Record<ProjectStatus, string> = Object.fromEntries(
  allStatuses.map(s => [s, `${statusColorMap[s]}/20`]),
) as Record<ProjectStatus, string>;

/** Badge styling: tinted background + matching text colour. */
export const statusBadgeMap: Record<ProjectStatus, string> = Object.fromEntries(
  allStatuses.map(s => [s, `${statusColorMap[s]}/15 ${statusTextMap[s]}`]),
) as Record<ProjectStatus, string>;
