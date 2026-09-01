/**
 * Domain validation helpers used by repositories before writes.
 */

import {
  COUNTER_EVENT_TYPES,
  CRAFT_TYPES,
  PROJECT_STATUSES,
  type CounterEventType,
  type CraftType,
  type ProjectStatus,
} from './codes';
import { assertIsoTimestamp } from '@/utils/timestamps';

/** Thrown when a domain invariant fails before persistence. */
export class DomainValidationError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'DomainValidationError';
    this.field = field;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Validates a non-empty trimmed name for projects, parts, counters. */
export function validateNonEmptyName(name: string, field: string): string {
  if (typeof name !== 'string') {
    throw new DomainValidationError(`${field} must be a string`, field);
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new DomainValidationError(`${field} cannot be empty`, field);
  }
  return trimmed;
}

/** Validates craft_type enum. */
export function validateCraftType(value: string): CraftType {
  if (!(CRAFT_TYPES as readonly string[]).includes(value)) {
    throw new DomainValidationError(
      `Invalid craft_type: ${value}`,
      'craftType'
    );
  }
  return value as CraftType;
}

/** Validates project status enum. */
export function validateProjectStatus(value: string): ProjectStatus {
  if (!(PROJECT_STATUSES as readonly string[]).includes(value)) {
    throw new DomainValidationError(
      `Invalid project status: ${value}`,
      'status'
    );
  }
  return value as ProjectStatus;
}

/** Validates counter event type enum. */
export function validateCounterEventType(value: string): CounterEventType {
  if (!(COUNTER_EVENT_TYPES as readonly string[]).includes(value)) {
    throw new DomainValidationError(
      `Invalid counter event type: ${value}`,
      'eventType'
    );
  }
  return value as CounterEventType;
}

/** Counter values must be non-negative integers. */
export function validateCounterValue(value: number, field: string): void {
  if (!Number.isInteger(value)) {
    throw new DomainValidationError(
      `${field} must be an integer, received ${value}`,
      field
    );
  }
  if (value < 0) {
    throw new DomainValidationError(
      `${field} must not be negative, received ${value}`,
      field
    );
  }
}

/** repeat_length, when present, must be a positive integer. */
export function validateRepeatLength(value: number | null | undefined): void {
  if (value == null) {
    return;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainValidationError(
      'repeat_length must be a positive integer',
      'repeatLength'
    );
  }
}

/** Optional ISO timestamp — null allowed, non-null must be valid. */
export function validateOptionalIsoTimestamp(
  value: string | null | undefined,
  field: string
): void {
  if (value == null) {
    return;
  }
  try {
    assertIsoTimestamp(value);
  } catch {
    throw new DomainValidationError(`Invalid ${field}: ${value}`, field);
  }
}
