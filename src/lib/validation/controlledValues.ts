import { z } from 'zod';

/**
 * Controlled business values. These mirror the reference tables in the
 * database (ref_project_status, ref_project_type, ref_installer_type,
 * ref_absence_type, ref_transport_stop_type, ref_time_source,
 * ref_employment_type, expense_rules). The database is authoritative —
 * these lists exist so the UI can show selects and validate before saving.
 */

export const PROJECT_STATUSES = [
  'open', 'scheduled', 'in-progress', 'on-hold', 'completed', 'cancelled',
] as const;
export type ProjectStatusCode = (typeof PROJECT_STATUSES)[number];

export const PROJECT_TYPES = ['installation', 'site-survey', 'transport'] as const;
export const INSTALLER_TYPES = ['own', 'sub-vendor'] as const;
export const ABSENCE_TYPES = ['vacation', 'sick', 'personal'] as const;
export const TRANSPORT_STOP_TYPES = ['pickup', 'delivery'] as const;
export const TIME_SOURCES = ['manual', 'timer'] as const;
export const EMPLOYMENT_TYPES = ['employee', 'contractor', 'sub_vendor'] as const;

export const employmentTypeLabels: Record<(typeof EMPLOYMENT_TYPES)[number], string> = {
  employee: 'Employee',
  contractor: 'Contractor',
  sub_vendor: 'Sub-vendor',
};

export const absenceTypeLabels: Record<(typeof ABSENCE_TYPES)[number], string> = {
  vacation: 'Vacation',
  sick: 'Sick leave',
  personal: 'Personal',
};

export const installerTypeLabels: Record<(typeof INSTALLER_TYPES)[number], string> = {
  own: 'Own staff',
  'sub-vendor': 'Sub-vendor',
};

export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const projectTypeSchema = z.enum(PROJECT_TYPES);
export const installerTypeSchema = z.enum(INSTALLER_TYPES);
export const absenceTypeSchema = z.enum(ABSENCE_TYPES);
export const transportStopTypeSchema = z.enum(TRANSPORT_STOP_TYPES);
export const timeSourceSchema = z.enum(TIME_SOURCES);
export const employmentTypeSchema = z.enum(EMPLOYMENT_TYPES).nullable().optional();

/** Mirrors ref_project_status_transition. */
export const STATUS_TRANSITIONS: Record<ProjectStatusCode, ProjectStatusCode[]> = {
  open: ['scheduled', 'on-hold', 'cancelled'],
  scheduled: ['open', 'in-progress', 'on-hold', 'cancelled'],
  'in-progress': ['completed', 'on-hold', 'cancelled'],
  'on-hold': ['open', 'scheduled', 'in-progress', 'cancelled'],
  completed: ['in-progress'],
  cancelled: ['open'],
};

export function allowedNextStatuses(from: ProjectStatusCode): ProjectStatusCode[] {
  return STATUS_TRANSITIONS[from] ?? [];
}

export function canTransition(from: ProjectStatusCode, to: ProjectStatusCode): boolean {
  return from === to || allowedNextStatuses(from).includes(to);
}

export function transitionError(
  from: ProjectStatusCode,
  to: ProjectStatusCode,
  labels: Record<string, string>,
): string | null {
  if (canTransition(from, to)) return null;
  return `${labels[from] ?? from} cannot go straight to ${labels[to] ?? to}`;
}
