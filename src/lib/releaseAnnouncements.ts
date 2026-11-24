export type ReleaseRole = 'admin' | 'installer' | 'hr' | 'superuser';
export type ReleaseSeverity = 'info' | 'important' | 'action_required';

export interface ReleaseAnnouncement {
  id: string;
  version: string;
  release_date: string;
  title: string;
  summary: string;
  meaning: string;
  how_it_works: string;
  severity: ReleaseSeverity;
  target_roles: ReleaseRole[];
  is_active: boolean;
  published_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReleaseAcknowledgement {
  id: string;
  announcement_id: string;
  user_id: string;
  acknowledged_at: string;
}

export const RELEASE_ROLE_OPTIONS: Array<{ value: ReleaseRole; label: string }> = [
  { value: 'installer', label: 'Montörer' },
  { value: 'admin', label: 'Administratörer' },
  { value: 'hr', label: 'HR' },
  { value: 'superuser', label: 'Superuser' },
];

export const RELEASE_SEVERITY_LABELS: Record<ReleaseSeverity, string> = {
  info: 'Info',
  important: 'Viktigt',
  action_required: 'Åtgärd krävs',
};

export function expandedStaffRoles(roles: ReleaseRole[]): Set<ReleaseRole> {
  const expanded = new Set(roles);
  if (expanded.has('superuser')) {
    expanded.add('admin');
    expanded.add('hr');
  }
  return expanded;
}

export function announcementMatchesRoles(announcement: Pick<ReleaseAnnouncement, 'target_roles'>, roles: ReleaseRole[]): boolean {
  const expanded = expandedStaffRoles(roles);
  if (expanded.size === 0) return false;
  if (announcement.target_roles.length === 0) return true;
  return announcement.target_roles.some(role => expanded.has(role));
}

export function announcementIsActive(
  announcement: Pick<ReleaseAnnouncement, 'is_active' | 'published_at' | 'ends_at'>,
  now: Date,
): boolean {
  if (!announcement.is_active || !announcement.published_at) return false;
  const publishedAt = new Date(announcement.published_at).getTime();
  const endsAt = announcement.ends_at ? new Date(announcement.ends_at).getTime() : null;
  if (!Number.isFinite(publishedAt) || (endsAt !== null && !Number.isFinite(endsAt))) return false;
  return publishedAt <= now.getTime() && (endsAt === null || endsAt > now.getTime());
}

export function unseenAnnouncementsFor(
  announcements: ReleaseAnnouncement[],
  acknowledgedIds: Set<string>,
  postponedIds: Set<string>,
  roles: ReleaseRole[],
  now: Date,
): ReleaseAnnouncement[] {
  return announcements.filter(announcement =>
    announcementIsActive(announcement, now)
    && announcementMatchesRoles(announcement, roles)
    && !acknowledgedIds.has(announcement.id)
    && !postponedIds.has(announcement.id)
  );
}

export function releaseAudienceLabel(targetRoles: ReleaseRole[]): string {
  if (targetRoles.length === 0) return 'All personal';
  return RELEASE_ROLE_OPTIONS
    .filter(option => targetRoles.includes(option.value))
    .map(option => option.label)
    .join(', ');
}

export function formatReleaseDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('sv-SE', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}
