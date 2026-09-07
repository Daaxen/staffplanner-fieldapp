import { useCallback, useEffect, useState } from 'react';
import { clientRegister, type Client } from '@/data/mockData';

const STORAGE_KEY = 'staffplanner.clients.v1';

let store: Client[] = load();
const listeners = new Set<(c: Client[]) => void>();

function load(): Client[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Client[];
    }
  } catch {
    // ignore corrupt storage
  }
  return [...clientRegister];
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota errors
  }
}

export function getClients(): Client[] {
  return store;
}

export function setClients(next: Client[] | ((prev: Client[]) => Client[])) {
  store = typeof next === 'function' ? (next as (p: Client[]) => Client[])(store) : next;
  persist();
  listeners.forEach((l) => l(store));
}

export function useClients(): [Client[], typeof setClients] {
  const [value, setValue] = useState<Client[]>(store);

  useEffect(() => {
    const listener = (c: Client[]) => setValue(c);
    listeners.add(listener);
    setValue(store);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const update = useCallback((next: Parameters<typeof setClients>[0]) => setClients(next), []);
  return [value, update];
}

/** Client names for autocomplete / dropdowns. */
export function useClientNames(): string[] {
  const [clients] = useClients();
  return clients.map((c) => c.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
}
