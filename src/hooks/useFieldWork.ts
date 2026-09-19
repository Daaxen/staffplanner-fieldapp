import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  emptyWork,
  hydrateWork,
  saveWork,
  syncFieldWork,
  type FieldWork,
} from '@/lib/offline/fieldWork';
import { useOnlineStatus } from '@/hooks/useOffline';

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

  useEffect(() => {
    let active = true;
    setLoaded(false);
    hydrateWork(projectRef, projectName).then(w => {
      if (!active) return;
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
      const next = await saveWork({ ...work, ...patch, projectRef, projectName });
      setWork(next);
      schedulePush();
      return next;
    },
    [work, projectRef, projectName, schedulePush],
  );

  /** Used by PhotoManager, which saves the work record itself. */
  const replace = useCallback(
    (next: FieldWork) => {
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

  return { work, state, loaded, online, update, replace, setWork };
}
