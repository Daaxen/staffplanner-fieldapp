import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Project } from '@/data/mockData';
import {
  pendingDeviationCount,
  subscribeDeviations,
  syncDeviations,
} from '@/lib/deviations';
import {
  cacheProjects,
  cachedProjects,
  pendingCount,
  subscribeFieldWork,
  syncFieldWork,
} from '@/lib/offline/fieldWork';

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Tracks unsynced work and pushes it up as soon as the connection is back. */
export function useOfflineSync() {
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    Promise.all([pendingCount(), pendingDeviationCount()])
      .then(([work, deviations]) => setPending(work + deviations))
      .catch(() => undefined);
  }, []);

  const sync = useCallback(
    async (silent = false) => {
      if (!navigator.onLine) return;
      setSyncing(true);
      const [res, dev] = await Promise.all([syncFieldWork(), syncDeviations()]);
      res.synced += dev.synced;
      res.failed += dev.failed;
      setSyncing(false);
      refresh();
      if (!silent && res.synced > 0) {
        toast.success(`Synced ${res.synced} job${res.synced === 1 ? '' : 's'}`);
      }
      if (res.failed > 0 && !silent) {
        toast.error('Some work could not be synced yet — it will retry.');
      }
    },
    [refresh],
  );

  useEffect(() => {
    refresh();
    const offWork = subscribeFieldWork(refresh);
    const offDev = subscribeDeviations(refresh);
    return () => {
      offWork();
      offDev();
    };
  }, [refresh]);

  useEffect(() => {
    if (online) void sync(true);
  }, [online, sync]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (navigator.onLine) void sync(true);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [sync]);

  return { online, pending, syncing, sync: () => sync(false), refresh };
}

/** Keeps the technician's work orders readable without a connection. */
export function useCachedProjects(projects: Project[], loaded: boolean): Project[] {
  const online = useOnlineStatus();
  const [cache, setCache] = useState<Project[]>([]);

  useEffect(() => {
    cachedProjects().then(setCache).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (loaded && projects.length > 0) {
      void cacheProjects(projects);
      setCache(projects);
    }
  }, [projects, loaded]);

  if (projects.length === 0 && (!online || !loaded) && cache.length > 0) return cache;
  return projects;
}
