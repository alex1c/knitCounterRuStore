/**
 * Yarn substitution — length-based replacement skein calculation.
 */

import {
  applyReservePercent,
  ceilSkeins,
  formatMeters,
  formatSkeinPurchase,
} from './rounding';
import type { CalculatorResult } from './types';
import { requireFiniteResult, requireNonNegative, requirePositive } from './validation';

export type YarnSubstitutionInput = {
  originalSkeinCount?: number;
  originalMetersPerSkein?: number;
  totalRequiredMeters?: number;
  replacementMetersPerSkein: number;
  replacementWeightPerSkeinG?: number;
  reservePercent?: number;
  replacementPricePerSkeinMinor?: number;
};

export type YarnSubstitutionResult = {
  requiredMeters: number;
  withReserveMeters: number;
  skeinsToBuy: number;
  estimatedWeightG: number | null;
  totalCostMinor: number | null;
};

export function calculateYarnSubstitution(
  input: YarnSubstitutionInput
): CalculatorResult<YarnSubstitutionResult> {
  const replacementM = requirePositive(
    input.replacementMetersPerSkein,
    'Метраж новой пряжи'
  );
  const reserve = requireNonNegative(input.reservePercent ?? 10, 'Запас');

  let requiredM: number;
  if (input.totalRequiredMeters != null) {
    requiredM = requireNonNegative(input.totalRequiredMeters, 'Нужная длина');
  } else if (
    input.originalSkeinCount != null &&
    input.originalMetersPerSkein != null
  ) {
    const count = requireNonNegative(input.originalSkeinCount, 'Мотки по описанию');
    const origM = requirePositive(input.originalMetersPerSkein, 'Метраж мотка');
    requiredM = requireFiniteResult(count * origM);
  } else {
    throw new Error('Provide totalRequiredMeters or original skein count + meters');
  }

  const withReserve = requireFiniteResult(applyReservePercent(requiredM, reserve));
  const skeins = ceilSkeins(withReserve / replacementM);

  const explanation: string[] = [];
  if (input.originalSkeinCount != null && input.originalMetersPerSkein != null) {
    explanation.push(
      `${input.originalSkeinCount} × ${formatMeters(input.originalMetersPerSkein)} = ${formatMeters(requiredM)}`
    );
  } else {
    explanation.push(`По описанию нужно: ${formatMeters(requiredM)}`);
  }
  explanation.push(`С запасом ${reserve}%: ${formatMeters(withReserve)}`);
  explanation.push(`Новая пряжа: ${formatMeters(replacementM)}/моток`);
  explanation.push(`Нужно купить: ${formatSkeinPurchase(skeins)}`);

  let estimatedWeight: number | null = null;
  if (input.replacementWeightPerSkeinG != null && input.replacementWeightPerSkeinG > 0) {
    estimatedWeight = skeins * input.replacementWeightPerSkeinG;
    explanation.push(
      `Примерный вес: ${estimatedWeight} г (не заменяет расчёт по метражу)`
    );
  }

  let costMinor: number | null = null;
  if (input.replacementPricePerSkeinMinor != null) {
    const price = input.replacementPricePerSkeinMinor;
    if (!Number.isSafeInteger(price) || price < 0) {
      throw new Error('Цена должна быть неотрицательным целым количеством копеек');
    }
    costMinor = skeins * price;
    if (!Number.isSafeInteger(costMinor)) throw new Error('Стоимость слишком велика');
  }

  return {
    value: {
      requiredMeters: requiredM,
      withReserveMeters: withReserve,
      skeinsToBuy: skeins,
      estimatedWeightG: estimatedWeight,
      totalCostMinor: costMinor,
    },
    explanation,
  };
}
