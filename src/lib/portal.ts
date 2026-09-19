import { supabase } from '@/integrations/supabase/client';

export interface PortalProject {
  id: string;
  ref: string | null;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  street: string | null;
  postalCode: string | null;
  region: string | null;
  description: string | null;
  installers: string[];
}

export interface PortalReport {
  id: string;
  projectId: string;
  reportText: string | null;
  submittedAt: string | null;
  signature: string | null;
  signOffs: unknown;
  checkedItems: unknown;
  photoPaths: string[];
}

export interface PortalDeviation {
  id: string;
  projectId: string;
  category: string;
  severity: string;
  description: string;
  status: string;
  occurredAt: string;
  resolvedAt: string | null;
  photoPaths: string[];
}

export interface PortalData {
  clientId: string | null;
  clientName: string | null;
  projects: PortalProject[];
  reports: PortalReport[];
  deviations: PortalDeviation[];
}

const asPaths = (v: unknown): string[] =>
  Array.isArray(v) ? (v.filter(p => typeof p === 'string') as string[]) : [];

/** Records a customer portal action in the immutable portal activity log. */
export async function logPortalAccess(
  entityType: string,
  action: string,
  entityId?: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabase.rpc('log_portal_access', {
      _entity_type: entityType,
      _action: action,
      _entity_id: entityId ?? null,
      _metadata: metadata as never,
    });
  } catch {
    /* logging must never block the view */
  }
}

/** The signed-in user's portal customer, or null when they are not a portal user. */
export async function getPortalClientId(): Promise<string | null> {
  const { data } = await supabase.from('customer_portal_users').select('client_id').maybeSingle();
  return data?.client_id ?? null;
}

/** Everything a customer may see. RLS keeps this to their own orders. */
export async function loadPortalData(): Promise<PortalData> {
  const clientId = await getPortalClientId();
  if (!clientId) return { clientId: null, clientName: null, projects: [], reports: [], deviations: [] };

  const [{ data: client }, { data: projectRows }] = await Promise.all([
    supabase.from('clients').select('name').eq('id', clientId).maybeSingle(),
    supabase
      .from('projects')
      .select(
        'id,ref,name,status,start_date,end_date,start_time,end_time,location,street,postal_code,region,description,project_assignees(installer_id,installers(name))',
      )
      .eq('client_id', clientId)
      .order('start_date', { ascending: false }),
  ]);

  const projects: PortalProject[] = (projectRows ?? []).map(p => {
    const assignees = (p as { project_assignees?: { installers?: { name?: string } | null }[] })
      .project_assignees ?? [];
    return {
      id: p.id,
      ref: p.ref,
      name: p.name,
      status: p.status,
      startDate: p.start_date,
      endDate: p.end_date,
      startTime: p.start_time,
      endTime: p.end_time,
      location: p.location,
      street: p.street,
      postalCode: p.postal_code,
      region: p.region,
      description: p.description,
      installers: assignees.map(a => a.installers?.name).filter((n): n is string => !!n),
    };
  });

  const ids = projects.map(p => p.id);
  if (ids.length === 0) {
    return { clientId, clientName: client?.name ?? null, projects, reports: [], deviations: [] };
  }

  const [{ data: reportRows }, { data: devRows }] = await Promise.all([
    supabase
      .from('field_reports')
      .select('id,project_id,report_text,submitted_at,signature,sign_offs,checked_items,photo_paths')
      .in('project_id', ids),
    supabase
      .from('deviations')
      .select('id,project_id,category,severity,description,status,occurred_at,resolved_at,photo_paths')
      .in('project_id', ids)
      .order('occurred_at', { ascending: false }),
  ]);

  return {
    clientId,
    clientName: client?.name ?? null,
    projects,
    reports: (reportRows ?? []).map(r => ({
      id: r.id,
      projectId: r.project_id,
      reportText: r.report_text,
      submittedAt: r.submitted_at,
      signature: r.signature,
      signOffs: r.sign_offs,
      checkedItems: r.checked_items,
      photoPaths: asPaths(r.photo_paths),
    })),
    deviations: (devRows ?? []).map(d => ({
      id: d.id,
      projectId: d.project_id,
      category: d.category,
      severity: d.severity,
      description: d.description,
      status: d.status,
      occurredAt: d.occurred_at,
      resolvedAt: d.resolved_at,
      photoPaths: asPaths(d.photo_paths),
    })),
  };
}

/** Temporary view links for the photos attached to a customer's own orders. */
export async function signPortalPhotos(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from('field-photos').createSignedUrls(paths, 60 * 10);
  const out: Record<string, string> = {};
  (data ?? []).forEach(d => {
    if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  });
  return out;
}
