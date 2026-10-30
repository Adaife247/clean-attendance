// ─── utils/logger.ts ───
// Use this instead of raw console.log so production stays clean.
// In production, only warn/error get through.
//
// Batch 9 will wire `captureException` to Sentry. Until then, the hook
// is a no-op — but every caller is already routed through here, so
// flipping it on is a one-line change.

const isDev = process.env.NODE_ENV !== 'production';

type Level = 'debug' | 'log' | 'info' | 'warn' | 'error';

// Placeholder: Batch 9 replaces this with Sentry.captureException.
// Kept here so callers don't need to change when Sentry arrives.
let errorSink: ((err: unknown, ctx?: Record<string, unknown>) => void) | null = null;

export function setErrorSink(sink: typeof errorSink) {
  errorSink = sink;
}

function emit(level: Level, args: unknown[]) {
  if (level === 'debug' || level === 'log' || level === 'info') {
    if (isDev) console[level](...args);
    return;
  }
  if (level === 'warn') {
    console.warn(...args);
    return;
  }
  // error — always log, and forward the first Error found to the sink
  console.error(...args);
  if (errorSink) {
    const err = args.find((a) => a instanceof Error) as Error | undefined;
    if (err) errorSink(err, { args });
  }
}

export const logger = {
  debug: (...args: unknown[]) => emit('debug', args),
  log: (...args: unknown[]) => emit('log', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
};

/**
 * Creates a namespaced logger. Every call is prefixed with `[scope]`.
 * Use one per module so grep-ability stays high.
 *
 * Example:
 *   const log = scoped('verify-attendance');
 *   log.warn('no valid pings', { count: 0 });
 */
export function scoped(scope: string) {
  return {
    debug: (...args: unknown[]) => emit('debug', [`[${scope}]`, ...args]),
    log: (...args: unknown[]) => emit('log', [`[${scope}]`, ...args]),
    info: (...args: unknown[]) => emit('info', [`[${scope}]`, ...args]),
    warn: (...args: unknown[]) => emit('warn', [`[${scope}]`, ...args]),
    error: (...args: unknown[]) => emit('error', [`[${scope}]`, ...args]),
  };
}