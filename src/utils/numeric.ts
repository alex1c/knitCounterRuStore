/**
 * Flexible numeric parsing for form fields (calculators, etc.).
 * Supports comma and dot as decimal separators.
 */

/**
 * Parses a user-typed number string that may use "," or "." as decimal separator.
 */
export function parseFlexibleNumber(input: string): number | null {
  if (typeof input !== 'string') {
    throw new Error('parseFlexibleNumber expects a string');
  }

  const trimmed = input.trim();

  if (
    trimmed === '' ||
    trimmed === ',' ||
    trimmed === '.' ||
    trimmed === '-' ||
    trimmed === '-,' ||
    trimmed === '-.' ||
    /^-?\d+[.,]$/.test(trimmed)
  ) {
    return null;
  }

  const normalized = trimmed.replace(',', '.');

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    if (/^-?\d+[.,]\d*[.,]?$/.test(trimmed) || /^-?[.,]\d*$/.test(trimmed)) {
      return null;
    }
    throw new Error(`Invalid number: ${input}`);
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number: ${input}`);
  }

  return value;
}

/**
 * Finalizes a number on commit (blur / submit).
 */
export function finalizeNumber(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }

  const parsed = parseFlexibleNumber(trimmed);
  if (parsed === null) {
    throw new Error(`Cannot finalize incomplete number: ${input}`);
  }
  return parsed;
}

/**
 * Formats a number for Russian locale display (decimal comma).
 */
export function formatNumberRu(value: number, fractionDigits = 2): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Formats an ISO timestamp for Russian locale display.
 */
export function formatDateTimeRu(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp;
  }
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
