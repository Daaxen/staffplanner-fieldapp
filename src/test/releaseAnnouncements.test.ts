import { describe, expect, it } from 'vitest';
import {
  announcementIsActive,
  announcementMatchesRoles,
  unseenAnnouncementsFor,
  type ReleaseAnnouncement,
} from '@/lib/releaseAnnouncements';

const NOW = new Date('2026-11-24T08:00:00Z');

const announcement = (overrides: Partial<ReleaseAnnouncement> = {}): ReleaseAnnouncement => ({
  id: 'release-1',
  version: '2026-11-24-1',
  release_date: '2026-11-24',
  title: 'Ny funktion',
  summary: 'En praktisk nyhet.',
  meaning: 'Du kan arbeta enklare.',
  how_it_works: 'Öppna funktionen och följ stegen.',
  severity: 'info',
  target_roles: [],
  is_active: true,
  published_at: '2026-11-24T07:00:00Z',
  ends_at: null,
  created_by: null,
  created_at: '2026-11-24T06:00:00Z',
  updated_at: '2026-11-24T06:00:00Z',
  ...overrides,
});

describe('release announcement audience rules', () => {
  it('lets every staff role see an all-staff announcement but blocks a roleless account', () => {
    const item = announcement({ target_roles: [] });
    expect(announcementMatchesRoles(item, ['installer'])).toBe(true);
    expect(announcementMatchesRoles(item, ['admin'])).toBe(true);
    expect(announcementMatchesRoles(item, ['hr'])).toBe(true);
    expect(announcementMatchesRoles(item, [])).toBe(false);
  });

  it('shows installer-only announcements to installers and not to admins', () => {
    const item = announcement({ target_roles: ['installer'] });
    expect(announcementMatchesRoles(item, ['installer'])).toBe(true);
    expect(announcementMatchesRoles(item, ['admin'])).toBe(false);
  });

  it('supports multiple selected audiences', () => {
    const item = announcement({ target_roles: ['installer', 'hr'] });
    expect(announcementMatchesRoles(item, ['hr'])).toBe(true);
    expect(announcementMatchesRoles(item, ['installer'])).toBe(true);
    expect(announcementMatchesRoles(item, ['admin'])).toBe(false);
  });

  it('keeps superuser admin and HR inheritance without adding installer access', () => {
    expect(announcementMatchesRoles(announcement({ target_roles: ['admin'] }), ['superuser'])).toBe(true);
    expect(announcementMatchesRoles(announcement({ target_roles: ['hr'] }), ['superuser'])).toBe(true);
    expect(announcementMatchesRoles(announcement({ target_roles: ['installer'] }), ['superuser'])).toBe(false);
  });
});

describe('release announcement active period', () => {
  it('requires active status and a reached publication time', () => {
    expect(announcementIsActive(announcement({ is_active: false }), NOW)).toBe(false);
    expect(announcementIsActive(announcement({ published_at: null }), NOW)).toBe(false);
    expect(announcementIsActive(announcement({ published_at: '2026-11-24T09:00:00Z' }), NOW)).toBe(false);
    expect(announcementIsActive(announcement(), NOW)).toBe(true);
  });

  it('includes the announcement exactly until its end time', () => {
    const item = announcement({ ends_at: '2026-11-24T08:00:00Z' });
    expect(announcementIsActive(item, new Date('2026-11-24T07:59:59Z'))).toBe(true);
    expect(announcementIsActive(item, NOW)).toBe(false);
  });
});

describe('unseen announcement queue', () => {
  it('removes acknowledged and temporarily postponed items without hiding other news', () => {
    const first = announcement({ id: 'first' });
    const second = announcement({ id: 'second' });
    expect(unseenAnnouncementsFor([first, second], new Set(['first']), new Set(), ['installer'], NOW).map(item => item.id)).toEqual(['second']);
    expect(unseenAnnouncementsFor([first, second], new Set(), new Set(['second']), ['installer'], NOW).map(item => item.id)).toEqual(['first']);
  });
});
