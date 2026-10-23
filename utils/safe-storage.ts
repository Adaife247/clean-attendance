// ─── utils/safe-storage.ts ───
// localStorage can throw (Safari private mode, quota exceeded, disabled).
// This wrapper catches every failure and falls back gracefully.

type StorageOp = 'get' | 'set' | 'remove';

function tryStorage<T>(op: StorageOp, key: string, value?: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    if (op === 'get') return window.localStorage.getItem(key) as T | null;
    if (op === 'set' && value !== undefined) {
      window.localStorage.setItem(key, value);
      return null;
    }
    if (op === 'remove') {
      window.localStorage.removeItem(key);
      return null;
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
       
      console.warn(`[safe-storage] ${op}("${key}") failed:`, err);
    }
  }
  return null;
}

export const safeStorage = {
  getString(key: string): string | null {
    return tryStorage<string>('get', key);
  },

  setString(key: string, value: string): void {
    tryStorage<null>('set', key, value);
  },

  getJSON<T>(key: string): T | null {
    const raw = tryStorage<string>('get', key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  setJSON<T>(key: string, value: T): void {
    try {
      tryStorage<null>('set', key, JSON.stringify(value));
    } catch {
      // Circular ref or similar — silently drop
    }
  },

  remove(key: string): void {
    tryStorage<null>('remove', key);
  },
};