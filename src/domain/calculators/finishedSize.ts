/**
 * Finished size from stitch/row counts (inverse gauge calculation).
 */

import { formatCm } from './rounding';
import type { CalculatorResult } from './types';
import { requireFiniteResult, requirePositive } from './validation';

export type FinishedSizeInput = {
  stitchCount: number;
  rowCount?: number;
  gaugeStitches: number;
  gaugeRows?: number;
  gaugeWidthCm: number;
  gaugeHeightCm?: number;
};

export type FinishedSizeResult = {
  widthCm: number;
  heightCm: number | null;
};

export function calculateFinishedSize(
  input: FinishedSizeInput
): CalculatorResult<FinishedSizeResult> {
  const stitches = requirePositive(input.stitchCount, 'Количество петель');
  const gaugeStitches = requirePositive(input.gaugeStitches, 'Петли в образце');
  const gaugeWidth = requirePositive(input.gaugeWidthCm, 'Ширина образца');

  const widthCm = requireFiniteResult((stitches * gaugeWidth) / gaugeStitches);
  const explanation: string[] = [
    `${stitches} петель × ${formatCm(gaugeWidth)} / ${gaugeStitches} = ${formatCm(widthCm)}`,
  ];

  let heightCm: number | null = null;
  if (input.rowCount != null) {
    if (input.gaugeRows == null || input.gaugeHeightCm == null) {
      throw new Error('Для расчёта высоты укажите ряды и высоту образца');
    }
    const rows = requirePositive(input.rowCount, 'Количество рядов');
    const gaugeRows = requirePositive(input.gaugeRows, 'Ряды в образце');
    const gaugeHeight = requirePositive(input.gaugeHeightCm, 'Высота образца');
    heightCm = requireFiniteResult((rows * gaugeHeight) / gaugeRows);
    explanation.push(
      `${rows} рядов × ${formatCm(gaugeHeight)} / ${gaugeRows} = ${formatCm(heightCm)}`
    );
  }

  return {
    value: { widthCm, heightCm },
    explanation,
  };
}
