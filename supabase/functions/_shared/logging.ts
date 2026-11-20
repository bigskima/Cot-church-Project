const sensitiveKeys = /authorization|cookie|password|token|secret|otp/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sensitiveKeys.test(key) ? "[REDACTED]" : redact(child)]));
  }
  return value;
}

export function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) {
  const entry = JSON.stringify(redact({ timestamp: new Date().toISOString(), level, event, ...fields }));
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}
