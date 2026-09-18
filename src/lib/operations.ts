import type { Project } from '@/data/mockData';

export interface FieldReportState {
  projectRef: string;
  submittedAt: string | null;
  hasSignature: boolean;
  photoCount: number;
}

export type OpsBucket =
  | 'in-progress'
  | 'delayed'
  | 'missing-docs'
  | 'awaiting-approval'
  | 'awaiting-invoice';

export interface OpsSummary {
  buckets: Record<OpsBucket, Project[]>;
  statusCounts: { status: string; label: string; count: number }[];
  weekly: { week: string; started: number; completed: number }[];
  activeTotal: number;
}

const ACTIVE_STATUSES = ['open', 'scheduled', 'in-progress', 'on-hold'] as const;

const toDate = (v?: string) => (v ? new Date(`${v.slice(0, 10)}T00:00:00`) : null);

export function computeOperations(
  projects: Project[],
  reports: Record<string, FieldReportState>,
  today = new Date(),
): OpsSummary {
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const buckets: Record<OpsBucket, Project[]> = {
    'in-progress': [],
    delayed: [],
    'missing-docs': [],
    'awaiting-approval': [],
    'awaiting-invoice': [],
  };

  for (const p of projects) {
    if (p.status === 'cancelled') continue;
    const report = reports[p.id];
    const end = toDate(p.endDate);

    if (p.status === 'in-progress') buckets['in-progress'].push(p);

    if (
      (ACTIVE_STATUSES as readonly string[]).includes(p.status) &&
      end &&
      end.getTime() < midnight.getTime()
    ) {
      buckets.delayed.push(p);
    }

    const finishedOnSite = p.status === 'completed';
    if (finishedOnSite) {
      const submitted = !!report?.submittedAt;
      const documented = submitted && (report?.photoCount ?? 0) > 0;
      if (!documented) {
        buckets['missing-docs'].push(p);
      } else if (!report?.hasSignature) {
        buckets['awaiting-approval'].push(p);
      } else {
        buckets['awaiting-invoice'].push(p);
      }
    }
  }

  const statusOrder = ['open', 'scheduled', 'in-progress', 'on-hold', 'completed', 'cancelled'];
  const statusCounts = statusOrder.map((status) => ({
    status,
    label: status,
    count: projects.filter((p) => p.status === status).length,
  }));

  // last 8 weeks trend
  const weekStart = (d: Date) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  };
  const weeks: { key: number; week: string; started: number; completed: number }[] = [];
  const base = weekStart(midnight);
  for (let i = 7; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i * 7);
    weeks.push({
      key: d.getTime(),
      week: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      started: 0,
      completed: 0,
    });
  }
  const byKey = new Map(weeks.map((w) => [w.key, w]));
  for (const p of projects) {
    const s = toDate(p.startDate);
    if (s) {
      const w = byKey.get(weekStart(s).getTime());
      if (w) w.started += 1;
    }
    if (p.status === 'completed') {
      const e = toDate(p.endDate);
      if (e) {
        const w = byKey.get(weekStart(e).getTime());
        if (w) w.completed += 1;
      }
    }
  }

  return {
    buckets,
    statusCounts,
    weekly: weeks.map(({ week, started, completed }) => ({ week, started, completed })),
    activeTotal: projects.filter((p) =>
      (ACTIVE_STATUSES as readonly string[]).includes(p.status),
    ).length,
  };
}
