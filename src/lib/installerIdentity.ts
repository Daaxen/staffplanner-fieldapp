import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Canonical business identity for operational records.
 *
 * Every operational table (time_entries, expense_entries, mileage_entries,
 * active_timers, deviations, field_reports, reminders) stores
 * `installer_id` -> public.installers.id. The auth user id is only used for
 * authentication, storage paths and push subscriptions (user_id).
 */

let cached: { userId: string; installerId: string | null } | null = null;

/** The installers.id of the signed-in user, or null when they have no installer record. */
export async function getMyInstallerId(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;
  if (cached && cached.userId === userId) return cached.installerId;

  const { data, error } = await supabase
    .from('installers')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[installerIdentity] lookup failed', error);
    return null;
  }
  cached = { userId, installerId: data?.id ?? null };
  return cached.installerId;
}

export function clearInstallerIdentityCache() {
  cached = null;
}

/** React hook variant of {@link getMyInstallerId}. */
export function useMyInstallerId() {
  const [installerId, setInstallerId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    getMyInstallerId().then(id => {
      if (!active) return;
      setInstallerId(id);
      setChecked(true);
    });
    return () => { active = false; };
  }, []);

  return { installerId, checked };
}
