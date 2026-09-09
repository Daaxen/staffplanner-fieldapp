import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  clientRegister,
  installers as installerList,
  projects as projectList,
  type Client,
  type Installer,
  type Project,
} from '@/data/mockData';

/**
 * Shared, database-backed application data.
 *
 * The mockData arrays are kept as live module-level caches so existing
 * components that import them keep working; this module hydrates them from
 * the database and writes every change back so nothing is lost on refresh.
 */

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
let loaded = false;
let loadingPromise: Promise<void> | null = null;

function notify() {
  version += 1;
  listeners.forEach((l) => l());
}

function replace<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next);
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

async function loadClients() {
  const { data, error } = await supabase.from('clients').select('ref,data,name').order('name');
  if (error) throw error;
  const rows = (data ?? []) as { ref: string | null; data: unknown; name: string }[];
  replace(
    clientRegister,
    rows.map((r) => {
      const d = (r.data ?? {}) as Partial<Client>;
      return { ...d, id: d.id ?? r.ref ?? '', name: d.name ?? r.name } as Client;
    }),
  );
}

async function loadInstallers() {
  const { data, error } = await supabase
    .from('installers')
    .select('id,name,color,type,base_location')
    .order('name');
  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    name: string;
    color: number;
    type: string;
    base_location: string | null;
  }[];
  replace(
    installerList,
    rows.map<Installer>((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      type: r.type === 'sub-vendor' ? 'sub-vendor' : 'own',
      baseLocation: r.base_location ?? '',
      absences: [],
    })),
  );
}

async function loadProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('ref,data,name,status,start_date,end_date')
    .order('start_date', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as { ref: string | null; data: unknown; name: string }[];
  replace(
    projectList,
    rows
      .map((r) => {
        const d = (r.data ?? {}) as Partial<Project>;
        return { ...d, id: d.id ?? r.ref ?? '', name: d.name ?? r.name } as Project;
      })
      .filter((p) => p.id),
  );
}

export async function loadAppData(): Promise<void> {
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    await Promise.all([loadClients(), loadInstallers(), loadProjects()]);
    loaded = true;
    notify();
  })().catch((e) => {
    console.error('Failed to load app data', e);
    loaded = true;
    notify();
  });
  return loadingPromise;
}

/* ------------------------------------------------------------------ */
/* Persistence helpers                                                 */
/* ------------------------------------------------------------------ */

async function upsertClientRow(c: Client) {
  const { error } = await supabase
    .from('clients')
    .upsert(
      {
        ref: c.id,
        name: c.name,
        data: c as unknown as Record<string, unknown>,
        hourly_rate: c.rates?.hourlyRate ?? null,
        overtime_rate: c.rates?.overtimeRate ?? null,
        mileage_rate: c.rates?.mileageRate ?? null,
        ...(c.rates?.vatPercent != null ? { vat_percent: c.rates.vatPercent } : {}),
      } as never,
      { onConflict: 'ref' },
    );
  if (error) throw error;
}

async function deleteClientRow(ref: string) {
  const { error } = await supabase.from('clients').delete().eq('ref' as never, ref as never);
  if (error) throw error;
}

async function upsertProjectRow(p: Project) {
  const { data, error } = await supabase
    .from('projects')
    .upsert(
      {
        ref: p.id,
        name: p.name,
        project_type: p.projectType,
        status: p.status,
        location: p.location || null,
        start_date: p.startDate || null,
        end_date: p.endDate || null,
        contact_name: p.contactName || null,
        contact_phone: p.contactPhone || null,
        contact_email: p.contactEmail || null,
        data: p as unknown as Record<string, unknown>,
      } as never,
      { onConflict: 'ref' },
    )
    .select('id')
    .maybeSingle();
  if (error) throw error;

  const rowId = (data as { id: string } | null)?.id;
  if (!rowId) return;

  // keep assignment rows in sync so installers can see their own projects
  await supabase.from('project_assignees').delete().eq('project_id', rowId);
  const valid = (p.assigneeIds ?? []).filter((id) =>
    installerList.some((i) => i.id === id),
  );
  if (valid.length > 0) {
    await supabase
      .from('project_assignees')
      .insert(valid.map((installer_id) => ({ project_id: rowId, installer_id })));
  }
}

async function deleteProjectRow(ref: string) {
  const { error } = await supabase.from('projects').delete().eq('ref' as never, ref as never);
  if (error) throw error;
}

function diffAndPersist<T extends { id: string }>(
  prev: T[],
  next: T[],
  upsert: (item: T) => Promise<void>,
  remove: (id: string) => Promise<void>,
) {
  const prevById = new Map(prev.map((i) => [i.id, i]));
  const nextIds = new Set(next.map((i) => i.id));
  const tasks: Promise<unknown>[] = [];

  for (const item of next) {
    const before = prevById.get(item.id);
    if (!before || JSON.stringify(before) !== JSON.stringify(item)) {
      tasks.push(upsert(item));
    }
  }
  for (const item of prev) {
    if (!nextIds.has(item.id)) tasks.push(remove(item.id));
  }

  Promise.all(tasks).catch((e) => console.error('Failed to save changes', e));
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

function useVersion() {
  const [, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    if (!loaded) void loadAppData();
    else setV(version);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return loaded;
}

type Updater<T> = T[] | ((prev: T[]) => T[]);

export function useAppDataLoaded(): boolean {
  return useVersion();
}

export function useProjects(): [Project[], (next: Updater<Project>) => void] {
  useVersion();
  const setProjects = useCallback((next: Updater<Project>) => {
    const prev = [...projectList];
    const value = typeof next === 'function' ? next(prev) : next;
    replace(projectList, value);
    notify();
    diffAndPersist(prev, value, upsertProjectRow, deleteProjectRow);
  }, []);
  return [projectList, setProjects];
}

export function useClients(): [Client[], (next: Updater<Client>) => void] {
  useVersion();
  const setClients = useCallback((next: Updater<Client>) => {
    const prev = [...clientRegister];
    const value = typeof next === 'function' ? next(prev) : next;
    replace(clientRegister, value);
    notify();
    diffAndPersist(prev, value, upsertClientRow, deleteClientRow);
  }, []);
  return [clientRegister, setClients];
}

export function useInstallersList(): Installer[] {
  useVersion();
  return installerList;
}

/** Client names for autocomplete / dropdowns. */
export function useClientNames(): string[] {
  const [clients] = useClients();
  return clients
    .map((c) => c.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}
