/**
 * Gauge density calculator — normalizes to stitches/rows per 10 cm.
 */

import { formatGaugePer10 } from './rounding';
import type { CalculatorResult } from './types';
import { requirePositive } from './validation';

export type GaugeInput = {
  sampleWidthCm: number;
  sampleHeightCm: number;
  stitchesCounted: number;
  rowsCounted: number;
};

export type GaugeResult = {
  stitchesPer10Cm: number;
  rowsPer10Cm: number;
  stitchesPerCm: number;
  rowsPerCm: number;
};

export function calculateGauge(input: GaugeInput): CalculatorResult<GaugeResult> {
  const width = requirePositive(input.sampleWidthCm, 'Ширина образца');
  const height = requirePositive(input.sampleHeightCm, 'Высота образца');
  const stitches = requirePositive(input.stitchesCounted, 'Петли');
  const rows = requirePositive(input.rowsCounted, 'Ряды');

  const stitchesPerCm = stitches / width;
  const rowsPerCm = rows / height;
  const stitchesPer10 = stitchesPerCm * 10;
  const rowsPer10 = rowsPerCm * 10;

  const explanation: string[] = [
    `${stitches} петель / ${width.toLocaleString('ru-RU')} см × 10 = ${formatGaugePer10(stitchesPer10, 'петель')}`,
    `${rows} рядов / ${height.toLocaleString('ru-RU')} см × 10 = ${formatGaugePer10(rowsPer10, 'рядов')}`,
  ];

  return {
    value: {
      stitchesPer10Cm: stitchesPer10,
      rowsPer10Cm: rowsPer10,
      stitchesPerCm,
      rowsPerCm,
    },
    explanation,
  };
}
