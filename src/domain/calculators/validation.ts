/**
 * Calculator input validation — throws user-friendly Russian messages.
 */

export class CalculatorValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculatorValidationError';
  }
}

/** Requires a finite number strictly greater than zero. */
export function requirePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new CalculatorValidationError(`${label} должно быть больше 0`);
  }
  return value;
}

/** Requires a finite number greater than or equal to zero. */
export function requireNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new CalculatorValidationError(`${label} не может быть отрицательным`);
  }
  return value;
}

/** Requires integer >= min (default 1). */
export function requirePositiveInt(value: number, label: string, min = 1): number {
  if (!Number.isInteger(value) || value < min) {
    throw new CalculatorValidationError(`${label} должно быть целым числом ≥ ${min}`);
  }
  return value;
}
