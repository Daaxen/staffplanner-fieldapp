import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMyInstallerId } from '@/lib/installerIdentity';
import { computeHours, DEFAULT_MILEAGE_RATE, type TimeEntry, type ExpenseEntry, type ExpenseCategory } from '@/data/logsData';
import { ratesForClient, type Project } from '@/data/mockData';
import { ensureProjectRowId, projectRefForRowId } from '@/lib/appData';
import { sumActualTime } from '@/lib/timeVariance';
import { toast } from 'sonner';
import {
  timeEntrySchema, mileageEntrySchema, expenseEntrySchema, firstIssue, type ExpenseKind,
  timeMismatch, timeMismatchMessage, type TimeMismatch,
} from '@/lib/validation/reporting';


type Meta = { projectName?: string | null; clientName?: string | null };

export function useInstallerLogs(projects: Project[] = []) {
  // Operational records key on the installer record (public.installers.id),
  // never on the auth user id.
  const { installerId: myInstallerId } = useMyInstallerId();
  const installerId = myInstallerId ?? '';

  const [time, setTime] = useState<TimeEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  /** Set when typed hours disagree with the start and finish times. */
  const [pendingMismatch, setPendingMismatch] = useState<TimeMismatch | null>(null);

  const metaFor = useCallback((projectId: string): Meta => {
    const p = projects.find(pr => pr.id === projectId);
    return { projectName: p?.name ?? null, clientName: p?.client ?? null };
  }, [projects]);

  const rateFor = useCallback((projectId: string) => {
    const p = projects.find(pr => pr.id === projectId);
    return ratesForClient(p?.client, p?.clientId).mileageRate ?? DEFAULT_MILEAGE_RATE;
  }, [projects]);

  const refresh = useCallback(async () => {
    if (!installerId) { setLoading(false); return; }
    setLoading(true);
    const [t, e, m] = await Promise.all([
      supabase.from('time_entries').select('*').eq('installer_id', installerId).order('entry_date', { ascending: false }),
      supabase.from('expense_entries').select('*').eq('installer_id', installerId).order('entry_date', { ascending: false }),
      supabase.from('mileage_entries').select('*').eq('installer_id', installerId).order('entry_date', { ascending: false }),
    ]);

    setTime((t.data ?? []).map(r => ({
      id: r.id, projectId: projectRefForRowId(r.project_id) ?? r.project_id, installerId: r.installer_id, date: r.entry_date,
      startTime: r.start_time ?? undefined, endTime: r.end_time ?? undefined,
      hours: Number(r.hours), travelHours: Number(r.travel_hours ?? 0), note: r.note ?? undefined,
      source: (r.source === 'timer' ? 'timer' : 'manual'), createdAt: r.created_at,
    })));

    const exp: ExpenseEntry[] = (e.data ?? []).map(r => ({
      id: r.id, projectId: projectRefForRowId(r.project_id) ?? r.project_id, installerId: r.installer_id, date: r.entry_date,
      category: r.category as ExpenseCategory, amount: Number(r.amount),
      note: r.note ?? undefined, receiptName: r.receipt_path ?? undefined, createdAt: r.created_at,
    }));
    const mil: ExpenseEntry[] = (m.data ?? []).map(r => ({
      id: r.id, projectId: projectRefForRowId(r.project_id) ?? r.project_id, installerId: r.installer_id, date: r.entry_date,
      category: 'mileage' as ExpenseCategory, amount: Number(r.amount),
      km: Number(r.km), rate: Number(r.rate), note: r.note ?? undefined, createdAt: r.created_at,
    }));
    setExpenses([...exp, ...mil].sort((a, b) => (a.date < b.date ? 1 : -1)));

    setLoading(false);
  }, [installerId]);

  useEffect(() => { refresh(); }, [refresh]);

  const timeFor = useCallback(
    (projectId?: string) => time.filter(t => !projectId || t.projectId === projectId),
    [time],
  );
  const expensesFor = useCallback(
    (projectId?: string) => expenses.filter(e => !projectId || e.projectId === projectId),
    [expenses],
  );

  const addTime = useCallback(async (entry: {
    projectId: string; date: string; startTime?: string; endTime?: string; hours?: number;
    travelHours?: number; note?: string; source?: TimeEntry['source'];
    /** Set once the user has accepted the figure calculated from the times. */
    acceptComputed?: boolean;
  }) => {
    if (!installerId) return null;
    // The database recalculates hours from the times, so a disagreeing figure
    // is never overwritten in silence — the user decides.
    const mismatch = entry.acceptComputed ? null : timeMismatch(entry);
    if (mismatch) {
      setPendingMismatch(mismatch);
      toast.error(timeMismatchMessage(mismatch));
      return null;
    }

    const hours = entry.startTime && entry.endTime
      ? computeHours(entry.startTime, entry.endTime)
      : (entry.hours || 0);
    const travelHours = Math.round((entry.travelHours || 0) * 100) / 100;

    const check = timeEntrySchema.safeParse({
      projectId: entry.projectId, date: entry.date,
      startTime: entry.startTime, endTime: entry.endTime, hours, travelHours, note: entry.note,
    });
    const issue = firstIssue(check);
    if (issue) { toast.error(issue); return null; }

    const meta = metaFor(entry.projectId);
    const project = projects.find(p => p.id === entry.projectId);
    const projectRowId = await ensureProjectRowId(entry.projectId);
    if (!projectRowId) return null;
    const { data, error } = await supabase.from('time_entries').insert({
      project_id: projectRowId, snapshot_project_name: meta.projectName, snapshot_client_name: meta.clientName,
      installer_id: installerId, entry_date: entry.date, start_time: entry.startTime ?? null,
      end_time: entry.endTime ?? null, hours, travel_hours: travelHours,
      note: entry.note ?? null, source: entry.source ?? 'manual',
      hourly_rate: ratesForClient(project?.client, project?.clientId).hourlyRate ?? null,
    }).select().maybeSingle();
    if (error) { toast.error(error.message); return null; }
    await refresh();
    return data;
  }, [installerId, metaFor, projects, refresh]);


  const deleteTime = useCallback(async (id: string) => {
    await supabase.from('time_entries').delete().eq('id', id);
    setTime(prev => prev.filter(t => t.id !== id));
  }, []);

  /** Corrects an existing entry in place: hours always follow start and end. */
  const updateTime = useCallback(async (id: string, patch: {
    startTime: string; endTime: string; travelHours?: number; note?: string;
  }) => {
    const hours = computeHours(patch.startTime, patch.endTime);
    if (hours <= 0) { toast.error('Sluttiden måste vara efter starttiden'); return false; }
    const travelHours = Math.round((patch.travelHours || 0) * 100) / 100;
    const { error } = await supabase.from('time_entries').update({
      start_time: patch.startTime, end_time: patch.endTime, hours, travel_hours: travelHours,
      ...(patch.note !== undefined ? { note: patch.note || null } : {}),
    }).eq('id', id);
    if (error) { toast.error(`Tiden kunde inte ändras: ${error.message}`); return false; }
    await refresh();
    return true;
  }, [refresh]);

  const addExpense = useCallback(async (entry: {
    projectId: string; date: string; category: ExpenseCategory; amount: number; note?: string; receiptName?: string; kind?: ExpenseKind;
  }) => {
    if (!installerId) return null;
    const kind = entry.kind ?? 'expense';
    const check = expenseEntrySchema.safeParse({
      projectId: entry.projectId, date: entry.date, category: entry.category,
      kind, amount: entry.amount, receiptName: entry.receiptName, note: entry.note,
    });
    const issue = firstIssue(check);
    if (issue) { toast.error(issue); return null; }

    const meta = metaFor(entry.projectId);
    const projectRowId = await ensureProjectRowId(entry.projectId);
    if (!projectRowId) return null;
    const { data, error } = await supabase.from('expense_entries').insert({
      project_id: projectRowId, snapshot_project_name: meta.projectName, snapshot_client_name: meta.clientName,
      installer_id: installerId, entry_date: entry.date, category: entry.category, entry_kind: kind,
      amount: entry.amount, note: entry.note ?? null, receipt_path: entry.receiptName ?? null,
    }).select().maybeSingle();
    if (error) { toast.error(error.message); return null; }
    await refresh();
    return data;
  }, [installerId, metaFor, refresh]);

  const addMileage = useCallback(async (projectId: string, date: string, km: number, rate?: number, note?: string) => {
    if (!installerId) return null;
    const effectiveRate = rate ?? rateFor(projectId);
    const check = mileageEntrySchema.safeParse({ projectId, date, km, rate: effectiveRate, note });
    const issue = firstIssue(check);
    if (issue) { toast.error(issue); return null; }

    const meta = metaFor(projectId);
    const projectRowId = await ensureProjectRowId(projectId);
    if (!projectRowId) return null;
    const { data, error } = await supabase.from('mileage_entries').insert({
      project_id: projectRowId, snapshot_project_name: meta.projectName, snapshot_client_name: meta.clientName,
      installer_id: installerId, entry_date: date, km, rate: effectiveRate,
      amount: Math.round(km * effectiveRate * 100) / 100, note: note ?? null,
    }).select().maybeSingle();
    if (error) { toast.error(error.message); return null; }
    await refresh();
    return data;
  }, [installerId, metaFor, rateFor, refresh]);


  const deleteExpense = useCallback(async (id: string) => {
    const entry = expenses.find(e => e.id === id);
    if (entry?.category === 'mileage') {
      await supabase.from('mileage_entries').delete().eq('id', id);
    } else {
      await supabase.from('expense_entries').delete().eq('id', id);
    }
    setExpenses(prev => prev.filter(e => e.id !== id));
  }, [expenses]);

  const categories = useMemo(() => ['materials', 'travel', 'parking', 'meal', 'other'] as ExpenseCategory[], []);

  /** Actual time on an order: work hours, travel hours and their total. */
  const actualFor = useCallback(
    (projectId?: string) => sumActualTime(time.filter(t => !projectId || t.projectId === projectId)),
    [time],
  );

  const clearMismatch = useCallback(() => setPendingMismatch(null), []);

  return {
    loading, refresh,
    timeFor, expensesFor, actualFor,
    addTime, updateTime, deleteTime, pendingMismatch, clearMismatch,
    addExpense, addMileage, deleteExpense,
    rateFor, categories,
  };
}

export type InstallerLogs = ReturnType<typeof useInstallerLogs>;
