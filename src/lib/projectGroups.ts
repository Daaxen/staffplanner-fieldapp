import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * A project groups several work orders. Work orders can also stand alone,
 * which is why the link on a work order is optional and removing a project
 * never removes its work orders.
 */
export interface ProjectGroup {
  id: string;
  name: string;
  projectNumber?: string | null;
  clientId?: string | null; // clients.id (database uuid)
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
}

export type ProjectGroupInput = Omit<ProjectGroup, 'id' | 'status'> & { status?: string };

type Row = {
  id: string;
  name: string;
  project_number: string | null;
  client_id: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
};

const fromRow = (r: Row): ProjectGroup => ({
  id: r.id,
  name: r.name,
  projectNumber: r.project_number,
  clientId: r.client_id,
  description: r.description,
  startDate: r.start_date,
  endDate: r.end_date,
  status: r.status,
});

const toRow = (g: ProjectGroupInput) => ({
  name: g.name,
  project_number: g.projectNumber || null,
  client_id: g.clientId || null,
  description: g.description || null,
  start_date: g.startDate || null,
  end_date: g.endDate || null,
  status: g.status || 'active',
});

export async function fetchProjectGroups(): Promise<ProjectGroup[]> {
  const { data, error } = await supabase
    .from('project_groups')
    .select('id,name,project_number,client_id,description,start_date,end_date,status')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(fromRow);
}

export async function createProjectGroup(input: ProjectGroupInput): Promise<ProjectGroup> {
  const { data, error } = await supabase
    .from('project_groups')
    .insert(toRow(input) as never)
    .select('id,name,project_number,client_id,description,start_date,end_date,status')
    .single();
  if (error) throw error;
  return fromRow(data as Row);
}

export async function updateProjectGroup(id: string, input: ProjectGroupInput): Promise<void> {
  const { error } = await supabase
    .from('project_groups')
    .update(toRow(input) as never)
    .eq('id', id);
  if (error) throw error;
}

/** Work orders keep existing; the link is simply cleared. */
export async function deleteProjectGroup(id: string): Promise<void> {
  const { error } = await supabase.from('project_groups').delete().eq('id', id);
  if (error) throw error;
}

export function useProjectGroups() {
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await fetchProjectGroups());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { groups, loading, reload };
}
