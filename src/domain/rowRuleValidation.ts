/**
 * Row rule and linked-counter validation.
 */

import {
  COUNTER_LINK_TYPES,
  ROW_RULE_TYPES,
  type CounterLinkType,
  type RowRuleType,
} from './codes';
import { DomainValidationError } from './validation';

export function validateRowRuleType(value: string): RowRuleType {
  if (!(ROW_RULE_TYPES as readonly string[]).includes(value)) {
    throw new DomainValidationError(`Invalid rule_type: ${value}`, 'ruleType');
  }
  return value as RowRuleType;
}

export function validateCounterLinkType(value: string): CounterLinkType {
  if (!(COUNTER_LINK_TYPES as readonly string[]).includes(value)) {
    throw new DomainValidationError(`Invalid link_type: ${value}`, 'linkType');
  }
  return value as CounterLinkType;
}

export function validatePositiveRow(value: number | null | undefined, field: string): void {
  if (value == null) return;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainValidationError(`${field} must be a positive integer`, field);
  }
}

/** Parses "30, 42, 54" into sorted unique positive integers. */
export function parseRowListInput(input: string): number[] {
  const trimmed = input.trim();
  if (trimmed === '') {
    throw new DomainValidationError('Список рядов не может быть пустым', 'listRows');
  }

  const parts = trimmed.split(/[,;\s]+/).filter(Boolean);
  const rows: number[] = [];

  for (const part of parts) {
    const n = Number(part.trim());
    if (!Number.isSafeInteger(n) || n <= 0) {
      throw new DomainValidationError(
        `Некорректный номер ряда: ${part}`,
        'listRows'
      );
    }
    rows.push(n);
  }

  return [...new Set(rows)].sort((a, b) => a - b);
}

export type RowRuleInput = {
  ruleType: RowRuleType;
  instruction: string;
  exactRow?: number | null;
  everyNRows?: number | null;
  startRow?: number | null;
  endRow?: number | null;
  listRows?: number[];
};

/** Validates rule fields match rule_type. */
export function validateRowRuleFields(input: RowRuleInput): void {
  const instruction = input.instruction?.trim() ?? '';
  if (instruction.length === 0) {
    throw new DomainValidationError('Укажите действие', 'instruction');
  }

  switch (input.ruleType) {
    case 'exact':
      rejectUnexpectedRuleFields(input, ['everyNRows', 'startRow', 'endRow']);
      validatePositiveRow(input.exactRow, 'exactRow');
      if (input.exactRow == null) {
        throw new DomainValidationError('Укажите номер ряда', 'exactRow');
      }
      break;

    case 'every_n':
      rejectUnexpectedRuleFields(input, ['exactRow', 'startRow']);
      validatePositiveRow(input.everyNRows, 'everyNRows');
      if (input.everyNRows == null) {
        throw new DomainValidationError('Укажите интервал N', 'everyNRows');
      }
      validatePositiveRow(input.endRow, 'endRow');
      break;

    case 'every_n_from':
      rejectUnexpectedRuleFields(input, ['exactRow']);
      validatePositiveRow(input.startRow, 'startRow');
      validatePositiveRow(input.everyNRows, 'everyNRows');
      if (input.startRow == null || input.everyNRows == null) {
        throw new DomainValidationError(
          'Укажите начальный ряд и интервал',
          'startRow'
        );
      }
      validatePositiveRow(input.endRow, 'endRow');
      if (input.endRow != null && input.endRow < input.startRow) {
        throw new DomainValidationError(
          'Конечный ряд не может быть раньше начального',
          'endRow'
        );
      }
      break;

    case 'list': {
      rejectUnexpectedRuleFields(input, [
        'exactRow',
        'everyNRows',
        'startRow',
        'endRow',
      ]);
      const rows = input.listRows ?? [];
      if (rows.length === 0) {
        throw new DomainValidationError('Укажите хотя бы один ряд', 'listRows');
      }
      for (const row of rows) {
        validatePositiveRow(row, 'listRows');
      }
      break;
    }
  }
}

function rejectUnexpectedRuleFields(
  input: RowRuleInput,
  fields: (keyof RowRuleInput)[]
): void {
  for (const field of fields) {
    if (input[field] != null) {
      throw new DomainValidationError(
        `${String(field)} is not valid for ${input.ruleType}`,
        String(field)
      );
    }
  }
}
