// ─── utils/logger.ts ───
import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV !== 'production';

type Level = 'debug' | 'log' | 'info' | 'warn' | 'error';

function emit(level: Level, args: unknown[]) {
  if (level === 'debug' || level === 'log' || level === 'info') {
    if (isDev) console[level](...args);
    return;
  }
  if (level === 'warn') {
    console.warn(...args);
    return;
  }
  
  // error — always log, and forward to Sentry
  console.error(...args);
  const err = args.find((a) => a instanceof Error) as Error | undefined;
  if (err) {
    Sentry.captureException(err, { extra: { args } });
  } else {
    Sentry.captureMessage(args.map(String).join(' '), 'error');
  }
}

export const logger = {
  debug: (...args: unknown[]) => emit('debug', args),
  log: (...args: unknown[]) => emit('log', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
};

export function scoped(scope: string) {
  return {
    debug: (...args: unknown[]) => emit('debug', [`[${scope}]`, ...args]),
    log: (...args: unknown[]) => emit('log', [`[${scope}]`, ...args]),
    info: (...args: unknown[]) => emit('info', [`[${scope}]`, ...args]),
    warn: (...args: unknown[]) => emit('warn', [`[${scope}]`, ...args]),
    error: (...args: unknown[]) => emit('error', [`[${scope}]`, ...args]),
  };
}