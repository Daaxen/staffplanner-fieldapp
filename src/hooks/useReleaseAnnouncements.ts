import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  unseenAnnouncementsFor,
  type ReleaseAnnouncement,
  type ReleaseRole,
} from '@/lib/releaseAnnouncements';

export function useReleaseAnnouncements() {
  const { user, roles, loading: authLoading } = useAuth();
  const [announcements, setAnnouncements] = useState<ReleaseAnnouncement[]>([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [postponedIds, setPostponedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [acknowledgeError, setAcknowledgeError] = useState<string | null>(null);
  const rolesKey = roles.join(',');
  const typedRoles = useMemo(
    () => rolesKey ? rolesKey.split(',') as ReleaseRole[] : [],
    [rolesKey],
  );

  const load = useCallback(async () => {
    if (!user || typedRoles.length === 0) {
      setAnnouncements([]);
      setAcknowledgedIds(new Set());
      setPostponedIds(new Set());
      return;
    }
    setLoading(true);
    const now = new Date().toISOString();
    const [announcementResult, acknowledgementResult] = await Promise.all([
      supabase
        .from('release_announcements')
        .select('*')
        .eq('is_active', true)
        .lte('published_at', now)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .order('published_at', { ascending: false }),
      supabase
        .from('release_announcement_acknowledgements')
        .select('announcement_id')
        .eq('user_id', user.id),
    ]);

    if (!announcementResult.error && !acknowledgementResult.error) {
      setAnnouncements((announcementResult.data ?? []) as ReleaseAnnouncement[]);
      setAcknowledgedIds(new Set((acknowledgementResult.data ?? []).map(row => row.announcement_id)));
    } else {
      // Release communication must never block ordinary work when loading fails.
      setAnnouncements([]);
    }
    setLoading(false);
  }, [user, typedRoles]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  useEffect(() => {
    setPostponedIds(new Set());
    setAcknowledgeError(null);
  }, [user?.id]);

  const pending = useMemo(
    () => unseenAnnouncementsFor(announcements, acknowledgedIds, postponedIds, typedRoles, new Date()),
    [announcements, acknowledgedIds, postponedIds, typedRoles],
  );
  const current = pending[0] ?? null;

  const acknowledge = useCallback(async () => {
    if (!user || !current) return false;
    setAcknowledging(true);
    setAcknowledgeError(null);
    const { error } = await supabase
      .from('release_announcement_acknowledgements')
      .insert({ announcement_id: current.id, user_id: user.id });
    setAcknowledging(false);

    // A duplicate means another device or tab already stored the acknowledgement.
    if (error && error.code !== '23505') {
      setAcknowledgeError('Kvitteringen kunde inte sparas. Kontrollera uppkopplingen och försök igen.');
      return false;
    }
    setAcknowledgedIds(previous => new Set(previous).add(current.id));
    return true;
  }, [current, user]);

  const postpone = useCallback(() => {
    if (!current) return;
    setPostponedIds(previous => new Set(previous).add(current.id));
    setAcknowledgeError(null);
  }, [current]);

  return {
    current,
    remaining: pending.length,
    loading,
    acknowledging,
    acknowledgeError,
    acknowledge,
    postpone,
    reload: load,
  };
}
