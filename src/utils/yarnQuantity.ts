/**
 * Yarn quantity helpers — milliskeins storage (1 skein = 1000 units).
 *
 * Inventory model:
 * - yarns.quantity_milliskeins = physical stock on hand (source of truth)
 * - project_yarns.used_quantity_milliskeins = cumulative usage per project link
 * - Recording usage decrements inventory and increments project used atomically
 */

/** One full skein in normalized storage units. */
export const MILLISKEINS_PER_SKEIN = 1000;

/** Converts fractional skeins to integer milliskeins (rounded to nearest). */
export function skeinsToMilliskeins(skeins: number): number {
  if (!Number.isFinite(skeins) || skeins < 0) {
    throw new Error('skeins must be a non-negative finite number');
  }
  return Math.round(skeins * MILLISKEINS_PER_SKEIN);
}

/** Converts milliskeins back to fractional skeins. */
export function milliskeinsToSkeins(milliskeins: number): number {
  return milliskeins / MILLISKEINS_PER_SKEIN;
}

/** Russian display for skein quantity, e.g. "4,3 мотка". */
export function formatSkeinQuantity(milliskeins: number): string {
  const skeins = milliskeinsToSkeins(milliskeins);
  const formatted = skeins.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  const intPart = Math.floor(skeins);
  const frac = skeins - intPart;
  let word = 'мотков';
  if (frac > 0.05) {
    word = 'мотка';
  } else {
    const mod10 = intPart % 10;
    const mod100 = intPart % 100;
    if (mod10 === 1 && mod100 !== 11) word = 'моток';
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
      word = 'мотка';
    }
  }
  return `${formatted} ${word}`;
}

/** Approximate total weight from quantity and per-skein weight. */
export function calcTotalWeightG(
  quantityMilliskeins: number,
  weightPerSkeinG: number | null
): number | null {
  if (weightPerSkeinG == null || weightPerSkeinG <= 0) return null;
  return Math.round(
    (quantityMilliskeins / MILLISKEINS_PER_SKEIN) * weightPerSkeinG
  );
}

/** Approximate total length from quantity and per-skein length. */
export function calcTotalLengthM(
  quantityMilliskeins: number,
  lengthPerSkeinM: number | null
): number | null {
  if (lengthPerSkeinM == null || lengthPerSkeinM <= 0) return null;
  return Math.round(
    (quantityMilliskeins / MILLISKEINS_PER_SKEIN) * lengthPerSkeinM
  );
}

/** Inventory value in minor currency units (kopecks). */
export function calcInventoryValueMinor(
  quantityMilliskeins: number,
  pricePerSkeinMinor: number | null
): number | null {
  if (pricePerSkeinMinor == null || pricePerSkeinMinor < 0) return null;
  return Math.round(
    (quantityMilliskeins / MILLISKEINS_PER_SKEIN) * pricePerSkeinMinor
  );
}

/** Formats minor currency units as rubles with comma decimal. */
export function formatMoneyMinor(minor: number, currency = 'RUB'): string {
  if (currency === 'RUB') {
    const rubles = minor / 100;
    return `${rubles.toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} ₽`;
  }
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

/** Parses ruble price string to minor units (kopecks). */
export function parsePriceToMinor(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const normalized = trimmed.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid price: ${input}`);
  }
  const rubles = Number(normalized);
  if (!Number.isFinite(rubles) || rubles < 0) {
    throw new Error(`Invalid price: ${input}`);
  }
  return Math.round(rubles * 100);
}
