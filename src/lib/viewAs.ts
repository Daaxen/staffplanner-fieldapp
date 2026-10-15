import { useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Superuser "view as" state: which view (admin/installer) and, in the
 * installer view, which installer is being looked at (read-only).
 * Kept per browser tab in sessionStorage.
 */
export type ViewMode = 'admin' | 'installer';
export interface ViewAsState { mode: ViewMode; installerId: string | null; installerName: string | null }

const KEY = 'viewAs';
const listeners = new Set<() => void>();

function read(): ViewAsState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as ViewAsState;
  } catch { /* ignore */ }
  return { mode: 'admin', installerId: null, installerName: null };
}
let state = read();

function write(next: ViewAsState) {
  state = next;
  try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach(l => l());
}

export function setViewMode(mode: ViewMode) {
  write({ ...state, mode, installerId: mode === 'admin' ? null : state.installerId, installerName: mode === 'admin' ? null : state.installerName });
}

/** Look at the app as this installer (null = your own installer profile). Audited. */
export async function viewAsInstaller(installerId: string | null, installerName: string | null = null) {
  if (installerId) await supabase.rpc('log_view_as' as never, { _installer_id: installerId } as never);
  write({ mode: 'installer', installerId, installerName });
}

export function stopViewingAs() {
  write({ ...state, installerId: null, installerName: null });
}

/** True when a save would be done in someone else's name and must be blocked. */
export function isReadOnlyView(s: ViewAsState, isSuperuser: boolean): boolean {
  return isSuperuser && s.mode === 'installer' && !!s.installerId;
}

export function getViewAs() { return state; }

export function useViewAs(): ViewAsState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => state,
  );
}
