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
import { requireNonNegative, requirePositive } from './validation';

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
    requiredM = requirePositive(input.totalRequiredMeters, 'Нужная длина');
  } else if (
    input.originalSkeinCount != null &&
    input.originalMetersPerSkein != null
  ) {
    const count = requirePositive(input.originalSkeinCount, 'Мотки по описанию');
    const origM = requirePositive(input.originalMetersPerSkein, 'Метраж мотка');
    requiredM = count * origM;
  } else {
    throw new Error('Provide totalRequiredMeters or original skein count + meters');
  }

  const withReserve = applyReservePercent(requiredM, reserve);
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

  const costMinor =
    input.replacementPricePerSkeinMinor != null
      ? skeins * input.replacementPricePerSkeinMinor
      : null;

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
