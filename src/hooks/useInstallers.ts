import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Installer } from '@/data/mockData';

interface InstallerRow {
  id: string;
  name: string;
  color: number;
  type: string;
  base_location: string | null;
  profile_id: string | null;
}

const toInstaller = (r: InstallerRow): Installer & { profileId: string | null } => ({
  id: r.id,
  name: r.name,
  color: r.color,
  type: r.type === 'sub-vendor' ? 'sub-vendor' : 'own',
  baseLocation: r.base_location ?? '',
  absences: [],
  profileId: r.profile_id,
});

/** All installer records the signed-in user is allowed to see. */
export function useInstallers() {
  const [installers, setInstallers] = useState<(Installer & { profileId: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('installers')
      .select('id,name,color,type,base_location,profile_id')
      .order('name');
    if (error) setError(error.message);
    else {
      setError(null);
      setInstallers((data ?? []).map((r) => toInstaller(r as InstallerRow)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { installers, loading, error, reload };
}

/** The installer record belonging to the signed-in user, if any. */
export function useCurrentInstaller() {
  const { user, loading: authLoading } = useAuth();
  const [installer, setInstaller] = useState<(Installer & { profileId: string | null }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user) {
      setInstaller(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('installers')
      .select('id,name,color,type,base_location,profile_id')
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setInstaller(data ? toInstaller(data as InstallerRow) : null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { installer, loading: loading || authLoading };
}
