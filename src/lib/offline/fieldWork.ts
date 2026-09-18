import { supabase } from '@/integrations/supabase/client';
import { idbAll, idbDel, idbGet, idbSet } from './idb';
import type { Project } from '@/data/mockData';
import { DEFAULT_PHOTO_CATEGORY, type PhotoCategory, type PhotoPosition } from '@/lib/photoMeta';

export interface OfflinePhoto {
  id: string;
  capturedAt: string;
  category: PhotoCategory;
  comment?: string;
  position?: PhotoPosition | null;
  path?: string; // storage path once uploaded
}

export interface FieldWork {
  projectRef: string;
  projectName?: string;
  checkedItems: string[];
  signature: string;
  reportText: string;
  reportSubmitted: boolean;
  signOffs: Record<string, string>;
  photos: OfflinePhoto[];
  pendingStatus?: Project['status'];
  updatedAt: string;
  dirty: boolean;
}

export const emptyWork = (projectRef: string, projectName?: string): FieldWork => ({
  projectRef,
  projectName,
  checkedItems: [],
  signature: '',
  reportText: '',
  reportSubmitted: false,
  signOffs: {},
  photos: [],
  updatedAt: new Date().toISOString(),
  dirty: false,
});

const listeners = new Set<() => void>();
export const subscribeFieldWork = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const notify = () => listeners.forEach(fn => fn());

export async function loadWork(projectRef: string, projectName?: string): Promise<FieldWork> {
  const stored = await idbGet<FieldWork>('work', projectRef);
  if (!stored) return emptyWork(projectRef, projectName);
  return {
    ...stored,
    signOffs: stored.signOffs ?? {},
    photos: (stored.photos ?? []).map(p => ({ ...p, category: p.category ?? DEFAULT_PHOTO_CATEGORY })),
  };
}

export async function saveWork(work: FieldWork): Promise<FieldWork> {
  const next: FieldWork = { ...work, updatedAt: new Date().toISOString(), dirty: true };
  await idbSet('work', next.projectRef, next);
  notify();
  return next;
}

export async function addPhoto(
  work: FieldWork,
  blob: Blob,
  meta?: { category?: PhotoCategory; comment?: string; position?: PhotoPosition | null },
): Promise<FieldWork> {
  const id = `${work.projectRef}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await idbSet('photos', id, blob);
  const photo: OfflinePhoto = {
    id,
    capturedAt: new Date().toISOString(),
    category: meta?.category ?? DEFAULT_PHOTO_CATEGORY,
    comment: meta?.comment,
    position: meta?.position ?? null,
  };
  return saveWork({ ...work, photos: [...work.photos, photo] });
}

export async function updatePhoto(
  work: FieldWork,
  photoId: string,
  patch: Partial<Pick<OfflinePhoto, 'category' | 'comment'>>,
): Promise<FieldWork> {
  return saveWork({
    ...work,
    photos: work.photos.map(p => (p.id === photoId ? { ...p, ...patch } : p)),
  });
}

export async function removePhoto(work: FieldWork, photoId: string): Promise<FieldWork> {
  await idbDel('photos', photoId);
  return saveWork({ ...work, photos: work.photos.filter(p => p.id !== photoId) });
}

export async function photoUrl(id: string): Promise<string | null> {
  const blob = await idbGet<Blob>('photos', id);
  return blob ? URL.createObjectURL(blob) : null;
}

export async function pendingWork(): Promise<FieldWork[]> {
  const all = await idbAll<FieldWork>('work');
  return all.filter(w => w.dirty);
}

export async function pendingCount(): Promise<number> {
  return (await pendingWork()).length;
}

// Status changes made offline are replayed through the app so they persist like normal.
type StatusHandler = (projectRef: string, status: Project['status']) => void;
let statusHandler: StatusHandler | null = null;
export const setStatusHandler = (fn: StatusHandler | null) => {
  statusHandler = fn;
};

async function uploadPhotos(userId: string, work: FieldWork): Promise<OfflinePhoto[]> {
  const out: OfflinePhoto[] = [];
  for (const photo of work.photos) {
    if (photo.path) {
      out.push(photo);
      continue;
    }
    const blob = await idbGet<Blob>('photos', photo.id);
    if (!blob) {
      out.push(photo);
      continue;
    }
    const path = `${userId}/${work.projectRef}/${photo.id}.jpg`;
    const { error } = await supabase.storage
      .from('field-photos')
      .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
    if (error) throw error;
    await idbDel('photos', photo.id);
    out.push({ ...photo, path });
  }
  return out;
}

export interface SyncResult {
  synced: number;
  failed: number;
}

let syncing = false;

export async function syncFieldWork(): Promise<SyncResult> {
  if (syncing || !navigator.onLine) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return { synced: 0, failed: 0 };

    for (const work of await pendingWork()) {
      try {
        const photos = await uploadPhotos(userId, work);
        const { error } = await supabase.from('field_reports').upsert(
          {
            project_ref: work.projectRef,
            installer_id: userId,
            checked_items: work.checkedItems,
            signature: work.signature || null,
            sign_offs: work.signOffs ?? {},
            report_text: work.reportText || null,
            photo_paths: photos.map(p => p.path).filter(Boolean),
          photo_meta: photos.map(p => ({
            path: p.path ?? null,
            category: p.category,
            comment: p.comment ?? null,
            captured_at: p.capturedAt,
            lat: p.position?.lat ?? null,
            lng: p.position?.lng ?? null,
            accuracy: p.position?.accuracy ?? null,
          })),
            submitted_at: work.reportSubmitted ? work.updatedAt : null,
          },
          { onConflict: 'project_ref,installer_id' },
        );
        if (error) throw error;

        if (work.pendingStatus && statusHandler) statusHandler(work.projectRef, work.pendingStatus);

        await idbSet('work', work.projectRef, { ...work, photos, pendingStatus: undefined, dirty: false });
        synced += 1;
      } catch {
        failed += 1;
      }
    }
  } finally {
    syncing = false;
    notify();
  }
  return { synced, failed };
}

const PROJECT_CACHE_KEY = 'projects';

export async function cacheProjects(projects: Project[]) {
  await idbSet('kv', PROJECT_CACHE_KEY, projects);
}

export async function cachedProjects(): Promise<Project[]> {
  return (await idbGet<Project[]>('kv', PROJECT_CACHE_KEY)) ?? [];
}
