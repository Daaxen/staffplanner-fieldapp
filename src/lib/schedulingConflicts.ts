// Automatic scheduling conflict detection: availability, project overlap,
// vehicle bookings and travel time between consecutive assignments.

import type { Installer, Project } from '@/data/mockData';
import { locationDistances } from '@/data/mockData';
import type { Vehicle } from '@/data/fleetData';

export type ConflictSeverity = 'blocking' | 'warning';
export type ConflictKind = 'availability' | 'overlap' | 'vehicle' | 'travel';

export interface ScheduleConflict {
  id: string;
  kind: ConflictKind;
  severity: ConflictSeverity;
  installerId?: string;
  title: string;
  detail: string;
}

export interface AssignmentDraft {
  projectId?: string;
  name?: string;
  startDate: string; // yyyy-MM-dd
  endDate: string;   // yyyy-MM-dd
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  location?: string;
  lat?: number;
  lng?: number;
  vehicleId?: string;
}

/** Minutes of travel tolerated between two assignments on the same day. */
export const TRAVEL_BUFFER_MINUTES = 30;
/** Assumed average travel speed (km/h) when estimating travel time. */
const AVG_SPEED_KMH = 60;

const INACTIVE_STATUSES = ['completed', 'cancelled'];

const datesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  aStart <= bEnd && aEnd >= bStart;

const toMinutes = (time?: string) => {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
};

/** True when two bookings clash. Same-day bookings may still clash on times. */
const bookingsClash = (a: AssignmentDraft, b: Pick<Project, 'startDate' | 'endDate' | 'startTime' | 'endTime'>) => {
  if (!datesOverlap(a.startDate, a.endDate, b.startDate, b.endDate)) return false;
  // Multi-day overlap always clashes; single shared day can be split by times.
  const singleDay = a.startDate === a.endDate && b.startDate === b.endDate && a.startDate === b.startDate;
  if (!singleDay) return true;
  const aS = toMinutes(a.startTime), aE = toMinutes(a.endTime);
  const bS = toMinutes(b.startTime), bE = toMinutes(b.endTime);
  if (aS === null || aE === null || bS === null || bE === null) return true;
  return aS < bE && bS < aE;
};

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/** Distance in km between a draft and an existing project, when known. */
const distanceKm = (draft: AssignmentDraft, project: Project): number | null => {
  if (draft.lat != null && draft.lng != null && project.locationLat != null && project.locationLng != null) {
    return haversineKm(draft.lat, draft.lng, project.locationLat, project.locationLng);
  }
  if (draft.location && project.location) {
    const km = locationDistances[draft.location]?.[project.location];
    if (km !== undefined) return km;
  }
  return null;
};

export const travelMinutes = (km: number) => Math.round((km / AVG_SPEED_KMH) * 60);

const activeProjects = (projects: Project[], draft: AssignmentDraft) =>
  projects.filter(p => p.id !== draft.projectId && !INACTIVE_STATUSES.includes(p.status));

/** Availability + project overlap + travel time for one installer. */
export const installerConflicts = (
  installer: Installer,
  draft: AssignmentDraft,
  projects: Project[],
): ScheduleConflict[] => {
  const out: ScheduleConflict[] = [];

  // 1. Employee availability (absences)
  (installer.absences ?? []).forEach(a => {
    if (datesOverlap(draft.startDate, draft.endDate, a.startDate, a.endDate)) {
      out.push({
        id: `absence-${installer.id}-${a.id}`,
        kind: 'availability',
        severity: 'blocking',
        installerId: installer.id,
        title: `${installer.name} is unavailable`,
        detail: `${a.label || a.type} from ${a.startDate} to ${a.endDate}.`,
      });
    }
  });

  const theirs = activeProjects(projects, draft).filter(p => p.assigneeIds.includes(installer.id));

  // 2. Project overlap (double booking)
  theirs.forEach(p => {
    if (bookingsClash(draft, p)) {
      out.push({
        id: `overlap-${installer.id}-${p.id}`,
        kind: 'overlap',
        severity: 'blocking',
        installerId: installer.id,
        title: `${installer.name} is already booked`,
        detail: `${p.name} (${p.id}) ${p.startDate}${p.startTime ? ` ${p.startTime}` : ''} → ${p.endDate}${p.endTime ? ` ${p.endTime}` : ''}.`,
      });
    }
  });

  // 3. Travel time between assignments on the same day
  const draftStart = toMinutes(draft.startTime);
  const draftEnd = toMinutes(draft.endTime);
  theirs.forEach(p => {
    if (bookingsClash(draft, p)) return; // already reported as a hard clash
    const sameDay = p.startDate === draft.endDate || p.endDate === draft.startDate;
    if (!sameDay) return;
    const km = distanceKm(draft, p);
    if (km === null || km <= 0) return;
    const minutes = travelMinutes(km);

    const otherStart = toMinutes(p.startTime);
    const otherEnd = toMinutes(p.endTime);
    let gap: number | null = null;
    if (p.endDate === draft.startDate && otherEnd !== null && draftStart !== null) gap = draftStart - otherEnd;
    if (p.startDate === draft.endDate && otherStart !== null && draftEnd !== null) {
      const g = otherStart - draftEnd;
      gap = gap === null ? g : Math.min(gap, g);
    }
    if (gap === null) return;
    if (gap < minutes + TRAVEL_BUFFER_MINUTES) {
      out.push({
        id: `travel-${installer.id}-${p.id}`,
        kind: 'travel',
        severity: gap < minutes ? 'blocking' : 'warning',
        installerId: installer.id,
        title: `Not enough travel time for ${installer.name}`,
        detail: `${Math.round(km)} km (~${minutes} min) from ${p.name}, but only ${Math.max(0, gap)} min between the jobs.`,
      });
    }
  });

  return out;
};

/** Vehicle already committed to another job in the same period. */
export const vehicleConflicts = (
  vehicleId: string | undefined,
  draft: AssignmentDraft,
  projects: Project[],
  vehicles: Vehicle[],
): ScheduleConflict[] => {
  if (!vehicleId) return [];
  const vehicle = vehicles.find(v => v.id === vehicleId);
  if (!vehicle) return [];
  const out: ScheduleConflict[] = [];
  const label = `${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})`;

  if (vehicle.status === 'service' || vehicle.status === 'out-of-service') {
    out.push({
      id: `vehicle-status-${vehicle.id}`,
      kind: 'vehicle',
      severity: 'blocking',
      title: `${label} is not available`,
      detail: vehicle.status === 'service' ? 'The vehicle is in service.' : 'The vehicle is out of service.',
    });
  }

  if (vehicle.assignedProjectId && vehicle.assignedProjectId !== draft.projectId) {
    const other = projects.find(p => p.id === vehicle.assignedProjectId);
    if (other && !INACTIVE_STATUSES.includes(other.status) && bookingsClash(draft, other)) {
      out.push({
        id: `vehicle-booked-${vehicle.id}`,
        kind: 'vehicle',
        severity: 'blocking',
        title: `${label} is already booked`,
        detail: `${other.name} (${other.id}) ${other.startDate} → ${other.endDate}.`,
      });
    }
  }

  return out;
};

export interface ConflictCheckInput {
  installerIds: string[];
  draft: AssignmentDraft;
  installers: Installer[];
  projects: Project[];
  vehicles?: Vehicle[];
}

export const detectConflicts = ({
  installerIds,
  draft,
  installers,
  projects,
  vehicles = [],
}: ConflictCheckInput): ScheduleConflict[] => {
  if (!draft.startDate || !draft.endDate) return [];
  const out: ScheduleConflict[] = [];
  installerIds.forEach(id => {
    const inst = installers.find(i => i.id === id);
    if (inst) out.push(...installerConflicts(inst, draft, projects));
  });
  out.push(...vehicleConflicts(draft.vehicleId, draft, projects, vehicles));
  return out;
};

export const hasBlocking = (conflicts: ScheduleConflict[]) =>
  conflicts.some(c => c.severity === 'blocking');

export const conflictSummary = (conflicts: ScheduleConflict[]) => {
  const blocking = conflicts.filter(c => c.severity === 'blocking').length;
  const warnings = conflicts.length - blocking;
  return { blocking, warnings };
};
