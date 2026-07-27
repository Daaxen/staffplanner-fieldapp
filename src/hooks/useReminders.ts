import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ReminderLevel = 'gentle' | 'urgent' | 'escalated';
export type ReminderStatus = 'open' | 'resolved' | 'dismissed';

export interface Reminder {
  id: string;
  project_id: string;
  installer_id: string;
  triggered_at: string;
  level: ReminderLevel;
  status: ReminderStatus;
  resolved_at: string | null;
  last_notified_at: string | null;
  missing: { completion?: boolean; time?: boolean; expense?: boolean };
}

export interface ReminderWithProject extends Reminder {
  project_name?: string | null;
}

export function useReminders(opts: { adminScope?: boolean } = {}) {
  const [reminders, setReminders] = useState<ReminderWithProject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reminders')
      .select('*, projects(name)')
      .eq('status', 'open')
      .order('triggered_at', { ascending: true });
    if (error) console.error('[reminders] load', error);
    setReminders(
      (data ?? []).map((r) => {
        const proj = (r as { projects?: { name: string } | null }).projects;
        return { ...(r as Reminder), project_name: proj?.name ?? null };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('reminders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const resolve = useCallback(async (id: string) => {
    await supabase.from('reminders').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id);
  }, []);
  const dismiss = useCallback(async (id: string) => {
    await supabase.from('reminders').update({ status: 'dismissed' }).eq('id', id);
  }, []);

  const escalated = reminders.filter(r => r.level === 'escalated');
  const highestLevel: ReminderLevel | null =
    reminders.some(r => r.level === 'escalated') ? 'escalated'
    : reminders.some(r => r.level === 'urgent') ? 'urgent'
    : reminders.length ? 'gentle' : null;

  return { reminders, escalated, highestLevel, loading, resolve, dismiss, refresh: load, adminScope: !!opts.adminScope };
}

export type RemindersState = ReturnType<typeof useReminders>;
