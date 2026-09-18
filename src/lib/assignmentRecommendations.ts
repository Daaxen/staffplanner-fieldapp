import { locationDistances, type Installer, type Project, type ProjectType } from '@/data/mockData';
import {
  haversineKm,
  installerConflicts,
  travelMinutes,
  type AssignmentDraft,
  type ScheduleConflict,
} from './schedulingConflicts';

export interface RecommendationFactor {
  id: 'distance' | 'travel' | 'workload' | 'skill' | 'availability';
  label: string;
  /** 0-100 */
  score: number;
  detail: string;
}

export interface InstallerRecommendation {
  installer: Installer;
  /** 0-100 weighted total */
  score: number;
  rank: number;
  recommended: boolean;
  blocked: boolean;
  factors: RecommendationFactor[];
  conflicts: ScheduleConflict[];
  distanceKm: number | null;
  travelMinutes: number | null;
  workload: number;
  skillJobs: number;
}

const WEIGHTS: Record<RecommendationFactor['id'], number> = {
  distance: 0.2,
  travel: 0.15,
  workload: 0.25,
  skill: 0.2,
  availability: 0.2,
};

const INACTIVE = ['completed', 'cancelled'];

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  aStart <= bEnd && aEnd >= bStart;

/** Distance from where the installer works to the new site, when it can be derived. */
const distanceToSite = (
  installer: Installer,
  draft: AssignmentDraft,
  projects: Project[],
): number | null => {
  if (draft.location && installer.baseLocation) {
    const km = locationDistances[installer.baseLocation]?.[draft.location];
    if (km !== undefined) return km;
  }
  if (draft.lat != null && draft.lng != null) {
    const nearby = projects
      .filter(
        p =>
          p.assigneeIds.includes(installer.id) &&
          !INACTIVE.includes(p.status) &&
          p.locationLat != null &&
          p.locationLng != null,
      )
      .map(p => haversineKm(draft.lat!, draft.lng!, p.locationLat!, p.locationLng!));
    if (nearby.length > 0) return Math.round(Math.min(...nearby));
  }
  return null;
};

const scoreFromDistance = (km: number | null) => {
  if (km === null) return 50;
  if (km <= 5) return 100;
  if (km <= 10) return 85;
  if (km <= 25) return 65;
  if (km <= 50) return 40;
  if (km <= 100) return 20;
  return 5;
};

const scoreFromTravel = (minutes: number | null) => {
  if (minutes === null) return 50;
  if (minutes <= 15) return 100;
  if (minutes <= 30) return 80;
  if (minutes <= 60) return 55;
  if (minutes <= 120) return 25;
  return 5;
};

export interface RecommendationInput {
  installers: Installer[];
  projects: Project[];
  draft: AssignmentDraft;
  projectType?: ProjectType;
  /** How many installers to flag as recommended. */
  topN?: number;
}

export const recommendInstallers = ({
  installers,
  projects,
  draft,
  projectType,
  topN = 3,
}: RecommendationInput): InstallerRecommendation[] => {
  const scored = installers.map(installer => {
    const conflicts = installerConflicts(installer, draft, projects);
    const blocked = conflicts.some(c => c.severity === 'blocking');

    // Distance + travel
    const km = distanceToSite(installer, draft, projects);
    const minutes = km === null ? null : travelMinutes(km);

    // Workload: active bookings overlapping the period
    const booked = projects.filter(
      p =>
        p.id !== draft.projectId &&
        p.assigneeIds.includes(installer.id) &&
        !INACTIVE.includes(p.status) &&
        overlaps(p.startDate, p.endDate, draft.startDate, draft.endDate),
    );
    const workloadScore = Math.max(0, 100 - booked.length * 40);

    // Skill match: experience with this kind of job
    const skillJobs = projectType
      ? projects.filter(p => p.assigneeIds.includes(installer.id) && p.projectType === projectType).length
      : 0;
    const skillScore = !projectType
      ? 50
      : skillJobs >= 5
        ? 100
        : skillJobs >= 3
          ? 85
          : skillJobs >= 1
            ? 65
            : 35;

    // Availability: absences and scheduling conflicts
    const absent = installer.absences.some(a =>
      overlaps(a.startDate, a.endDate, draft.startDate, draft.endDate),
    );
    const warnings = conflicts.filter(c => c.severity === 'warning').length;
    const availabilityScore = blocked || absent ? 0 : Math.max(0, 100 - warnings * 25);

    const factors: RecommendationFactor[] = [
      {
        id: 'distance',
        label: 'Distance to site',
        score: scoreFromDistance(km),
        detail: km === null ? 'Distance unknown' : `~${Math.round(km)} km`,
      },
      {
        id: 'travel',
        label: 'Travel duration',
        score: scoreFromTravel(minutes),
        detail: minutes === null ? 'Travel time unknown' : `~${minutes} min`,
      },
      {
        id: 'workload',
        label: 'Existing workload',
        score: workloadScore,
        detail: booked.length === 0 ? 'No other jobs in period' : `${booked.length} other job(s) in period`,
      },
      {
        id: 'skill',
        label: 'Skill match',
        score: skillScore,
        detail: !projectType
          ? 'Job type unknown'
          : skillJobs === 0
            ? 'No previous jobs of this type'
            : `${skillJobs} previous job(s) of this type`,
      },
      {
        id: 'availability',
        label: 'Availability',
        score: availabilityScore,
        detail: absent
          ? 'Absent during the period'
          : blocked
            ? 'Blocking scheduling conflict'
            : warnings > 0
              ? `${warnings} tight transition(s)`
              : 'Fully available',
      },
    ];

    const score = Math.round(
      factors.reduce((sum, f) => sum + f.score * WEIGHTS[f.id], 0),
    );

    return {
      installer,
      score: blocked || absent ? 0 : score,
      rank: 0,
      recommended: false,
      blocked: blocked || absent,
      factors,
      conflicts,
      distanceKm: km,
      travelMinutes: minutes,
      workload: booked.length,
      skillJobs,
    } satisfies InstallerRecommendation;
  });

  scored.sort((a, b) => b.score - a.score || a.installer.name.localeCompare(b.installer.name));

  return scored.map((r, i) => ({
    ...r,
    rank: i + 1,
    recommended: !r.blocked && r.score > 0 && i < topN,
  }));
};
