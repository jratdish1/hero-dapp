/**
 * HERO DAO — Structured Logger
 * =============================
 * Production-grade structured logging for DAO operations.
 * Replaces raw console.log/warn/error with JSON-structured output.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const MIN_LEVEL: LogLevel = (process.env.DAO_LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function log(level: LogLevel, module: string, message: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...(data && { data }),
  };

  const formatted = formatEntry(entry);
  
  switch (level) {
    case 'error':
    case 'fatal':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export function createDaoLogger(module: string) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) => log('debug', module, msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log('info', module, msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log('warn', module, msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log('error', module, msg, data),
    fatal: (msg: string, data?: Record<string, unknown>) => log('fatal', module, msg, data),
  };
}
