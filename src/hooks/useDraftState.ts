import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/** Unsaved technician input survives app switches, back navigation and OS kills; dropped after 7 days. */
export const DRAFT_PREFIX = 'fetch.draft.';
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CLEAR_EVENT = 'fetch:draft-clear';

let draftUser = 'anon';
/** Called from auth so drafts are kept apart per signed-in user. */
export const setDraftUser = (id: string | null | undefined) => { draftUser = id || 'anon'; };
export const draftScope = (projectId: string) => `${DRAFT_PREFIX}${draftUser}.${projectId}.`;

type Stored<T> = { v: T; t: number };

export function readDraft<T>(key: string, now = Date.now()): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const s = JSON.parse(raw) as Stored<T>;
    if (!s || typeof s.t !== 'number' || now - s.t > DRAFT_MAX_AGE_MS) { localStorage.removeItem(key); return undefined; }
    return s.v;
  } catch { return undefined; }
}

export function writeDraft<T>(key: string, value: T, initial: T) {
  try {
    if (JSON.stringify(value) === JSON.stringify(initial)) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ v: value, t: Date.now() }));
  } catch { /* storage full or blocked */ }
}

export function hasDrafts(scope: string): boolean {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(scope) && readDraft(k) !== undefined) return true;
  }
  return false;
}

export function clearDrafts(scope: string) {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(scope)) keys.push(k); }
  keys.forEach(k => localStorage.removeItem(k));
  window.dispatchEvent(new CustomEvent(CLEAR_EVENT, { detail: scope }));
}

/**
 * Drop-in for useState that keeps the value in localStorage until it returns to its initial value
 * (i.e. the form was saved and reset). Pass key = null to disable.
 */
export function useDraftState<T>(key: string | null, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const initialRef = useRef<T>(typeof initial === 'function' ? (initial as () => T)() : initial);
  const [value, setValue] = useState<T>(() => (key ? readDraft<T>(key) : undefined) ?? initialRef.current);
  const latest = useRef(value);
  latest.current = value;
  const loadedKey = useRef(key);

  // Key change (e.g. other date): load that key's draft.
  useEffect(() => {
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    setValue((key ? readDraft<T>(key) : undefined) ?? initialRef.current);
  }, [key]);

  useEffect(() => {
    if (!key) return;
    const id = window.setTimeout(() => writeDraft(key, value, initialRef.current), 300);
    return () => window.clearTimeout(id);
  }, [key, value]);

  const flush = useCallback(() => { if (key) writeDraft(key, latest.current, initialRef.current); }, [key]);
  useEffect(() => {
    if (!key) return;
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    const onClear = (e: Event) => { if (key.startsWith((e as CustomEvent<string>).detail)) setValue(initialRef.current); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    window.addEventListener(CLEAR_EVENT, onClear);
    return () => { flush(); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush); window.removeEventListener(CLEAR_EVENT, onClear); };
  }, [key, flush]);

  return [value, setValue];
}
