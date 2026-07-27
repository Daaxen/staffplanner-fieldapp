import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadLogs, saveLogs, computeHours, DEFAULT_MILEAGE_RATE,
  type LogsStore, type TimeEntry, type ExpenseEntry, type ExpenseCategory, type ActiveTimer,
} from '@/data/logsData';

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function useInstallerLogs(installerId: string) {
  const [store, setStore] = useState<LogsStore>(() => loadLogs());

  useEffect(() => { saveLogs(store); }, [store]);

  const timeFor = useCallback(
    (projectId?: string) =>
      store.time.filter(t => t.installerId === installerId && (!projectId || t.projectId === projectId)),
    [store.time, installerId],
  );
  const expensesFor = useCallback(
    (projectId?: string) =>
      store.expenses.filter(e => e.installerId === installerId && (!projectId || e.projectId === projectId)),
    [store.expenses, installerId],
  );

  const activeTimer = useMemo<ActiveTimer | null>(() => store.activeTimer, [store.activeTimer]);

  const startTimer = useCallback((projectId: string) => {
    setStore(prev => ({ ...prev, activeTimer: { projectId, startedAt: new Date().toISOString() } }));
  }, []);

  const stopTimer = useCallback((): TimeEntry | null => {
    let created: TimeEntry | null = null;
    setStore(prev => {
      if (!prev.activeTimer) return prev;
      const started = new Date(prev.activeTimer.startedAt);
      const ended = new Date();
      const hours = Math.max(0, Math.round(((ended.getTime() - started.getTime()) / 3_600_000) * 100) / 100);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      created = {
        id: uid('t'),
        projectId: prev.activeTimer.projectId,
        installerId,
        date: started.toISOString().slice(0, 10),
        startTime: hm(started),
        endTime: hm(ended),
        hours,
        source: 'timer',
        createdAt: new Date().toISOString(),
      };
      return { ...prev, time: [created, ...prev.time], activeTimer: null };
    });
    return created;
  }, [installerId]);

  const cancelTimer = useCallback(() => {
    setStore(prev => ({ ...prev, activeTimer: null }));
  }, []);

  const addTime = useCallback((entry: Omit<TimeEntry, 'id' | 'installerId' | 'createdAt' | 'source'> & { source?: TimeEntry['source'] }) => {
    const hours = entry.hours || (entry.startTime && entry.endTime ? computeHours(entry.startTime, entry.endTime) : 0);
    const record: TimeEntry = {
      id: uid('t'),
      installerId,
      createdAt: new Date().toISOString(),
      source: entry.source ?? 'manual',
      ...entry,
      hours,
    };
    setStore(prev => ({ ...prev, time: [record, ...prev.time] }));
    return record;
  }, [installerId]);

  const deleteTime = useCallback((id: string) => {
    setStore(prev => ({ ...prev, time: prev.time.filter(t => t.id !== id) }));
  }, []);

  const addExpense = useCallback((entry: Omit<ExpenseEntry, 'id' | 'installerId' | 'createdAt'>) => {
    const record: ExpenseEntry = {
      id: uid('e'),
      installerId,
      createdAt: new Date().toISOString(),
      ...entry,
    };
    setStore(prev => ({ ...prev, expenses: [record, ...prev.expenses] }));
    return record;
  }, [installerId]);

  const addMileage = useCallback((projectId: string, date: string, km: number, rate = DEFAULT_MILEAGE_RATE, note?: string) => {
    return addExpense({
      projectId,
      date,
      category: 'mileage',
      amount: Math.round(km * rate * 100) / 100,
      km,
      rate,
      note,
    });
  }, [addExpense]);

  const deleteExpense = useCallback((id: string) => {
    setStore(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));
  }, []);

  return {
    timeFor, expensesFor, activeTimer,
    startTimer, stopTimer, cancelTimer,
    addTime, deleteTime,
    addExpense, addMileage, deleteExpense,
    categories: ['materials', 'travel', 'parking', 'meal', 'other'] as ExpenseCategory[],
  };
}

export type InstallerLogs = ReturnType<typeof useInstallerLogs>;
