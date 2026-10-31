import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  emptyWork,
  hydrateWork,
  loadWork,
  saveWork,
  syncFieldWork,
  type FieldWork,
} from '@/lib/offline/fieldWork';
import { useOnlineStatus } from '@/hooks/useOffline';
import { canSubmitReport } from '@/lib/completionRequirements';

/**
 * One shared source for a job's checklist, report, photos and sign-offs.
 * Every change is written to the offline store straight away and pushed to the
 * server as soon as there is a connection, so both the normal order view and
 * technician mode show exactly the same saved work.
 */
export function useFieldWork(projectRef: string, projectName?: string) {
  const [work, setWork] = useState<FieldWork>(() => emptyWork(projectRef, projectName));
  const [loaded, setLoaded] = useState(false);
  const online = useOnlineStatus();
  const pushTimer = useRef<number | null>(null);
  const workRef = useRef(work);
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    setLoaded(false);
    hydrateWork(projectRef, projectName).then(w => {
      if (!active) return;
      workRef.current = w;
      setWork(w);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [projectRef, projectName]);

  // Push saved work up shortly after the last edit, and again when back online.
  const schedulePush = useCallback(() => {
    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => {
      void syncFieldWork();
    }, 2000);
  }, []);

  useEffect(() => {
    if (online && loaded) void syncFieldWork();
  }, [online, loaded]);

  useEffect(
    () => () => {
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
    },
    [],
  );

  const update = useCallback(
    async (patch: Partial<FieldWork>) => {
      const next = { ...workRef.current, ...patch, projectRef, projectName };
      workRef.current = next;
      setWork(next);
      const write = writes.current.catch(() => undefined).then(() => saveWork(next));
      writes.current = write;
      const saved = await write;
      schedulePush();
      return saved;
    },
    [projectRef, projectName, schedulePush],
  );

  const submitReport = useCallback(async () => {
    if (!loaded) throw new Error('Rapporten laddas fortfarande. Försök igen strax.');
    if (!canSubmitReport(workRef.current.reportText)) throw new Error('Skriv en installationsrapport först.');
    await update({ reportSubmitted: true });
    await syncFieldWork();
    const saved = await loadWork(projectRef, projectName);
    // A queued report is saved on the phone, not yet confirmed by the server.
    return !saved.dirty;
  }, [loaded, update, projectRef, projectName]);

  /** Used by PhotoManager, which saves the work record itself. */
  const replace = useCallback(
    (next: FieldWork) => {
      workRef.current = next;
      setWork(next);
      schedulePush();
    },
    [schedulePush],
  );

  const state = useMemo(
    () => ({
      photoCount: work.photos.length,
      checkedItems: work.checkedItems,
      signature: work.signature,
      reportSubmitted: work.reportSubmitted,
      signOffs: work.signOffs ?? {},
    }),
    [work.photos.length, work.checkedItems, work.signature, work.reportSubmitted, work.signOffs],
  );

  return { work, state, loaded, online, update, submitReport, replace, setWork };
}
