// ─── utils/logger.ts ───
// Use this instead of raw console.log so production stays clean.
// In production, only `error` and `warn` get through.

const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    // Always log warnings — they're actionable
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    // Always log errors — never hide failures
    console.error(...args);
  },
};