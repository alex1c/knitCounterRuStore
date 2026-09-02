/**
 * Even distribution of increases/decreases across a row.
 *
 * Spreads `actionCount` actions across `stitchCount` stitches so gap sizes
 * differ by at most 1 (Bresenham-style integer distribution).
 */

import type { CalculatorResult } from './types';
import { requirePositiveInt } from './validation';

export type DistributionSegment = {
  interval: number;
  count: number;
};

export type DistributeChangesInput = {
  currentStitches: number;
  targetStitches: number;
};

export type DistributeChangesResult = {
  actionCount: number;
  isIncrease: boolean;
  segments: DistributionSegment[];
  instruction: string;
  warning: string | null;
};

export function distributeIncreasesDecreases(
  input: DistributeChangesInput
): CalculatorResult<DistributeChangesResult> {
  const current = requirePositiveInt(input.currentStitches, 'Текущие петли');
  const target = requirePositiveInt(input.targetStitches, 'Нужные петли');

  if (current === target) {
    return {
      value: {
        actionCount: 0,
        isIncrease: false,
        segments: [],
        instruction: 'Изменения не нужны',
        warning: null,
      },
      explanation: ['Текущее и нужное количество совпадают'],
    };
  }

  const isIncrease = target > current;
  const actionCount = Math.abs(target - current);
  let warning: string | null = null;

  if (actionCount > current) {
    warning =
      'Слишком много изменений для равномерного распределения в одном ряду. Рассмотрите несколько рядов.';
  }

  const segments = buildSegments(current, actionCount);
  const verb = isIncrease ? 'Прибавить' : 'Убавить';
  const instruction = formatInstruction(verb, actionCount, segments);

  const explanation: string[] = [
    `${current} → ${target}: ${isIncrease ? '+' : '−'}${actionCount} петель`,
    instruction,
  ];
  if (warning) explanation.push(warning);

  return {
    value: {
      actionCount,
      isIncrease,
      segments,
      instruction,
      warning,
    },
    explanation,
  };
}

function buildSegments(stitchCount: number, actionCount: number): DistributionSegment[] {
  if (actionCount === 0) return [];

  const base = Math.floor(stitchCount / actionCount);
  const remainder = stitchCount % actionCount;

  const segments: DistributionSegment[] = [];
  const addSegment = (interval: number, count: number) => {
    const existing = segments.find((s) => s.interval === interval);
    if (existing) existing.count += count;
    else segments.push({ interval, count });
  };

  if (remainder > 0) {
    addSegment(base + 1, remainder);
  }
  if (actionCount - remainder > 0) {
    addSegment(base, actionCount - remainder);
  }

  return segments.sort((a, b) => b.interval - a.interval);
}

function formatInstruction(
  verb: string,
  actionCount: number,
  segments: DistributionSegment[]
): string {
  if (actionCount === 0) return 'Изменения не нужны';
  if (segments.length === 0) {
    return `${verb} ${actionCount} петель примерно равномерно по ряду`;
  }

  const parts = segments.map(
    (s) => `${s.count} раз через ${s.interval} ${petleyWord(s.interval)}`
  );
  return `${verb} ${actionCount} петель: ${parts.join(' и ')}`;
}

function petleyWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'петлю';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'петли';
  return 'петель';
}

/** Validates target >= 1 for stitch counts. */
export function validateStitchTargets(current: number, target: number): void {
  requirePositiveInt(current, 'Текущие петли');
  requirePositiveInt(target, 'Нужные петли');
}
