import type { Installer, Project } from '@/data/mockData';
import { computeCapacity, rangeDays, utilizationLevel, WORK_HOURS_PER_DAY, type CapacityLevel } from '@/lib/capacity';
import type { AbsenceRow } from '@/hooks/useResourceData';

export const HORIZONS = [30, 60, 90] as const;
export type Horizon = (typeof HORIZONS)[number];

export interface HeatCell {
  weekStart: string;
  label: string;
  plannedHours: number;
  availableHours: number;
  utilization: number;
  level: CapacityLevel;
  absent: boolean;
}

export interface ResourceRow {
  installer: Installer;
  availableHours: number;
  plannedHours: number;
  utilization: number;
  level: CapacityLevel;
  absenceDays: number;
  jobs: number;
  cells: HeatCell[];
}

export interface AbsenceConflict {
  installer: Installer;
  project: Project;
  absence: AbsenceRow;
}

export interface PlannerTip {
  kind: 'overload' | 'idle' | 'unassigned' | 'absence' | 'override';
  text: string;
}

export interface ResourcePlan {
  rows: ResourceRow[];
  weeks: { start: string; label: string }[];
  totalAvailable: number;
  totalPlanned: number;
  utilization: number;
  level: CapacityLevel;
  unassignedJobs: Project[];
  conflicts: AbsenceConflict[];
  tips: PlannerTip[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

const startOfWeek = (d: Date) => {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = (out.getDay() + 6) % 7; // Monday = 0
  out.setDate(out.getDate() - wd);
  return out;
};

const weekLabel = (d: Date) =>
  d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const overlaps = (aStart?: string, aEnd?: string, bStart?: string, bEnd?: string) =>
  !!aStart && !!aEnd && !!bStart && !!bEnd &&
  aStart.slice(0, 10) <= bEnd.slice(0, 10) && bStart.slice(0, 10) <= aEnd.slice(0, 10);

export interface PlanFilters {
  region: string;
  type: 'all' | 'own' | 'sub-vendor';
}

/** Regions available for filtering, taken from the installers' base locations. */
export function regionsOf(installers: Installer[]): string[] {
  return Array.from(new Set(installers.map(i => i.baseLocation).filter(Boolean))).sort();
}

export function buildResourcePlan(
  installersIn: Installer[],
  projects: Project[],
  absences: AbsenceRow[],
  horizon: Horizon,
  filters: PlanFilters,
  overrideCount = 0,
): ResourcePlan {
  // Attach planned absences so capacity is calculated on real availability.
  const installers = installersIn
    .filter(i => filters.type === 'all' || i.type === filters.type)
    .filter(i => filters.region === 'all' || i.baseLocation === filters.region)
    .map(i => ({
      ...i,
      absences: absences
        .filter(a => a.installerId === i.id)
        .map(a => ({ id: a.id, type: a.type, startDate: a.startDate, endDate: a.endDate, label: a.label ?? '' })),
    })) as Installer[];

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + horizon - 1);

  const summary = computeCapacity(installers, projects, start, end);

  // Week buckets across the horizon
  const weeks: { start: string; label: string }[] = [];
  const cursor = startOfWeek(start);
  while (cursor <= end) {
    weeks.push({ start: iso(cursor), label: weekLabel(cursor) });
    cursor.setDate(cursor.getDate() + 7);
  }

  const rows: ResourceRow[] = summary.rows.map(r => {
    const cells: HeatCell[] = weeks.map(w => {
      const wStart = new Date(`${w.start}T00:00:00`);
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 6);
      const week = computeCapacity([r.installer], projects, wStart, wEnd);
      const cell = week.rows[0];
      return {
        weekStart: w.start,
        label: w.label,
        plannedHours: cell?.scheduledHours ?? 0,
        availableHours: cell?.availableHours ?? 0,
        utilization: cell?.utilization ?? 0,
        level: utilizationLevel(cell?.utilization ?? 0),
        absent: (cell?.absenceDays ?? 0) > 0,
      };
    });
    return {
      installer: r.installer,
      availableHours: r.availableHours,
      plannedHours: r.scheduledHours,
      utilization: r.utilization,
      level: r.level,
      absenceDays: r.absenceDays,
      jobs: r.jobs,
      cells,
    };
  });

  // Jobs planned on top of a planned absence
  const horizonDays = rangeDays(start, end);
  const conflicts: AbsenceConflict[] = [];
  for (const installer of installers) {
    const own = projects.filter(
      p => p.assigneeIds.includes(installer.id) && p.status !== 'cancelled' && p.status !== 'completed',
    );
    for (const project of own) {
      for (const absence of absences.filter(a => a.installerId === installer.id)) {
        if (
          overlaps(project.startDate, project.endDate, absence.startDate, absence.endDate) &&
          horizonDays.some(d => d >= absence.startDate.slice(0, 10) && d <= absence.endDate.slice(0, 10))
        ) {
          conflicts.push({ installer, project, absence });
        }
      }
    }
  }

  const tips: PlannerTip[] = [];
  const overloaded = rows.filter(r => r.utilization > 100);
  const idle = rows.filter(r => r.availableHours > 0 && r.utilization < 50);
  if (overloaded.length && idle.length) {
    tips.push({
      kind: 'overload',
      text: `Move work from ${overloaded.map(r => r.installer.name).join(', ')} to ${idle
        .slice(0, 3)
        .map(r => r.installer.name)
        .join(', ')} — they have spare hours in this period.`,
    });
  } else if (overloaded.length) {
    tips.push({
      kind: 'overload',
      text: `${overloaded.map(r => r.installer.name).join(', ')} are booked above capacity. Add a sub-vendor or move the deadline.`,
    });
  }
  if (summary.unassignedJobs.length) {
    tips.push({
      kind: 'unassigned',
      text: `${summary.unassignedJobs.length} order${summary.unassignedJobs.length === 1 ? '' : 's'} in the next ${horizon} days still have nobody assigned (${Math.round(summary.unassignedHours)} h).`,
    });
  }
  if (conflicts.length) {
    tips.push({
      kind: 'absence',
      text: `${conflicts.length} booking${conflicts.length === 1 ? '' : 's'} clash with a planned absence — reschedule or reassign.`,
    });
  }
  if (overrideCount > 0) {
    tips.push({ kind: 'override', text: `${overrideCount} double bookings were pushed through with an override reason. Review them.` });
  }
  if (idle.length && !overloaded.length && summary.unassignedJobs.length === 0) {
    tips.push({
      kind: 'idle',
      text: `Spare capacity: ${Math.round(summary.totalAvailable - summary.totalScheduled)} h free over the next ${horizon} days — good window for quoted work.`,
    });
  }

  return {
    rows,
    weeks,
    totalAvailable: summary.totalAvailable,
    totalPlanned: summary.totalScheduled,
    utilization: summary.utilization,
    level: summary.level,
    unassignedJobs: summary.unassignedJobs,
    conflicts,
    tips,
  };
}

export { WORK_HOURS_PER_DAY };
