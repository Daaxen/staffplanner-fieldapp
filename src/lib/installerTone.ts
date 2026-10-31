// Colour language for the installer app: green = done, yellow = in progress,
// blue = planned/to do, red = problem/missing, gray = cancelled/optional.
export type Tone = 'done' | 'progress' | 'planned' | 'problem' | 'neutral';

export const statusTone: Record<string, Tone> = {
  completed: 'done',
  'in-progress': 'progress',
  scheduled: 'planned',
  open: 'planned',
  'on-hold': 'problem',
  cancelled: 'neutral',
};

export const toneFor = (status: string): Tone => statusTone[status] ?? 'neutral';

export const toneClasses: Record<Tone, { border: string; badge: string; surface: string; icon: string; dot: string }> = {
  done: { border: 'border-status-completed', badge: 'bg-status-completed text-primary-foreground', surface: 'bg-status-completed/10 border-status-completed/40', icon: 'text-status-completed', dot: 'bg-status-completed' },
  progress: { border: 'border-status-in-progress', badge: 'bg-status-in-progress text-foreground', surface: 'bg-status-in-progress/15 border-status-in-progress/50', icon: 'text-status-in-progress', dot: 'bg-status-in-progress' },
  planned: { border: 'border-status-scheduled', badge: 'bg-status-scheduled/15 text-status-scheduled border border-status-scheduled/40', surface: 'bg-status-scheduled/10 border-status-scheduled/40', icon: 'text-status-scheduled', dot: 'bg-status-scheduled' },
  problem: { border: 'border-destructive', badge: 'bg-destructive/15 text-destructive border border-destructive/40', surface: 'bg-destructive/10 border-destructive/40', icon: 'text-destructive', dot: 'bg-destructive' },
  neutral: { border: 'border-status-cancelled', badge: 'bg-muted text-muted-foreground border border-border', surface: 'bg-muted border-border', icon: 'text-muted-foreground', dot: 'bg-status-cancelled' },
};

/** Swedish status labels shown on installer badges. */
export const svStatusLabels: Record<string, string> = {
  completed: 'Klar',
  'in-progress': 'Pågår',
  scheduled: 'Planerad',
  open: 'Ej tilldelad',
  'on-hold': 'Pausad',
  cancelled: 'Avbruten',
  overdue: 'Ej avslutad',
};

/**
 * Status shown on installer cards. An order whose end date has passed but is
 * still marked in-progress is shown as 'overdue' (red) instead of 'Pågår'.
 */
export const displayStatus = (
  status: string,
  endDate: string | undefined,
  today: string,
): string =>
  status === 'in-progress' && endDate && endDate.slice(0, 10) < today ? 'overdue' : status;

/** Report shortcut tone: green once something is saved, otherwise the "to do" tone. */
export const reportTone = (saved: boolean, todo: Tone = 'planned'): Tone => (saved ? 'done' : todo);

const isoDays = (start: string, end: string): string[] => {
  const out: string[] = [];
  const d = new Date(`${start.slice(0, 10)}T12:00:00Z`);
  const e = new Date(`${(end || start).slice(0, 10)}T12:00:00Z`);
  while (d <= e && out.length < 366) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
};

/**
 * Time shortcut tone: green only when every passed order day (≤ today) has time,
 * yellow when some do, blue when none. Future days are not counted.
 */
export function timeDaysTone(
  range: { startDate: string; endDate: string },
  entries: { date: string }[],
  today: string,
): { tone: Tone; covered: number; total: number } {
  const days = range.startDate ? isoDays(range.startDate, range.endDate).filter(d => d <= today) : [];
  const logged = new Set(entries.map(e => e.date.slice(0, 10)));
  const covered = days.filter(d => logged.has(d)).length;
  const total = days.length;
  if (total === 0) return { tone: entries.length > 0 ? 'done' : 'planned', covered, total };
  const tone: Tone = covered === 0 ? 'planned' : covered === total ? 'done' : 'progress';
  return { tone, covered, total };
}
