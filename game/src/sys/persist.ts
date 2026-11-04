// Tiny IndexedDB key-value store. All calls are best-effort: a failing store never stops the game.
const DB = 'cmcw';
const STORE = 'kv';
let dbp: Promise<IDBDatabase> | null = null;

function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}

export async function load<T>(key: string): Promise<T | null> {
  try {
    const d = await db();
    return await new Promise((res) => {
      const r = d.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => res((r.result as T) ?? null);
      r.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}

export async function save(key: string, value: unknown): Promise<boolean> {
  try {
    const d = await db();
    return await new Promise((res) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    });
  } catch {
    return false;
  }
}

export async function wipe(): Promise<void> {
  try {
    const d = await db();
    await new Promise<void>((res) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch {
    /* ignore */
  }
}
