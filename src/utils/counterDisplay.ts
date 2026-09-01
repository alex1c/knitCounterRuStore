/**
 * Counter display helpers for knitting screen and cards.
 */

import type { Counter } from '@/domain/types';

/** Repeat position derived from current value (1-based within cycle). */
export function getRepeatPosition(counter: Counter): number | null {
  if (counter.repeatLength == null || counter.repeatLength <= 0) {
    return null;
  }
  return (counter.currentValue % counter.repeatLength) + 1;
}

/** Progress text like "126 / 198" when target is set. */
export function formatCounterProgress(counter: Counter): string | null {
  if (counter.targetValue == null) {
    return null;
  }
  return `${counter.currentValue} / ${counter.targetValue}`;
}

/** Repeat text like "6 / 8" when repeat_length is set. */
export function formatRepeatProgress(counter: Counter): string | null {
  const position = getRepeatPosition(counter);
  if (position == null || counter.repeatLength == null) {
    return null;
  }
  return `${position} / ${counter.repeatLength}`;
}
