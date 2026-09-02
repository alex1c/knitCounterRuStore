/**
 * Yarn inventory validation helpers.
 */

import { DomainValidationError } from './validation';
import { skeinsToMilliskeins } from '@/utils/yarnQuantity';

/** Validates yarn name is non-empty. */
export function validateYarnName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new DomainValidationError('Укажите название пряжи', 'name');
  }
  return trimmed;
}

/** Validates quantity in milliskeins is non-negative integer. */
export function validateQuantityMilliskeins(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainValidationError(
      'Количество не может быть отрицательным',
      field
    );
  }
}

/** Parses fractional skein input to milliskeins. */
export function parseSkeinQuantityInput(input: string): number {
  const trimmed = input.trim();
  if (trimmed === '') {
    throw new DomainValidationError('Укажите количество', 'quantity');
  }
  const normalized = trimmed.replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) {
    throw new DomainValidationError('Некорректное количество', 'quantity');
  }
  const skeins = Number(normalized);
  if (!Number.isFinite(skeins) || skeins < 0) {
    throw new DomainValidationError(
      'Количество не может быть отрицательным',
      'quantity'
    );
  }
  return skeinsToMilliskeins(skeins);
}

/** Validates optional positive integer metadata (grams/meters). */
export function validateOptionalPositiveInt(
  value: number | null | undefined,
  field: string
): void {
  if (value == null) return;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainValidationError(
      `${field} must be a positive integer`,
      field
    );
  }
}

/** Validates optional price in minor units. */
export function validateOptionalPriceMinor(value: number | null | undefined): void {
  if (value == null) return;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainValidationError(
      'Цена не может быть отрицательной',
      'purchasePriceMinor'
    );
  }
}
