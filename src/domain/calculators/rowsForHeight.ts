/**
 * Rows for height calculator.
 */

import { adjustForPatternRepeat } from './repeatAdjust';
import { formatCm, roundToNearestInt } from './rounding';
import type { CalculatorResult } from './types';
import { requirePositive } from './validation';

export type RowsForHeightInput = {
  gaugeRows: number;
  gaugeHeightCm: number;
  desiredHeightCm: number;
  rowRepeatSize?: number;
};

export function calculateRowsForHeight(
  input: RowsForHeightInput
): CalculatorResult<{ theoreticalRows: number; recommendedRows: number }> {
  const gaugeRows = requirePositive(input.gaugeRows, 'Ряды в образце');
  const gaugeHeight = requirePositive(input.gaugeHeightCm, 'Высота образца');
  const desiredHeight = requirePositive(input.desiredHeightCm, 'Нужная высота');

  const raw = desiredHeight * gaugeRows / gaugeHeight;
  const theoretical = roundToNearestInt(raw);

  const explanation: string[] = [
    `${gaugeRows} рядов / ${formatCm(gaugeHeight)} = ${(gaugeRows / gaugeHeight).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ряд/см`,
    `${formatCm(desiredHeight)} × ${(gaugeRows / gaugeHeight).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} = ${theoretical} рядов`,
  ];

  let recommended = theoretical;
  if (input.rowRepeatSize != null && input.rowRepeatSize > 0) {
    const repeat = adjustForPatternRepeat({
      rawBodyCount: theoretical,
      repeatSize: input.rowRepeatSize,
      fixedOffset: 0,
      bodyCountToCm: (rows) => (rows * gaugeHeight) / gaugeRows,
    });
    recommended = repeat.recommendedCount;
    explanation.push(...repeat.explanation);
  } else {
    explanation.push(`Расчётное значение: ${theoretical} рядов`);
  }

  return {
    value: { theoreticalRows: theoretical, recommendedRows: recommended },
    explanation,
  };
}
