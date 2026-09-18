import type { Installer, Project } from '@/data/mockData';

export const WORK_HOURS_PER_DAY = 8;
const INACTIVE: string[] = ['completed', 'cancelled'];

export type CapacityLevel = 'green' | 'yellow' | 'red';

export interface InstallerCapacity {
  installer: Installer;
  availableHours: number;
  scheduledHours: number;
  utilization: number; // percent
  overtimeHours: number;
  overtimeRisk: CapacityLevel;
  level: CapacityLevel;
  absenceDays: number;
  jobs: number;
}

export interface CapacitySummary {
  rows: InstallerCapacity[];
  totalAvailable: number;
  totalScheduled: number;
  utilization: number;
  overtimeHours: number;
  atRiskCount: number;
  unassignedJobs: Project[];
  unassignedHours: number;
  level: CapacityLevel;
  days: string[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function rangeDays(start: Date, end: Date): string[] {
  const out: string[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (d <= last) {
    out.push(iso(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const isWorkday = (day: string) => {
  const wd = new Date(`${day}T00:00:00`).getDay();
  return wd !== 0 && wd !== 6;
};

const inRange = (day: string, start?: string, end?: string) =>
  !!start && !!end && day >= start.slice(0, 10) && day <= end.slice(0, 10);

/** Hours a project consumes per working day for one assignee. */
function projectHoursPerDay(project: Project, days: string[]): number {
  const projectDays = days.filter(d => inRange(d, project.startDate, project.endDate) && isWorkday(d));
  if (projectDays.length === 0) return 0;
  const allDays = rangeDays(
    new Date(`${project.startDate.slice(0, 10)}T00:00:00`),
    new Date(`${project.endDate.slice(0, 10)}T00:00:00`),
  ).filter(isWorkday);
  const totalDays = Math.max(1, allDays.length);
  const perAssignee = Math.max(1, project.assigneeIds.length);
  const total = project.estimatedHours && project.estimatedHours > 0
    ? project.estimatedHours / perAssignee
    : totalDays * WORK_HOURS_PER_DAY;
  return total / totalDays;
}

export function utilizationLevel(utilization: number): CapacityLevel {
  if (utilization > 100) return 'red';
  if (utilization >= 85) return 'yellow';
  return 'green';
}

function overtimeLevel(overtimeHours: number, utilization: number): CapacityLevel {
  if (overtimeHours > 0 || utilization > 100) return 'red';
  if (utilization >= 90) return 'yellow';
  return 'green';
}

export function computeCapacity(
  installers: Installer[],
  projects: Project[],
  start: Date,
  end: Date,
): CapacitySummary {
  const days = rangeDays(start, end);
  const workdays = days.filter(isWorkday);
  const active = projects.filter(p => !INACTIVE.includes(p.status));

  const rows: InstallerCapacity[] = installers.map(installer => {
    const absenceDays = workdays.filter(day =>
      (installer.absences ?? []).some(a => inRange(day, a.startDate, a.endDate)),
    ).length;
    const availableHours = Math.max(0, (workdays.length - absenceDays) * WORK_HOURS_PER_DAY);

    const own = active.filter(p => p.assigneeIds.includes(installer.id));
    let scheduledHours = 0;
    for (const p of own) {
      const perDay = projectHoursPerDay(p, days);
      const dayCount = days.filter(d => inRange(d, p.startDate, p.endDate) && isWorkday(d)).length;
      scheduledHours += perDay * dayCount;
    }
    scheduledHours = Math.round(scheduledHours * 10) / 10;

    const utilization = availableHours > 0 ? Math.round((scheduledHours / availableHours) * 100) : (scheduledHours > 0 ? 200 : 0);
    const overtimeHours = Math.max(0, Math.round((scheduledHours - availableHours) * 10) / 10);

    return {
      installer,
      availableHours,
      scheduledHours,
      utilization,
      overtimeHours,
      overtimeRisk: overtimeLevel(overtimeHours, utilization),
      level: utilizationLevel(utilization),
      absenceDays,
      jobs: own.length,
    };
  });

  const unassignedJobs = active.filter(
    p => p.assigneeIds.length === 0 && days.some(d => inRange(d, p.startDate, p.endDate)),
  );
  const unassignedHours = Math.round(
    unassignedJobs.reduce((sum, p) => {
      const perDay = projectHoursPerDay(p, days);
      const dayCount = days.filter(d => inRange(d, p.startDate, p.endDate) && isWorkday(d)).length;
      return sum + perDay * dayCount;
    }, 0) * 10,
  ) / 10;

  const totalAvailable = rows.reduce((s, r) => s + r.availableHours, 0);
  const totalScheduled = Math.round(rows.reduce((s, r) => s + r.scheduledHours, 0) * 10) / 10;
  const utilization = totalAvailable > 0 ? Math.round((totalScheduled / totalAvailable) * 100) : 0;

  return {
    rows: rows.sort((a, b) => b.utilization - a.utilization),
    totalAvailable,
    totalScheduled,
    utilization,
    overtimeHours: Math.round(rows.reduce((s, r) => s + r.overtimeHours, 0) * 10) / 10,
    atRiskCount: rows.filter(r => r.overtimeRisk === 'red').length,
    unassignedJobs,
    unassignedHours,
    level: utilizationLevel(utilization),
    days,
  };
}
