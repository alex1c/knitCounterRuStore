/**
 * Pure unit tests for row-rule evaluation engine.
 */

import {
  getDueRowRules,
  getNextOccurrenceForRule,
  getNextRuleOccurrence,
  isRuleDueAtRow,
} from '@/domain/rowRuleEngine';
import type { RowRule } from '@/domain/types';

function makeRule(overrides: Partial<RowRule> = {}): RowRule {
  return {
    id: 'rule-1',
    projectId: 'proj-1',
    projectPartId: null,
    counterId: 'counter-1',
    name: 'Test',
    instruction: 'Убавить 1 петлю',
    ruleType: 'exact',
    startRow: null,
    everyNRows: null,
    exactRow: 42,
    endRow: null,
    isActive: true,
    position: 0,
    listRows: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('isRuleDueAtRow — exact', () => {
  const rule = makeRule({ ruleType: 'exact', exactRow: 42 });

  test('41 is not due', () => {
    expect(isRuleDueAtRow(rule, 41)).toBe(false);
  });

  test('42 is due', () => {
    expect(isRuleDueAtRow(rule, 42)).toBe(true);
  });

  test('43 is not due', () => {
    expect(isRuleDueAtRow(rule, 43)).toBe(false);
  });
});

describe('isRuleDueAtRow — every_n (every 6)', () => {
  const rule = makeRule({
    ruleType: 'every_n',
    exactRow: null,
    everyNRows: 6,
  });

  test.each([
    [1, false],
    [5, false],
    [6, true],
    [12, true],
    [18, true],
  ])('row %i → %s', (row, expected) => {
    expect(isRuleDueAtRow(rule, row)).toBe(expected);
  });
});

describe('isRuleDueAtRow — every_n_from (start 20, every 4)', () => {
  const rule = makeRule({
    ruleType: 'every_n_from',
    startRow: 20,
    everyNRows: 4,
    exactRow: null,
  });

  test.each([
    [19, false],
    [20, true],
    [24, true],
    [28, true],
    [23, false],
  ])('row %i → %s', (row, expected) => {
    expect(isRuleDueAtRow(rule, row)).toBe(expected);
  });
});

describe('isRuleDueAtRow — list', () => {
  const rule = makeRule({
    ruleType: 'list',
    exactRow: null,
    listRows: [30, 42, 54],
  });

  test.each([
    [29, false],
    [30, true],
    [41, false],
    [42, true],
    [54, true],
    [55, false],
  ])('row %i → %s', (row, expected) => {
    expect(isRuleDueAtRow(rule, row)).toBe(expected);
  });
});

describe('getNextOccurrenceForRule', () => {
  test('every 6 from row 1 → next is 6', () => {
    const rule = makeRule({ ruleType: 'every_n', everyNRows: 6, exactRow: null });
    expect(getNextOccurrenceForRule(rule, 1)).toBe(6);
  });

  test('every 6 at row 6 → next is 12', () => {
    const rule = makeRule({ ruleType: 'every_n', everyNRows: 6, exactRow: null });
    expect(getNextOccurrenceForRule(rule, 6)).toBe(12);
  });

  test('start 20 every 4 at row 19 → next is 20', () => {
    const rule = makeRule({
      ruleType: 'every_n_from',
      startRow: 20,
      everyNRows: 4,
      exactRow: null,
    });
    expect(getNextOccurrenceForRule(rule, 19)).toBe(20);
  });

  test('start 20 every 4 at row 20 → next is 24', () => {
    const rule = makeRule({
      ruleType: 'every_n_from',
      startRow: 20,
      everyNRows: 4,
      exactRow: null,
    });
    expect(getNextOccurrenceForRule(rule, 20)).toBe(24);
  });

  test('exact at 42 from row 40 → next is 42', () => {
    const rule = makeRule({ ruleType: 'exact', exactRow: 42 });
    expect(getNextOccurrenceForRule(rule, 40)).toBe(42);
  });

  test('exact at 42 from row 42 → null', () => {
    const rule = makeRule({ ruleType: 'exact', exactRow: 42 });
    expect(getNextOccurrenceForRule(rule, 42)).toBeNull();
  });

  test('list from row 31 → next is 42', () => {
    const rule = makeRule({
      ruleType: 'list',
      exactRow: null,
      listRows: [30, 42, 54],
    });
    expect(getNextOccurrenceForRule(rule, 31)).toBe(42);
  });
});

describe('getNextRuleOccurrence', () => {
  test('picks nearest upcoming rule', () => {
    const rules = [
      makeRule({
        id: 'a',
        ruleType: 'exact',
        exactRow: 50,
        instruction: 'Далеко',
      }),
      makeRule({
        id: 'b',
        ruleType: 'every_n',
        everyNRows: 6,
        exactRow: null,
        instruction: 'Близко',
      }),
    ];
    const next = getNextRuleOccurrence(rules, 4);
    expect(next?.dueAtRow).toBe(6);
    expect(next?.rowsUntil).toBe(2);
  });
});

describe('getDueRowRules — undo/decrement semantics', () => {
  test('rule reappears when returning to due row', () => {
    const rule = makeRule({ ruleType: 'exact', exactRow: 42 });
    expect(getDueRowRules([rule], 43)).toHaveLength(0);
    expect(getDueRowRules([rule], 42)).toHaveLength(1);
    expect(getDueRowRules([rule], 41)).toHaveLength(0);
  });
});
