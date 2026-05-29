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

// ─── Security Monitoring & Alerting Configuration (Audit Fix: May 29, 2026) ───
export const SECURITY_ALERT_THRESHOLDS = {
  rateLimitBreaches: 10,      // Alert after 10 rate limit hits from same IP in 5min
  walletMismatches: 3,        // Alert after 3 wallet mismatch attempts from same user
  csrfFailures: 5,            // Alert after 5 CSRF validation failures from same IP
  failedAuthAttempts: 10,     // Alert after 10 failed auth attempts from same IP
  alertCooldownMs: 300_000,   // 5 minute cooldown between alerts
} as const;

// Track alert state to prevent spam
const alertState = new Map<string, number>();

export function shouldAlert(category: string, identifier: string): boolean {
  const key = `${category}:${identifier}`;
  const lastAlert = alertState.get(key) || 0;
  const now = Date.now();
  if (now - lastAlert < SECURITY_ALERT_THRESHOLDS.alertCooldownMs) return false;
  alertState.set(key, now);
  return true;
}
