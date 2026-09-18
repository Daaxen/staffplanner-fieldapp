// Tiny IndexedDB wrapper — no dependencies.
const DB_NAME = 'staffplanner-offline';
const DB_VERSION = 1;
export const STORES = ['kv', 'work', 'photos'] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const idbGet = <T>(store: StoreName, key: string) => tx<T | undefined>(store, 'readonly', s => s.get(key));
export const idbSet = (store: StoreName, key: string, value: unknown) =>
  tx<void>(store, 'readwrite', s => s.put(value, key));
export const idbDel = (store: StoreName, key: string) => tx<void>(store, 'readwrite', s => s.delete(key));
export const idbKeys = (store: StoreName) => tx<IDBValidKey[]>(store, 'readonly', s => s.getAllKeys());
export const idbAll = <T>(store: StoreName) => tx<T[]>(store, 'readonly', s => s.getAll());

export const idbAvailable = typeof indexedDB !== 'undefined';
