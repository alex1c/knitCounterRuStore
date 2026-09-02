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
import { requireFiniteResult, requireNonNegative, requirePositive, CalculatorValidationError } from './validation';

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
  if (!Number.isSafeInteger(stock)) {
    throw new CalculatorValidationError('Остаток должен быть целым количеством тысячных мотка');
  }
  const reserve = requireNonNegative(input.reservePercent ?? 0, 'Запас');
  const weightMetadata = input.weightPerSkeinG == null
    ? null
    : requirePositive(input.weightPerSkeinG, 'Вес мотка');
  const lengthMetadata = input.lengthPerSkeinM == null
    ? null
    : requirePositive(input.lengthPerSkeinM, 'Метраж мотка');

  const suppliedModes = [
    input.requiredMilliskeins,
    input.requiredGrams,
    input.requiredMeters,
  ].filter((value) => value != null).length;
  if (suppliedModes !== 1) {
    throw new CalculatorValidationError('Укажите нужное количество ровно в одной единице');
  }

  let requiredMs: number;
  const explanation: string[] = [];

  if (input.requiredMilliskeins != null) {
    const required = requireNonNegative(input.requiredMilliskeins, 'Нужное количество');
    if (!Number.isSafeInteger(required)) {
      throw new CalculatorValidationError('Количество должно быть целым числом тысячных мотка');
    }
    requiredMs = Math.round(requireFiniteResult(applyReservePercent(required, reserve)));
    explanation.push(
      `Нужно: ${formatSkeins(input.requiredMilliskeins)} × ${1 + reserve / 100} = ${formatSkeins(requiredMs)}`
    );
  } else if (input.requiredGrams != null) {
    const requiredGrams = requireNonNegative(input.requiredGrams, 'Нужный вес');
    const weightValue = weightMetadata;
    if (weightValue == null) {
      throw new CalculatorValidationError(
        'Укажите вес мотка для расчёта по граммам'
      );
    }
    const weight = requirePositive(weightValue, 'Вес мотка');
    const withReserve = applyReservePercent(requiredGrams, reserve);
    const skeins = withReserve / weight;
    requiredMs = Math.round(requireFiniteResult(skeins * MILLISKEINS_PER_SKEIN));
    explanation.push(
      `${input.requiredGrams} г × ${1 + reserve / 100} = ${withReserve.toFixed(0)} г`,
      `≈ ${formatSkeins(requiredMs)}`
    );
  } else if (input.requiredMeters != null) {
    const requiredMeters = requireNonNegative(input.requiredMeters, 'Нужная длина');
    const lengthValue = lengthMetadata;
    if (lengthValue == null) {
      throw new CalculatorValidationError(
        'Укажите метраж мотка для расчёта по метрам'
      );
    }
    const length = requirePositive(lengthValue, 'Метраж мотка');
    const withReserve = applyReservePercent(requiredMeters, reserve);
    const skeins = withReserve / length;
    requiredMs = Math.round(requireFiniteResult(skeins * MILLISKEINS_PER_SKEIN));
    explanation.push(
      `${input.requiredMeters} м × ${1 + reserve / 100} = ${withReserve.toFixed(0)} м`,
      `≈ ${formatSkeins(requiredMs)}`
    );
  } else {
    throw new CalculatorValidationError('Укажите нужное количество');
  }

  if (!Number.isSafeInteger(requiredMs)) {
    throw new CalculatorValidationError('Нужное количество слишком велико');
  }
  const diff = stock - requiredMs;
  if (!Number.isSafeInteger(diff)) {
    throw new CalculatorValidationError('Разница количества слишком велика');
  }
  const enough = diff >= 0;

  explanation.push(`В наличии: ${formatSkeins(stock)}`);
  explanation.push(enough ? 'Хватит' : 'Не хватает');
  if (enough) {
    explanation.push(`Останется: ≈ ${formatSkeins(diff)}`);
  } else {
    explanation.push(`Не хватает: ≈ ${formatSkeins(Math.abs(diff))}`);
  }

  const weight = weightMetadata;
  const length = lengthMetadata;

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
