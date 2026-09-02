/**
 * Enough-yarn check — read-only inventory planning (milliskein integer math).
 */

import {
  MILLISKEINS_PER_SKEIN,
  calcTotalLengthM,
  calcTotalWeightG,
  milliskeinsToSkeins,
} from '@/utils/yarnQuantity';
import { applyReservePercent } from './rounding';
import type { CalculatorResult } from './types';
import { requireNonNegative, CalculatorValidationError } from './validation';

export type YarnAvailabilityInput = {
  /** Stock on hand in milliskeins. */
  stockMilliskeins: number;
  /** Required amount — exactly one mode must be set. */
  requiredMilliskeins?: number;
  requiredGrams?: number;
  requiredMeters?: number;
  weightPerSkeinG?: number | null;
  lengthPerSkeinM?: number | null;
  reservePercent?: number;
};

export type YarnAvailabilityResult = {
  enough: boolean;
  stockMilliskeins: number;
  requiredMilliskeins: number;
  differenceMilliskeins: number;
  stockGrams: number | null;
  requiredGrams: number | null;
  differenceGrams: number | null;
  stockMeters: number | null;
  requiredMeters: number | null;
  differenceMeters: number | null;
};

export function checkYarnAvailability(
  input: YarnAvailabilityInput
): CalculatorResult<YarnAvailabilityResult> {
  const stock = requireNonNegative(input.stockMilliskeins, 'Остаток');
  const reserve = requireNonNegative(input.reservePercent ?? 0, 'Запас');

  let requiredMs: number;
  const explanation: string[] = [];

  if (input.requiredMilliskeins != null) {
    requiredMs = Math.round(applyReservePercent(input.requiredMilliskeins, reserve));
    explanation.push(
      `Нужно: ${formatSkeins(input.requiredMilliskeins)} × ${1 + reserve / 100} = ${formatSkeins(requiredMs)}`
    );
  } else if (input.requiredGrams != null) {
    const weight = input.weightPerSkeinG;
    if (weight == null || weight <= 0) {
      throw new CalculatorValidationError(
        'Укажите вес мотка для расчёта по граммам'
      );
    }
    const withReserve = applyReservePercent(input.requiredGrams, reserve);
    const skeins = withReserve / weight;
    requiredMs = Math.round(skeins * MILLISKEINS_PER_SKEIN);
    explanation.push(
      `${input.requiredGrams} г × ${1 + reserve / 100} = ${withReserve.toFixed(0)} г`,
      `≈ ${formatSkeins(requiredMs)}`
    );
  } else if (input.requiredMeters != null) {
    const length = input.lengthPerSkeinM;
    if (length == null || length <= 0) {
      throw new CalculatorValidationError(
        'Укажите метраж мотка для расчёта по метрам'
      );
    }
    const withReserve = applyReservePercent(input.requiredMeters, reserve);
    const skeins = withReserve / length;
    requiredMs = Math.round(skeins * MILLISKEINS_PER_SKEIN);
    explanation.push(
      `${input.requiredMeters} м × ${1 + reserve / 100} = ${withReserve.toFixed(0)} м`,
      `≈ ${formatSkeins(requiredMs)}`
    );
  } else {
    throw new CalculatorValidationError('Укажите нужное количество');
  }

  const diff = stock - requiredMs;
  const enough = diff >= 0;

  explanation.push(`В наличии: ${formatSkeins(stock)}`);
  explanation.push(enough ? 'Хватит' : 'Не хватает');
  if (enough) {
    explanation.push(`Останется: ≈ ${formatSkeins(diff)}`);
  } else {
    explanation.push(`Не хватает: ≈ ${formatSkeins(Math.abs(diff))}`);
  }

  const weight = input.weightPerSkeinG ?? null;
  const length = input.lengthPerSkeinM ?? null;

  return {
    value: {
      enough,
      stockMilliskeins: stock,
      requiredMilliskeins: requiredMs,
      differenceMilliskeins: diff,
      stockGrams: calcTotalWeightG(stock, weight),
      requiredGrams:
        weight != null
          ? Math.round((requiredMs / MILLISKEINS_PER_SKEIN) * weight)
          : null,
      differenceGrams:
        weight != null
          ? (calcTotalWeightG(stock, weight) ?? 0) -
            Math.round((requiredMs / MILLISKEINS_PER_SKEIN) * weight)
          : null,
      stockMeters: calcTotalLengthM(stock, length),
      requiredMeters:
        length != null
          ? Math.round((requiredMs / MILLISKEINS_PER_SKEIN) * length)
          : null,
      differenceMeters:
        length != null
          ? (calcTotalLengthM(stock, length) ?? 0) -
            Math.round((requiredMs / MILLISKEINS_PER_SKEIN) * length)
          : null,
    },
    explanation,
  };
}

function formatSkeins(milliskeins: number): string {
  return milliskeinsToSkeins(milliskeins).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }) + ' мотка';
}
