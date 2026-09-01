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

/** Returns true when rule is due at currentRow. */
export function isRuleDueAtRow(rule: RowRule, currentRow: number): boolean {
  if (!rule.isActive || currentRow <= 0) {
    return false;
  }

  switch (rule.ruleType) {
    case 'exact':
      return rule.exactRow === currentRow;

    case 'every_n': {
      const n = rule.everyNRows;
      if (n == null || n <= 0) return false;
      if (currentRow < n) return false;
      if (rule.endRow != null && currentRow > rule.endRow) return false;
      return currentRow % n === 0;
    }

    case 'every_n_from': {
      const start = rule.startRow;
      const n = rule.everyNRows;
      if (start == null || n == null || start <= 0 || n <= 0) return false;
      if (currentRow < start) return false;
      if (rule.endRow != null && currentRow > rule.endRow) return false;
      return (currentRow - start) % n === 0;
    }

    case 'list':
      return rule.listRows.includes(currentRow);

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
  if (!rule.isActive) return null;

  switch (rule.ruleType) {
    case 'exact': {
      const row = rule.exactRow;
      if (row == null || row <= currentRow) return null;
      return row;
    }

    case 'every_n': {
      const n = rule.everyNRows;
      if (n == null || n <= 0) return null;
      if (currentRow < n) return n;
      const remainder = currentRow % n;
      const candidate = remainder === 0 ? currentRow + n : currentRow + (n - remainder);
      if (rule.endRow != null && candidate > rule.endRow) return null;
      return candidate;
    }

    case 'every_n_from': {
      const start = rule.startRow;
      const n = rule.everyNRows;
      if (start == null || n == null) return null;
      if (currentRow < start) return start;
      const offset = currentRow - start;
      const remainder = offset % n;
      const candidate =
        remainder === 0 && isRuleDueAtRow(rule, currentRow)
          ? currentRow + n
          : currentRow + (remainder === 0 ? n : n - remainder);
      if (rule.endRow != null && candidate > rule.endRow) return null;
      return candidate;
    }

    case 'list': {
      const next = rule.listRows.find((row) => row > currentRow);
      return next ?? null;
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
