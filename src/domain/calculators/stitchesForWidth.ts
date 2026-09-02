/**
 * Stitches for width calculator.
 *
 * Formula: desiredWidth × gaugeStitches / gaugeWidth
 * Repeat applies to body; edge stitches added after.
 */

import { adjustForPatternRepeat } from './repeatAdjust';
import { formatCm, roundToNearestInt } from './rounding';
import type { CalculatorResult } from './types';
import { requireFiniteResult, requirePositive } from './validation';

export type StitchesForWidthInput = {
  gaugeStitches: number;
  gaugeWidthCm: number;
  desiredWidthCm: number;
  edgeStitches?: number;
  repeatSize?: number;
  repeatFixed?: number;
};

export type StitchesForWidthResult = {
  theoreticalBodyStitches: number;
  recommendedBodyStitches: number;
  totalStitches: number;
  edgeStitches: number;
  repeatCandidates?: ReturnType<typeof adjustForPatternRepeat>['candidates'];
};

export function calculateStitchesForWidth(
  input: StitchesForWidthInput
): CalculatorResult<StitchesForWidthResult> {
  const gaugeStitches = requirePositive(input.gaugeStitches, 'Петли в образце');
  const gaugeWidth = requirePositive(input.gaugeWidthCm, 'Ширина образца');
  const desiredWidth = requirePositive(input.desiredWidthCm, 'Нужная ширина');
  const edge = input.edgeStitches ?? 0;
  if (!Number.isInteger(edge) || edge < 0) {
    throw new Error('edgeStitches must be a non-negative integer');
  }

  const raw = requireFiniteResult(desiredWidth * gaugeStitches / gaugeWidth);
  const theoreticalBody = raw;
  const roundedBody = roundToNearestInt(raw);

  const explanation: string[] = [
    `${gaugeStitches} петель / ${formatCm(gaugeWidth)} = ${formatNumberRu(gaugeStitches / gaugeWidth, 2)} пет/см`,
    `${formatCm(desiredWidth)} × ${formatNumberRu(gaugeStitches / gaugeWidth, 2)} = ${formatNumberRu(theoreticalBody, 2)} петли (теоретически)`,
  ];

  let recommendedBody = roundedBody;
  let repeatCandidates: StitchesForWidthResult['repeatCandidates'];

  if (input.repeatSize != null) {
    const repeat = adjustForPatternRepeat({
      rawBodyCount: theoreticalBody,
      repeatSize: input.repeatSize,
      fixedOffset: input.repeatFixed ?? 0,
      bodyCountToCm: (body) => (body * gaugeWidth) / gaugeStitches,
    });
    recommendedBody = repeat.recommendedCount;
    repeatCandidates = repeat.candidates;
    explanation.push(...repeat.explanation);
  } else {
    explanation.push(`Рекомендуемое целое значение: ${roundedBody} петель (округление до ближайшего)`);
  }

  const total = recommendedBody + edge;
  if (edge > 0) {
    explanation.push(`${recommendedBody} петель по плотности + ${edge} кромочные = ${total}`);
  }

  return {
    value: {
      theoreticalBodyStitches: theoreticalBody,
      recommendedBodyStitches: recommendedBody,
      totalStitches: total,
      edgeStitches: edge,
      repeatCandidates,
    },
    explanation,
  };
}

function formatNumberRu(value: number, digits: number): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}
