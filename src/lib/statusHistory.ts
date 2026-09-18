import { supabase } from '@/integrations/supabase/client';
import type { ProjectStatus } from '@/lib/projectLifecycle';

export interface StatusEvent {
  id: string;
  project_ref: string;
  project_name: string | null;
  from_status: ProjectStatus | null;
  to_status: ProjectStatus;
  note: string | null;
  changed_by: string;
  changed_by_name: string | null;
  created_at: string;
}

/** Append one audit-trail entry. Never throws — logging must not block the UI. */
export const logStatusChange = async (params: {
  projectRef: string;
  projectName?: string;
  from: ProjectStatus | null;
  to: ProjectStatus;
  note?: string;
}): Promise<void> => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;
    let name = (user.user_metadata?.full_name as string | undefined) ?? null;
    if (!name) {
      const { data: profile } = await supabase.from('profiles').select('full_name,email').eq('id', user.id).maybeSingle();
      name = profile?.full_name ?? profile?.email ?? user.email ?? null;
    }
    await supabase.from('project_status_events').insert({
      project_ref: params.projectRef,
      project_name: params.projectName ?? null,
      from_status: params.from,
      to_status: params.to,
      note: params.note ?? null,
      changed_by: user.id,
      changed_by_name: name,
    });
  } catch (e) {
    console.error('Failed to log status change', e);
  }
};

export const fetchStatusHistory = async (projectRef: string): Promise<StatusEvent[]> => {
  const { data, error } = await supabase
    .from('project_status_events')
    .select('*')
    .eq('project_ref', projectRef)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Failed to load status history', error);
    return [];
  }
  return (data ?? []) as unknown as StatusEvent[];
};
