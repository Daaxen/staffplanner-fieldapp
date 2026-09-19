import { supabase } from '@/integrations/supabase/client';
import { getMyInstallerId } from '@/lib/installerIdentity';
import { idbAll, idbDel, idbGet, idbSet } from './offline/idb';

export const DEVIATION_CATEGORIES = [
  { id: 'damaged-goods', label: 'Damaged goods' },
  { id: 'missing-goods', label: 'Missing goods' },
  { id: 'customer-absent', label: 'Customer absent' },
  { id: 'site-not-ready', label: 'Site not ready' },
  { id: 'access-issue', label: 'Access issue' },
  { id: 'permit-issue', label: 'Permit issue' },
  { id: 'vehicle-issue', label: 'Vehicle issue' },
  { id: 'incorrect-order', label: 'Incorrect order' },
] as const;

export type DeviationCategory = (typeof DEVIATION_CATEGORIES)[number]['id'];

export const DEVIATION_SEVERITIES = [
  { id: 'low', label: 'Low', hint: 'Noted, work continues' },
  { id: 'medium', label: 'Medium', hint: 'Slows the job down' },
  { id: 'high', label: 'High', hint: 'Job cannot be finished today' },
  { id: 'critical', label: 'Critical', hint: 'Safety or major damage' },
] as const;

export type DeviationSeverity = (typeof DEVIATION_SEVERITIES)[number]['id'];

export const categoryLabel = (id: string) =>
  DEVIATION_CATEGORIES.find(c => c.id === id)?.label ?? id;
export const severityLabel = (id: string) =>
  DEVIATION_SEVERITIES.find(s => s.id === id)?.label ?? id;

export const MIN_DEVIATION_DESCRIPTION = 10;

export interface Deviation {
  id: string;
  project_ref: string;
  project_name: string | null;
  installer_id: string;
  installer_name: string | null;
  category: string;
  severity: string;
  description: string;
  photo_paths: string[];
  occurred_at: string;
  status: 'open' | 'acknowledged' | 'resolved';
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

/** A deviation captured on the phone, possibly while offline. */
export interface QueuedDeviation {
  id: string;
  projectRef: string;
  projectName?: string;
  installerName?: string;
  category: DeviationCategory;
  severity: DeviationSeverity;
  description: string;
  photoIds: string[];
  occurredAt: string;
}

const listeners = new Set<() => void>();
export const subscribeDeviations = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const notify = () => listeners.forEach(fn => fn());

export async function addDeviationPhoto(blob: Blob, prefix: string): Promise<string> {
  const id = `dev-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await idbSet('photos', id, blob);
  return id;
}

export async function deviationPhotoUrl(id: string): Promise<string | null> {
  const blob = await idbGet<Blob>('photos', id);
  return blob ? URL.createObjectURL(blob) : null;
}

/** Saves the deviation on the device, then tries to push it straight away. */
export async function queueDeviation(draft: QueuedDeviation): Promise<void> {
  await idbSet('deviations', draft.id, draft);
  notify();
  if (navigator.onLine) await syncDeviations();
}

export async function pendingDeviations(): Promise<QueuedDeviation[]> {
  return idbAll<QueuedDeviation>('deviations');
}

export async function pendingDeviationCount(): Promise<number> {
  return (await pendingDeviations()).length;
}

let syncing = false;

export async function syncDeviations(): Promise<{ synced: number; failed: number }> {
  if (syncing || !navigator.onLine) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return { synced: 0, failed: 0 };
    // Photos are stored under the login account; the record itself keys on the
    // installer record (public.installers.id).
    const installerId = await getMyInstallerId();
    if (!installerId) return { synced: 0, failed: 0 };

    for (const draft of await pendingDeviations()) {
      try {
        const paths: string[] = [];
        for (const photoId of draft.photoIds) {
          const blob = await idbGet<Blob>('photos', photoId);
          if (!blob) continue;
          const path = `${userId}/deviations/${draft.id}/${photoId}.jpg`;
          const { error } = await supabase.storage
            .from('field-photos')
            .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
          if (error) throw error;
          await idbDel('photos', photoId);
          paths.push(path);
        }

        const { data, error } = await supabase
          .from('deviations')
          .insert({
            project_ref: draft.projectRef,
            project_name: draft.projectName ?? null,
            installer_id: installerId,
            installer_name: draft.installerName ?? null,
            category: draft.category,
            severity: draft.severity,
            description: draft.description,
            photo_paths: paths,
            occurred_at: draft.occurredAt,
          })
          .select('id')
          .single();
        if (error) throw error;

        // Automatic notification to the back office.
        try {
          await supabase.functions.invoke('deviation-notify', { body: { deviation_id: data.id } });
        } catch (e) {
          console.warn('deviation notification failed', e);
        }

        await idbDel('deviations', draft.id);
        synced += 1;
      } catch (e) {
        console.warn('deviation sync failed', e);
        failed += 1;
      }
    }
  } finally {
    syncing = false;
    notify();
  }
  return { synced, failed };
}

export async function fetchDeviations(opts: { projectRef?: string } = {}): Promise<Deviation[]> {
  let q = supabase
    .from('deviations')
    .select('*')
    .order('occurred_at', { ascending: false });
  if (opts.projectRef) q = q.eq('project_ref', opts.projectRef);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(d => ({
    ...d,
    photo_paths: Array.isArray(d.photo_paths) ? (d.photo_paths as string[]) : [],
  })) as Deviation[];
}

export async function updateDeviationStatus(
  id: string,
  status: Deviation['status'],
  resolutionNote?: string,
): Promise<void> {
  const { error } = await supabase
    .from('deviations')
    .update({
      status,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      resolution_note: resolutionNote ?? null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function signedPhotoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('field-photos').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
