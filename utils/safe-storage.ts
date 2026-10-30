// ─── utils/safe-storage.ts ───
// localStorage and sessionStorage can throw (Safari private mode, quota
// exceeded, disabled by policy). This wrapper catches every failure and
// falls back gracefully, but always logs so prod isn't blind.

import { scoped } from './logger';

const log = scoped('safe-storage');

type StorageOp = 'get' | 'set' | 'remove';

function tryLocal<T>(op: StorageOp, key: string, value?: string): T | null {
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
    log.warn(`localStorage ${op}("${key}") failed`, err);
  }
  return null;
}

function trySession<T>(op: StorageOp, key: string, value?: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    if (op === 'get') return window.sessionStorage.getItem(key) as T | null;
    if (op === 'set' && value !== undefined) {
      window.sessionStorage.setItem(key, value);
      return null;
    }
    if (op === 'remove') {
      window.sessionStorage.removeItem(key);
      return null;
    }
  } catch (err) {
    log.warn(`sessionStorage ${op}("${key}") failed`, err);
  }
  return null;
}

export const safeStorage = {
  // ── localStorage (persistent) ──
  getString(key: string): string | null {
    return tryLocal<string>('get', key);
  },
  setString(key: string, value: string): void {
    tryLocal<null>('set', key, value);
  },
  getJSON<T>(key: string): T | null {
    const raw = tryLocal<string>('get', key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      log.warn(`JSON.parse failed for localStorage key "${key}"`, err);
      return null;
    }
  },
  setJSON<T>(key: string, value: T): void {
    try {
      tryLocal<null>('set', key, JSON.stringify(value));
    } catch (err) {
      log.warn(`JSON.stringify failed for localStorage key "${key}"`, err);
    }
  },
  remove(key: string): void {
    tryLocal<null>('remove', key);
  },

  // ── sessionStorage (dies on tab close — used for the student JWT) ──
  getSessionString(key: string): string | null {
    return trySession<string>('get', key);
  },
  setSessionString(key: string, value: string): void {
    trySession<null>('set', key, value);
  },
  getSessionJSON<T>(key: string): T | null {
    const raw = trySession<string>('get', key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      log.warn(`JSON.parse failed for sessionStorage key "${key}"`, err);
      return null;
    }
  },
  setSessionJSON<T>(key: string, value: T): void {
    try {
      trySession<null>('set', key, JSON.stringify(value));
    } catch (err) {
      log.warn(`JSON.stringify failed for sessionStorage key "${key}"`, err);
    }
  },
  removeSession(key: string): void {
    trySession<null>('remove', key);
  },
};