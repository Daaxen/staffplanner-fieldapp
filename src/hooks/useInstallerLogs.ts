import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { computeHours, DEFAULT_MILEAGE_RATE, type TimeEntry, type ExpenseEntry, type ExpenseCategory, type ActiveTimer } from '@/data/logsData';
import { ratesForClient, type Project } from '@/data/mockData';
import { ensureProjectRowId, projectRefForRowId } from '@/lib/appData';
import { toast } from 'sonner';
import {
  timeEntrySchema, mileageEntrySchema, expenseEntrySchema, firstIssue, type ExpenseKind,
} from '@/lib/validation/reporting';


type Meta = { projectName?: string | null; clientName?: string | null };

export function useInstallerLogs(projects: Project[] = []) {
  const { user } = useAuth();
  const installerId = user?.id ?? '';

  const [time, setTime] = useState<TimeEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [loading, setLoading] = useState(true);

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
    const [t, e, m, timer] = await Promise.all([
      supabase.from('time_entries').select('*').eq('installer_id', installerId).order('entry_date', { ascending: false }),
      supabase.from('expense_entries').select('*').eq('installer_id', installerId).order('entry_date', { ascending: false }),
      supabase.from('mileage_entries').select('*').eq('installer_id', installerId).order('entry_date', { ascending: false }),
      supabase.from('active_timers').select('*').eq('installer_id', installerId).maybeSingle(),
    ]);

    setTime((t.data ?? []).map(r => ({
      id: r.id, projectId: projectRefForRowId(r.project_id) ?? r.project_id, installerId: r.installer_id, date: r.entry_date,
      startTime: r.start_time ?? undefined, endTime: r.end_time ?? undefined,
      hours: Number(r.hours), note: r.note ?? undefined,
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

    setActiveTimer(timer.data ? { projectId: projectRefForRowId(timer.data.project_id) ?? timer.data.project_id, startedAt: timer.data.started_at } : null);
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

  const startTimer = useCallback(async (projectId: string) => {
    if (!installerId) return;
    const startedAt = new Date().toISOString();
    const projectRowId = await ensureProjectRowId(projectId);
    if (!projectRowId) return;
    await supabase.from('active_timers').upsert({
      installer_id: installerId, project_id: projectRowId,
      snapshot_project_name: metaFor(projectId).projectName, started_at: startedAt,
    });
    setActiveTimer({ projectId, startedAt });
  }, [installerId, metaFor]);

  const addTime = useCallback(async (entry: {
    projectId: string; date: string; startTime?: string; endTime?: string; hours?: number; note?: string; source?: TimeEntry['source'];
  }) => {
    if (!installerId) return null;
    const bothTimes = Boolean(entry.startTime && entry.endTime);
    const hours = bothTimes
      ? computeHours(entry.startTime!, entry.endTime!)
      : (entry.hours || 0);

    const check = timeEntrySchema.safeParse({
      projectId: entry.projectId, date: entry.date,
      startTime: entry.startTime, endTime: entry.endTime, hours, note: entry.note,
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
      end_time: entry.endTime ?? null, hours, note: entry.note ?? null, source: entry.source ?? 'manual',
      hourly_rate: ratesForClient(project?.client, project?.clientId).hourlyRate ?? null,
    }).select().maybeSingle();
    if (error) { toast.error(error.message); return null; }
    await refresh();
    return data;
  }, [installerId, metaFor, projects, refresh]);


  const stopTimer = useCallback(async () => {
    if (!activeTimer || !installerId) return null;
    const started = new Date(activeTimer.startedAt);
    const ended = new Date();
    const hours = Math.max(0, Math.round(((ended.getTime() - started.getTime()) / 3_600_000) * 100) / 100);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const sameDay = started.toDateString() === ended.toDateString();
    await addTime({
      projectId: activeTimer.projectId,
      date: started.toISOString().slice(0, 10),
      startTime: sameDay ? hm(started) : undefined,
      endTime: sameDay ? hm(ended) : undefined,
      hours, source: 'timer',
    });

    await supabase.from('active_timers').delete().eq('installer_id', installerId);
    setActiveTimer(null);
    return null;
  }, [activeTimer, installerId, addTime]);

  const cancelTimer = useCallback(async () => {
    if (!installerId) return;
    await supabase.from('active_timers').delete().eq('installer_id', installerId);
    setActiveTimer(null);
  }, [installerId]);

  const deleteTime = useCallback(async (id: string) => {
    await supabase.from('time_entries').delete().eq('id', id);
    setTime(prev => prev.filter(t => t.id !== id));
  }, []);

  const addExpense = useCallback(async (entry: {
    projectId: string; date: string; category: ExpenseCategory; amount: number; note?: string; receiptName?: string;
  }) => {
    if (!installerId) return null;
    const meta = metaFor(entry.projectId);
    const projectRowId = await ensureProjectRowId(entry.projectId);
    if (!projectRowId) return null;
    const { data } = await supabase.from('expense_entries').insert({
      project_id: projectRowId, snapshot_project_name: meta.projectName, snapshot_client_name: meta.clientName,
      installer_id: installerId, entry_date: entry.date, category: entry.category,
      amount: entry.amount, note: entry.note ?? null, receipt_path: entry.receiptName ?? null,
    }).select().maybeSingle();
    await refresh();
    return data;
  }, [installerId, metaFor, refresh]);

  const addMileage = useCallback(async (projectId: string, date: string, km: number, rate?: number, note?: string) => {
    if (!installerId) return null;
    const meta = metaFor(projectId);
    const effectiveRate = rate ?? rateFor(projectId);
    const projectRowId = await ensureProjectRowId(projectId);
    if (!projectRowId) return null;
    const { data } = await supabase.from('mileage_entries').insert({
      project_id: projectRowId, snapshot_project_name: meta.projectName, snapshot_client_name: meta.clientName,
      installer_id: installerId, entry_date: date, km, rate: effectiveRate,
      amount: Math.round(km * effectiveRate * 100) / 100, note: note ?? null,
    }).select().maybeSingle();
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

  return {
    loading, refresh,
    timeFor, expensesFor, activeTimer,
    startTimer, stopTimer, cancelTimer,
    addTime, deleteTime,
    addExpense, addMileage, deleteExpense,
    rateFor, categories,
  };
}

export type InstallerLogs = ReturnType<typeof useInstallerLogs>;
