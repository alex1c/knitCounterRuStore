/**
 * UTC ISO-8601 timestamp helpers for persistence and validation.
 */

const ISO_TIMESTAMP_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/;

/** Returns the current instant as an ISO-8601 UTC string. */
export function nowIsoUtc(): string {
  return new Date().toISOString();
}

/** Asserts that value is a parseable ISO-8601 timestamp string. */
export function assertIsoTimestamp(value: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Expected non-empty ISO timestamp string, got: ${String(value)}`);
  }

  const match = ISO_TIMESTAMP_REGEX.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) {
    throw new Error(`Invalid ISO-8601 timestamp: ${value}`);
  }

  const [, year, month, day, hour, minute, second, offsetSign, offsetHour, offsetMinute] = match;
  const local = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
  if (
    local.getUTCFullYear() !== +year || local.getUTCMonth() !== +month - 1 ||
    local.getUTCDate() !== +day || local.getUTCHours() !== +hour ||
    local.getUTCMinutes() !== +minute || local.getUTCSeconds() !== +second ||
    (offsetSign != null && (+offsetHour > 14 || +offsetMinute > 59 || (+offsetHour === 14 && +offsetMinute !== 0)))
  ) {
    throw new Error(`Invalid ISO-8601 timestamp: ${value}`);
  }

  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(`Unparseable ISO-8601 timestamp: ${value}`);
  }
}
