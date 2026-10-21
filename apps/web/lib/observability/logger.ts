/**
 * Structured logger — Stage 5 (audit Deliverable I Part 3: the app was
 * "analytics-instrumented but not error-instrumented", with a handful of
 * ad-hoc `console.*` lines going to platform stdout unstructured and
 * unredacted).
 *
 * One logger for the whole app:
 * - Leveled: debug / info / warn / error. Minimum level comes from
 *   LOG_LEVEL (default 'info'); anything below it is dropped.
 * - Structured: every call emits ONE JSON line —
 *   { timestamp, level, scope, message, context? } — suitable for
 *   Vercel log drains and any future log product the OWNER chooses
 *   (tracker choice J-B8 is still open; this module deliberately binds
 *   no external service and is fully useful with none configured).
 * - REDACTED BY CONSTRUCTION: context is deep-sanitized before output.
 *   Values under sensitive keys (authorization, cookie, password,
 *   secret, signature, token, api_key and variants — matched on the
 *   normalized key name) are replaced wholesale; email addresses and
 *   credential-shaped substrings (Stripe sk_/rk_/pk_/whsec_ keys,
 *   Bearer tokens) inside string values are masked. A webhook secret
 *   or signature therefore cannot reach the log through this module.
 *   Error objects are reduced to { error_name, error_message } with
 *   the message run through the same string redaction — stacks are
 *   never emitted (they can embed request data).
 *
 * ENVIRONMENT: isomorphic by design — this module touches only
 * `console` and a guarded `process.env` read, so it is safe in server
 * route handlers AND in the client error boundaries (app/error.tsx,
 * app/global-error.tsx), which import it directly. No Node-only APIs,
 * no imports at all.
 *
 * The default sink is the ONLY sanctioned `console.*` user left in
 * app/ + lib/ (Stage 5 replaced every ad-hoc site with this logger).
 * Tests inject a capturing sink via createLogger({ sink }).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
  context?: LogContext;
}

/** Receives the fully sanitized entry. Default: one JSON line to console. */
export type LogSink = (entry: LogEntry) => void;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export const REDACTED = '[redacted]';
const REDACTED_EMAIL = '[redacted-email]';

/**
 * Sensitive key names, normalized (lowercase, non-alphanumerics
 * stripped) before matching — so `apiKey`, `api_key`, `API-KEY`,
 * `stripe-signature`, `webhookSecret`, `access_token`, `set-cookie`
 * all match. Substring match on the normalized name.
 */
const SENSITIVE_KEY_FRAGMENTS = [
  'authorization',
  'cookie',
  'password',
  'passwd',
  'secret',
  'signature',
  'token',
  'apikey',
  'privatekey',
  'clientsecret',
  'credential',
  'bearer',
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment),
  );
}

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const CREDENTIAL_PATTERN =
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9_-]+|\bwhsec_[A-Za-z0-9_-]+|\bBearer\s+\S+/gi;

/** Mask emails and credential-shaped substrings inside a string value. */
export function redactString(value: string): string {
  return value
    .replace(EMAIL_PATTERN, REDACTED_EMAIL)
    .replace(CREDENTIAL_PATTERN, REDACTED);
}

const MAX_DEPTH = 6;

/**
 * Deep-sanitize an arbitrary context value: sensitive keys are masked
 * wholesale, strings are pattern-redacted, Errors become
 * { error_name, error_message } (redacted, no stack), and non-plain
 * values (functions, symbols, bigint, circular refs, deep nesting)
 * degrade to safe placeholders instead of throwing.
 */
export function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return {
      error_name: value.name,
      error_message: redactString(value.message),
    };
  }
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = isSensitiveKey(key)
        ? REDACTED
        : sanitizeLogValue(inner, depth + 1);
    }
    return out;
  }
  // function / symbol / bigint / undefined-in-array etc.
  return `[${typeof value}]`;
}

export function sanitizeLogContext(context: LogContext): LogContext {
  return sanitizeLogValue(context) as LogContext;
}

function envMinLevel(): LogLevel {
  const raw =
    typeof process !== 'undefined' ? process.env?.LOG_LEVEL : undefined;
  const normalized = typeof raw === 'string' ? raw.toLowerCase() : '';
  return normalized === 'debug' ||
    normalized === 'info' ||
    normalized === 'warn' ||
    normalized === 'error'
    ? normalized
    : 'info';
}

const defaultSink: LogSink = (entry) => {
  const line = JSON.stringify(entry);
  if (entry.level === 'error') console.error(line);
  else if (entry.level === 'warn') console.warn(line);
  else if (entry.level === 'debug') console.debug(line);
  else console.info(line);
};

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Derive a logger with a more specific scope (scope:child). */
  child(scope: string): Logger;
}

export interface LoggerOptions {
  /** Minimum level; defaults to LOG_LEVEL env or 'info'. */
  minLevel?: LogLevel;
  /** Output sink; defaults to one JSON line per entry on console. */
  sink?: LogSink;
  /** Clock override for tests. */
  now?: () => Date;
}

export function createLogger(scope: string, options: LoggerOptions = {}): Logger {
  const minLevel = options.minLevel ?? envMinLevel();
  const sink = options.sink ?? defaultSink;
  const now = options.now ?? (() => new Date());

  function emit(level: LogLevel, message: string, context?: LogContext) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    const entry: LogEntry = {
      timestamp: now().toISOString(),
      level,
      scope,
      message: redactString(message),
    };
    if (context && Object.keys(context).length > 0) {
      entry.context = sanitizeLogContext(context);
    }
    try {
      sink(entry);
    } catch {
      // Logging must never break the flow that called it.
    }
  }

  return {
    debug: (message, context) => emit('debug', message, context),
    info: (message, context) => emit('info', message, context),
    warn: (message, context) => emit('warn', message, context),
    error: (message, context) => emit('error', message, context),
    child: (childScope) =>
      createLogger(`${scope}:${childScope}`, options),
  };
}

/** Root logger for call sites that do not need their own scope. */
export const logger = createLogger('app');
