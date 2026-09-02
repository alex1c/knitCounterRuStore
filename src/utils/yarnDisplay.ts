/**
 * Yarn display helpers for list cards and detail screens.
 */

import type { Yarn } from '@/domain/types';
import {
  calcTotalLengthM,
  calcTotalWeightG,
  formatMoneyMinor,
  formatSkeinQuantity,
} from '@/utils/yarnQuantity';

/** Primary title line: "Alize Lanagold" or just name. */
export function formatYarnTitle(yarn: Yarn): string {
  if (yarn.brand?.trim()) {
    return `${yarn.brand.trim()} ${yarn.name}`;
  }
  return yarn.name;
}

/** Color and dye lot line, e.g. "Цвет 62 · партия 1814". */
export function formatYarnColorLine(yarn: Yarn): string | null {
  const parts: string[] = [];
  if (yarn.colorName?.trim()) {
    parts.push(yarn.colorName.trim());
  } else if (yarn.colorCode?.trim()) {
    parts.push(`Цвет ${yarn.colorCode.trim()}`);
  }
  if (yarn.dyeLot?.trim()) {
    parts.push(`партия ${yarn.dyeLot.trim()}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Quantity summary with optional derived weight/length. */
export function formatYarnQuantitySummary(yarn: Yarn): string {
  const parts: string[] = [formatSkeinQuantity(yarn.quantityMilliskeins)];

  const weight = calcTotalWeightG(
    yarn.quantityMilliskeins,
    yarn.weightPerSkeinG
  );
  if (weight != null) {
    parts.push(`${weight} г`);
  }

  const length = calcTotalLengthM(
    yarn.quantityMilliskeins,
    yarn.lengthPerSkeinM
  );
  if (length != null) {
    parts.push(`~${length} м`);
  }

  return parts.join(' · ');
}

/** Price line for detail view. */
export function formatYarnPriceLine(yarn: Yarn): string | null {
  if (yarn.purchasePriceMinor == null) return null;
  return `${formatMoneyMinor(yarn.purchasePriceMinor, yarn.currency)} / моток`;
}

/** Inventory value if price is known. */
export function formatYarnInventoryValue(yarn: Yarn): string | null {
  if (yarn.purchasePriceMinor == null) return null;
  const totalMinor = Math.round(
    (yarn.quantityMilliskeins / 1000) * yarn.purchasePriceMinor
  );
  return formatMoneyMinor(totalMinor, yarn.currency);
}
