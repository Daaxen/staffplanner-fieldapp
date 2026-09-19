import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import {
  clientRegister,
  installers as installerList,
  projects as projectList,
  type Client,
  type Installer,
  type Project,
} from '@/data/mockData';
import { parseClientMetadata, parseProjectMetadata } from '@/lib/validation/appJson';


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
  // Admins can read the clients table directly. Installers are blocked by RLS
  // and instead get a restricted set (no rates, VAT, invoicing or internal
  // references) for the clients behind orders assigned to them.
  //
  // Business-critical fields live in typed columns; the `data` JSON is kept as
  // a compatibility snapshot and read as a fallback for older rows.
  const { data, error } = await supabase
    .from('clients')
    .select(
      'ref,name,data,customer_number,street,postal_code,region,' +
        'contact_name,contact_role,contact_phone,contact_email,' +
        'hourly_rate,overtime_rate,mileage_rate,vat_percent,' +
        'billing_name,billing_street,billing_postal_code,billing_city,billing_country,' +
        'vat_number,org_number,invoice_email,payment_terms_days,invoice_reference',
    )
    .order('name');
  if (error) throw error;
  let rows = (data ?? []) as unknown as Record<string, unknown>[];
  if (rows.length === 0) {
    const { data: safe } = await supabase.rpc('assigned_clients');
    rows = (safe ?? []) as Record<string, unknown>[];
  }
  replace(
    clientRegister,
    rows.map((r) => {
      const d = parseClientMetadata(r.data) as Partial<Client>;
      const col = <T,>(key: string, fallback: T | undefined): T | undefined =>
        (r[key] ?? undefined) !== undefined ? (r[key] as T) : fallback;

      const mainContact = {
        name: col('contact_name', d.mainContact?.name),
        role: col('contact_role', d.mainContact?.role),
        phone: col('contact_phone', d.mainContact?.phone),
        email: col('contact_email', d.mainContact?.email),
      };
      const invoicing = {
        billingName: col('billing_name', d.invoicing?.billingName),
        billingStreet: col('billing_street', d.invoicing?.billingStreet),
        billingPostalCode: col('billing_postal_code', d.invoicing?.billingPostalCode),
        billingCity: col('billing_city', d.invoicing?.billingCity),
        billingCountry: col('billing_country', d.invoicing?.billingCountry),
        vatNumber: col('vat_number', d.invoicing?.vatNumber),
        orgNumber: col('org_number', d.invoicing?.orgNumber),
        invoiceEmail: col('invoice_email', d.invoicing?.invoiceEmail),
        paymentTermsDays: col('payment_terms_days', d.invoicing?.paymentTermsDays),
        reference: col('invoice_reference', d.invoicing?.reference),
      };
      const rates = {
        hourlyRate: col('hourly_rate', d.rates?.hourlyRate),
        overtimeRate: col('overtime_rate', d.rates?.overtimeRate),
        mileageRate: col('mileage_rate', d.rates?.mileageRate),
        vatPercent: col('vat_percent', d.rates?.vatPercent),
      };

      return {
        ...d,
        id: d.id ?? (r.ref as string) ?? '',
        name: (r.name as string) ?? d.name,
        customerNumber: col('customer_number', d.customerNumber),
        street: col('street', d.street),
        postalCode: col('postal_code', d.postalCode),
        region: col('region', d.region),
        mainContact,
        invoicing,
        rates,
      } as Client;
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

/* ------------------------------------------------------------------ */
/* Order key mapping                                                   */
/* ------------------------------------------------------------------ */

/**
 * The app identifies an order by its human reference (Project.id === ref),
 * while reporting tables (time/expense/mileage/timers) store the real
 * projects.id uuid. These maps translate between the two.
 */
const rowIdByRef = new Map<string, string>();
const refByRowId = new Map<string, string>();

function rememberProjectKey(ref: string | null, rowId: string | null) {
  if (!ref || !rowId) return;
  rowIdByRef.set(ref, rowId);
  refByRowId.set(rowId, ref);
}

/** projects.id (uuid) for an app-level order reference, if already known. */
export function projectRowId(ref: string): string | undefined {
  return rowIdByRef.get(ref);
}

/** App-level order reference for a projects.id uuid. */
export function projectRefForRowId(rowId: string): string | undefined {
  return refByRowId.get(rowId);
}

/** projects.id for an order reference, querying the database when unknown. */
export async function ensureProjectRowId(ref: string): Promise<string | null> {
  const known = rowIdByRef.get(ref);
  if (known) return known;
  const { data } = await supabase.from('projects').select('id').eq('ref', ref).maybeSingle();
  const id = (data as { id: string } | null)?.id ?? null;
  rememberProjectKey(ref, id);
  return id;
}

async function loadProjects() {
  // Typed columns are authoritative; `data` is a compatibility snapshot used
  // as a fallback for rows written before the fields were normalised.
  const { data, error } = await supabase
    .from('projects')
    .select(
      'id,ref,data,name,status,commercial_status,start_date,end_date,project_type,location,' +
        'contact_name,contact_phone,contact_email,project_number,template_id,' +
        'client_ref,client_name,street,postal_code,region,location_lat,location_lng,' +
        'start_time,end_time,estimated_hours,is_flex_order,description,' +
        'hourly_rate,mileage_rate,vehicle_type,' +
        'project_economy(fixed_price,additional_revenue,budget_hours,internal_hourly_cost,' +
        'external_hourly_cost,external_cost_extra,material_cost_extra,travel_cost_extra,' +
        'external_budget,target_margin_pct)',
    )
    .order('start_date', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  rowIdByRef.clear();
  refByRowId.clear();
  replace(
    projectList,
    rows
      .map((r) => {
        const d = parseProjectMetadata(r.data) as Partial<Project>;
        const col = <T,>(key: string, fallback: T | undefined): T | undefined =>
          (r[key] ?? undefined) !== undefined ? (r[key] as T) : fallback;
        const trim = (v: unknown) =>
          typeof v === 'string' ? v.slice(0, 5) : undefined; // "08:00:00" -> "08:00"

        const econRow = (Array.isArray(r.project_economy)
          ? r.project_economy[0]
          : r.project_economy) as Record<string, number | null> | null | undefined;
        const economy = econRow
          ? {
              fixedPrice: econRow.fixed_price ?? undefined,
              additionalRevenue: econRow.additional_revenue ?? undefined,
              budgetHours: econRow.budget_hours ?? undefined,
              internalHourlyCost: econRow.internal_hourly_cost ?? undefined,
              externalHourlyCost: econRow.external_hourly_cost ?? undefined,
              externalCostExtra: econRow.external_cost_extra ?? undefined,
              materialCostExtra: econRow.material_cost_extra ?? undefined,
              travelCostExtra: econRow.travel_cost_extra ?? undefined,
              externalBudget: econRow.external_budget ?? undefined,
              targetMarginPct: econRow.target_margin_pct ?? undefined,
            }
          : d.economy;

        const project = {
          ...d,
          id: d.id ?? (r.ref as string) ?? '',
          name: (r.name as string) ?? d.name,
          projectType: col('project_type', d.projectType),
          status: col('status', d.status),
          commercialStatus: col('commercial_status', d.commercialStatus) ?? 'quote',
          location: col('location', d.location) ?? '',
          startDate: col('start_date', d.startDate) ?? '',
          endDate: col('end_date', d.endDate) ?? '',
          contactName: col('contact_name', d.contactName),
          contactPhone: col('contact_phone', d.contactPhone),
          contactEmail: col('contact_email', d.contactEmail),
          projectNumber: col('project_number', d.projectNumber),
          templateId: col('template_id', d.templateId),
          clientId: col('client_ref', d.clientId),
          client: col('client_name', d.client) ?? '',
          street: col('street', d.street),
          postalCode: col('postal_code', d.postalCode),
          region: col('region', d.region),
          locationLat: col('location_lat', d.locationLat),
          locationLng: col('location_lng', d.locationLng),
          startTime: trim(r.start_time) ?? d.startTime,
          endTime: trim(r.end_time) ?? d.endTime,
          estimatedHours: col('estimated_hours', d.estimatedHours),
          isFlexOrder: col('is_flex_order', d.isFlexOrder),
          description: col('description', d.description),
          hourlyRate: col('hourly_rate', d.hourlyRate),
          mileageRate: col('mileage_rate', d.mileageRate),
          vehicleType: col('vehicle_type', d.vehicleType),
          economy,
        } as Project;
        rememberProjectKey(project.id, r.id as string);
        return project;
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
        // full snapshot kept for compatibility — no key is ever removed
        data: c as unknown as Record<string, unknown>,
        customer_number: c.customerNumber || null,
        street: c.street || null,
        postal_code: c.postalCode || null,
        region: c.region || null,
        contact_name: c.mainContact?.name || null,
        contact_role: c.mainContact?.role || null,
        contact_phone: c.mainContact?.phone || null,
        contact_email: c.mainContact?.email || null,
        billing_name: c.invoicing?.billingName || null,
        billing_street: c.invoicing?.billingStreet || null,
        billing_postal_code: c.invoicing?.billingPostalCode || null,
        billing_city: c.invoicing?.billingCity || null,
        billing_country: c.invoicing?.billingCountry || null,
        vat_number: c.invoicing?.vatNumber || null,
        org_number: c.invoicing?.orgNumber || null,
        invoice_email: c.invoicing?.invoiceEmail || null,
        payment_terms_days: c.invoicing?.paymentTermsDays ?? null,
        invoice_reference: c.invoicing?.reference || null,
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
  const time = (v?: string) => (v && /^\d{2}:\d{2}/.test(v) ? v : null);
  const { data, error } = await supabase
    .from('projects')
    .upsert(
      {
        ref: p.id,
        name: p.name,
        project_type: p.projectType,
        status: p.status,
        commercial_status: p.commercialStatus || 'quote',
        location: p.location || null,
        start_date: p.startDate || null,
        end_date: p.endDate || null,
        contact_name: p.contactName || null,
        contact_phone: p.contactPhone || null,
        contact_email: p.contactEmail || null,
        project_number: p.projectNumber || null,
        template_id: p.templateId || null,
        client_ref: p.clientId || null,
        client_name: p.client || null,
        street: p.street || null,
        postal_code: p.postalCode || null,
        region: p.region || null,
        location_lat: p.locationLat ?? null,
        location_lng: p.locationLng ?? null,
        start_time: time(p.startTime),
        end_time: time(p.endTime),
        estimated_hours: p.estimatedHours ?? null,
        is_flex_order: p.isFlexOrder ?? false,
        description: p.description || null,
        hourly_rate: p.hourlyRate ?? null,
        mileage_rate: p.mileageRate ?? null,
        vehicle_type: p.vehicleType || null,
        // full snapshot kept for compatibility — no key is ever removed
        data: p as unknown as Record<string, unknown>,
      } as never,
      { onConflict: 'ref' },
    )
    .select('id')
    .maybeSingle();
  if (error) throw error;

  const rowId = (data as { id: string } | null)?.id;
  if (!rowId) return;

  // economy figures live in their own typed table (profitability + alerts)
  const e = p.economy;
  if (e && Object.values(e).some((v) => v != null)) {
    await supabase.from('project_economy').upsert(
      {
        project_id: rowId,
        fixed_price: e.fixedPrice ?? null,
        additional_revenue: e.additionalRevenue ?? null,
        budget_hours: e.budgetHours ?? null,
        internal_hourly_cost: e.internalHourlyCost ?? null,
        external_hourly_cost: e.externalHourlyCost ?? null,
        external_cost_extra: e.externalCostExtra ?? null,
        material_cost_extra: e.materialCostExtra ?? null,
        travel_cost_extra: e.travelCostExtra ?? null,
        external_budget: e.externalBudget ?? null,
        target_margin_pct: e.targetMarginPct ?? null,
      } as never,
      { onConflict: 'project_id' },
    );
  }

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

  Promise.all(tasks).catch((e) => {
    console.error('Failed to save changes', e);
    const message = e instanceof Error ? e.message : String(e);
    toast.error(message.includes('Status cannot go from')
      ? message.replace('Status cannot go from', 'That status step is not allowed:')
      : `Could not save changes: ${message}`);
  });

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
