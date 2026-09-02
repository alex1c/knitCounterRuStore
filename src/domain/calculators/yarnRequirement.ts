/**
 * Yarn requirement — grams or meters modes with reserve and ceil skein purchase.
 */

import {
  applyReservePercent,
  ceilSkeins,
  formatGrams,
  formatMeters,
  formatSkeinPurchase,
} from './rounding';
import type { CalculatorResult } from './types';
import { requireFiniteResult, requireNonNegative, requirePositive } from './validation';

export type YarnFromGramsInput = {
  mode: 'grams';
  requiredGrams: number;
  weightPerSkeinG: number;
  lengthPerSkeinM?: number;
  reservePercent?: number;
  pricePerSkeinMinor?: number;
};

export type YarnFromMetersInput = {
  mode: 'meters';
  requiredMeters: number;
  metersPerSkein: number;
  weightPerSkeinG?: number;
  reservePercent?: number;
  pricePerSkeinMinor?: number;
};

export type YarnRequirementInput = YarnFromGramsInput | YarnFromMetersInput;

export type YarnRequirementResult = {
  withReserveGrams: number | null;
  withReserveMeters: number | null;
  skeinsToBuy: number;
  totalCostMinor: number | null;
};

export function calculateYarnRequirement(
  input: YarnRequirementInput
): CalculatorResult<YarnRequirementResult> {
  const reserve = requireNonNegative(input.reservePercent ?? 10, 'Запас');

  if (input.mode === 'grams') {
    const required = requireNonNegative(input.requiredGrams, 'Нужный вес');
    const weight = requirePositive(input.weightPerSkeinG, 'Вес мотка');
    const withReserve = requireFiniteResult(applyReservePercent(required, reserve));
    const skeins = ceilSkeins(withReserve / weight);
    const withReserveMeters =
      input.lengthPerSkeinM != null
        ? (withReserve / weight) * input.lengthPerSkeinM
        : null;

    const explanation = [
      `${formatGrams(required)} × ${1 + reserve / 100} = ${formatGrams(withReserve)}`,
      `${formatGrams(withReserve)} / ${formatGrams(weight)} = ${(withReserve / weight).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`,
      `Покупаем целыми мотками → ${formatSkeinPurchase(skeins)}`,
    ];

    const costMinor = calculateCostMinor(skeins, input.pricePerSkeinMinor);
    if (costMinor != null) {
      explanation.push(`Стоимость: ${(costMinor / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽`);
    }

    return {
      value: {
        withReserveGrams: withReserve,
        withReserveMeters,
        skeinsToBuy: skeins,
        totalCostMinor: costMinor,
      },
      explanation,
    };
  }

  const requiredM = requireNonNegative(input.requiredMeters, 'Нужная длина');
  const metersPerSkein = requirePositive(input.metersPerSkein, 'Метраж мотка');
  const withReserveM = requireFiniteResult(applyReservePercent(requiredM, reserve));
  const skeins = ceilSkeins(withReserveM / metersPerSkein);

  const explanation = [
    `${formatMeters(requiredM)} × ${1 + reserve / 100} = ${formatMeters(withReserveM)}`,
    `${formatMeters(withReserveM)} / ${formatMeters(metersPerSkein)} = ${(withReserveM / metersPerSkein).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`,
    `Покупаем целыми мотками → ${formatSkeinPurchase(skeins)}`,
  ];

  const costMinor = calculateCostMinor(skeins, input.pricePerSkeinMinor);

  return {
    value: {
      withReserveGrams: null,
      withReserveMeters: withReserveM,
      skeinsToBuy: skeins,
      totalCostMinor: costMinor,
    },
    explanation,
  };
}

function calculateCostMinor(skeins: number, priceMinor: number | undefined): number | null {
  if (priceMinor == null) return null;
  if (!Number.isSafeInteger(priceMinor) || priceMinor < 0) {
    throw new Error('Цена должна быть неотрицательным целым количеством копеек');
  }
  const total = skeins * priceMinor;
  if (!Number.isSafeInteger(total)) throw new Error('Стоимость слишком велика');
  return total;
}
