/**
 * Centralized rounding and formatting for knitting calculators.
 */

import { formatNumberRu } from '@/utils/numeric';

/** Round to nearest integer for stitch/row theoretical counts. */
export function roundToNearestInt(value: number): number {
  return Math.round(value);
}

/** Always round skein purchase counts up. */
export function ceilSkeins(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const nearestInteger = Math.round(value);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(value)) * 16;
  return Math.abs(value - nearestInteger) <= tolerance
    ? nearestInteger
    : Math.ceil(value);
}

/** Apply reserve percentage (e.g. 10 → 10%). */
export function applyReservePercent(value: number, reservePercent: number): number {
  return value * (1 + reservePercent / 100);
}

/** Format cm with up to 1 decimal. */
export function formatCm(value: number): string {
  return `${formatNumberRu(value, 1)} см`;
}

/** Format gauge per 10 cm. */
export function formatGaugePer10(value: number, unit: 'петель' | 'petель' | 'рядов'): string {
  const label = unit === 'рядов' ? 'рядов' : 'петель';
  return `${formatNumberRu(value, 2)} ${label} / 10 см`;
}

/** Format grams. */
export function formatGrams(value: number): string {
  return `${formatNumberRu(Math.round(value), 0)} г`;
}

/** Format meters. */
export function formatMeters(value: number): string {
  return `${formatNumberRu(value, 0)} м`;
}

/** Format fractional skeins for estimates. */
export function formatSkeinEstimate(value: number): string {
  return `${formatNumberRu(value, 1)} мотка`;
}

/** Format integer skein purchase count. */
export function formatSkeinPurchase(count: number): string {
  return `${count} ${skeinWord(count)}`;
}

function skeinWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'моток';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'мотка';
  return 'мотков';
}
