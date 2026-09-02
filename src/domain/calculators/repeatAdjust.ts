/**
 * Pattern repeat adjustment for body stitch/row counts.
 *
 * Convention: repeat applies to body fabric only; edge stitches are added afterward.
 * Valid body count = repeat × n + fixedOffset (n ≥ 0, result > 0).
 */

import type { RepeatCandidate } from './types';
import { requirePositiveInt } from './validation';

export type RepeatAdjustInput = {
  rawBodyCount: number;
  repeatSize: number;
  fixedOffset?: number;
  /** Converts body stitch count to width cm (for candidate display). */
  bodyCountToCm?: (bodyCount: number) => number;
};

export type RepeatAdjustResult = {
  rawBodyCount: number;
  candidates: RepeatCandidate[];
  recommendedCount: number;
  explanation: string[];
};

/** Finds nearest valid repeat counts around raw body value. */
export function adjustForPatternRepeat(input: RepeatAdjustInput): RepeatAdjustResult {
  const repeat = requirePositiveInt(input.repeatSize, 'Раппорт');
  const fixed = input.fixedOffset ?? 0;
  if (!Number.isInteger(fixed) || fixed < 0) {
    throw new Error('fixedOffset must be a non-negative integer');
  }

  const raw = Math.round(input.rawBodyCount);
  const explanation: string[] = [];

  if (repeat === 1 && fixed === 0) {
    return {
      rawBodyCount: raw,
      candidates: [{
        count: raw,
        dimensionCm: input.bodyCountToCm?.(raw) ?? null,
        isClosest: true,
      }],
      recommendedCount: raw,
      explanation: [`По плотности: ${raw}`],
    };
  }

  const lowerN = Math.floor((raw - fixed) / repeat);
  const upperN = lowerN + 1;

  const validCounts = new Set<number>();
  for (const n of [lowerN - 1, lowerN, upperN, upperN + 1]) {
    if (n < 0) continue;
    const count = n * repeat + fixed;
    if (count > 0) validCounts.add(count);
  }

  const sorted = [...validCounts].sort((a, b) => a - b);
  const candidates: RepeatCandidate[] = sorted.map((count) => {
    const dist = Math.abs(count - raw);
    return {
      count,
      dimensionCm: input.bodyCountToCm?.(count) ?? null,
      isClosest: false,
      _dist: dist,
    } as RepeatCandidate & { _dist: number };
  });

  if (candidates.length === 0) {
    return {
      rawBodyCount: raw,
      candidates: [],
      recommendedCount: raw,
      explanation: [`По плотности: ${raw}`],
    };
  }

  const minDist = Math.min(...candidates.map((c) => (c as RepeatCandidate & { _dist: number })._dist));
  let closest = candidates.filter((c) => (c as RepeatCandidate & { _dist: number })._dist === minDist);
  if (closest.length > 1) {
    closest = [closest.reduce((best, c) => (c.count >= raw ? c : best))];
  }
  closest[0].isClosest = true;
  const recommendedCount = closest[0].count;

  explanation.push(`По плотности: ${raw}`);
  if (fixed > 0) {
    explanation.push(`Раппорт: кратно ${repeat} + ${fixed}`);
  } else {
    explanation.push(`Раппорт: кратно ${repeat}`);
  }

  for (const c of candidates) {
    const widthPart = c.dimensionCm != null ? ` (${c.dimensionCm.toFixed(1)} см)` : '';
    const mark = c.isClosest ? ' ← ближе всего' : '';
    explanation.push(`Вариант: ${c.count}${widthPart}${mark}`);
  }

  return {
    rawBodyCount: raw,
    candidates: candidates.map(({ count, dimensionCm, isClosest }) => ({
      count,
      dimensionCm,
      isClosest,
    })),
    recommendedCount,
    explanation,
  };
}
