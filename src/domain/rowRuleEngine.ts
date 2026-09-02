/**
 * Pure row-rule evaluation engine.
 *
 * Row semantics: current_value = N means the user is ON / has reached row N.
 * A rule for row N is due when current_value === N (not after leaving N).
 */

import type { RowRule } from '@/domain/types';

export type RuleMatch = {
  rule: RowRule;
  currentRow: number;
};

export type NextRuleMatch = {
  rule: RowRule;
  dueAtRow: number;
  rowsUntil: number;
};

function isPositiveRow(value: number | null | undefined): value is number {
  return value != null && Number.isSafeInteger(value) && value > 0;
}

function hasValidEndRow(rule: RowRule): boolean {
  return rule.endRow == null || isPositiveRow(rule.endRow);
}

/** Returns true when rule is due at currentRow. */
export function isRuleDueAtRow(rule: RowRule, currentRow: number): boolean {
  if (!rule.isActive || !isPositiveRow(currentRow) || !hasValidEndRow(rule)) {
    return false;
  }

  switch (rule.ruleType) {
    case 'exact':
      return isPositiveRow(rule.exactRow) && rule.exactRow === currentRow;

    case 'every_n': {
      const n = rule.everyNRows;
      if (!isPositiveRow(n)) return false;
      if (currentRow < n) return false;
      if (rule.endRow != null && currentRow > rule.endRow) return false;
      return currentRow % n === 0;
    }

    case 'every_n_from': {
      const start = rule.startRow;
      const n = rule.everyNRows;
      if (!isPositiveRow(start) || !isPositiveRow(n)) return false;
      if (currentRow < start) return false;
      if (rule.endRow != null && currentRow > rule.endRow) return false;
      return (currentRow - start) % n === 0;
    }

    case 'list':
      return Array.isArray(rule.listRows) &&
        rule.listRows.some((row) => isPositiveRow(row) && row === currentRow);

    default:
      return false;
  }
}

/** All rules due at the current row. */
export function getDueRowRules(rules: RowRule[], currentRow: number): RuleMatch[] {
  return rules
    .filter((rule) => isRuleDueAtRow(rule, currentRow))
    .map((rule) => ({ rule, currentRow }));
}

/** Next future occurrence for a single rule after currentRow (exclusive of current if not due). */
export function getNextOccurrenceForRule(
  rule: RowRule,
  currentRow: number
): number | null {
  if (
    !rule.isActive ||
    !Number.isSafeInteger(currentRow) ||
    currentRow < 0 ||
    !hasValidEndRow(rule)
  ) return null;

  switch (rule.ruleType) {
    case 'exact': {
      const row = rule.exactRow;
      if (!isPositiveRow(row) || row <= currentRow) return null;
      return row;
    }

    case 'every_n': {
      const n = rule.everyNRows;
      if (!isPositiveRow(n)) return null;
      if (currentRow < n) return n;
      const remainder = currentRow % n;
      const candidate = remainder === 0 ? currentRow + n : currentRow + (n - remainder);
      if (!isPositiveRow(candidate)) return null;
      if (rule.endRow != null && candidate > rule.endRow) return null;
      return candidate;
    }

    case 'every_n_from': {
      const start = rule.startRow;
      const n = rule.everyNRows;
      if (!isPositiveRow(start) || !isPositiveRow(n)) return null;
      if (currentRow < start) return start;
      const offset = currentRow - start;
      const remainder = offset % n;
      const candidate =
        remainder === 0 && isRuleDueAtRow(rule, currentRow)
          ? currentRow + n
          : currentRow + (remainder === 0 ? n : n - remainder);
      if (!isPositiveRow(candidate)) return null;
      if (rule.endRow != null && candidate > rule.endRow) return null;
      return candidate;
    }

    case 'list': {
      if (!Array.isArray(rule.listRows)) return null;
      let next: number | null = null;
      for (const row of rule.listRows) {
        if (isPositiveRow(row) && row > currentRow && (next == null || row < next)) {
          next = row;
        }
      }
      return next;
    }

    default:
      return null;
  }
}

/** Nearest upcoming rule across all active rules. */
export function getNextRuleOccurrence(
  rules: RowRule[],
  currentRow: number
): NextRuleMatch | null {
  let best: NextRuleMatch | null = null;

  for (const rule of rules) {
    if (!rule.isActive) continue;
    const dueAtRow = getNextOccurrenceForRule(rule, currentRow);
    if (dueAtRow == null) continue;
    const rowsUntil = dueAtRow - currentRow;
    if (rowsUntil <= 0) continue;
    if (!best || dueAtRow < best.dueAtRow) {
      best = { rule, dueAtRow, rowsUntil };
    }
  }

  return best;
}

/** Format next-action hint in Russian. */
export function formatNextRuleHint(match: NextRuleMatch): string {
  const { rule, dueAtRow, rowsUntil } = match;
  if (rowsUntil === 1) {
    return `На следующем ряду — ${rule.instruction}`;
  }
  if (rowsUntil <= 5) {
    return `Через ${rowsUntil} ряда — ${rule.instruction}`;
  }
  return `На ${dueAtRow}-м ряду — ${rule.instruction}`;
}
