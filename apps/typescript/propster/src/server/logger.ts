import "server-only";

/**
 * Minimal structured logger.
 *
 * Phone numbers and API keys must never reach the log stream, so every value
 * passes through `redact` on the way out.
 */

type Level = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEYS = /(phone|apikey|api_key|authorization|token|secret|key)/i;

function redactValue(key: string, value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (!SENSITIVE_KEYS.test(key)) return value;
  if (value.length <= 4) return "[redacted]";
  return "[redacted:" + value.slice(-4) + "]";
}

function redact(context: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    output[key] = redactValue(key, value);
  }
  return output;
}

function emit(level: Level, message: string, context: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    level,
    message,
    ...redact(context),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};
