/**
 * Counter display helpers for knitting screen and cards.
 *
 * Pattern position semantics (current_value = N means user is ON row N):
 * position = ((N - startValue - 1) % repeatLength) + 1  when N > startValue
 */

import type { Counter } from '@/domain/types';

/** 1-based position within a repeating pattern. */
export function getPatternPosition(
  rowValue: number,
  startValue: number,
  repeatLength: number
): number {
  if (repeatLength <= 0) return 1;
  if (rowValue <= startValue) return 1;
  const relative = rowValue - startValue;
  return ((relative - 1) % repeatLength) + 1;
}

/** Repeat position for a standalone counter. */
export function getRepeatPosition(counter: Counter): number | null {
  if (counter.repeatLength == null || counter.repeatLength <= 0) {
    return null;
  }
  return getPatternPosition(
    counter.currentValue,
    counter.startValue,
    counter.repeatLength
  );
}

/** Derived linked counter display from parent row counter. */
export function getLinkedPatternPosition(
  parent: Counter,
  linked: Counter
): number | null {
  if (
    linked.linkType !== 'follow_main' ||
    linked.parentCounterId !== parent.id ||
    linked.repeatLength == null ||
    parent.currentValue <= parent.startValue
  ) {
    return null;
  }
  return getPatternPosition(
    parent.currentValue,
    parent.startValue,
    linked.repeatLength
  );
}

/** Progress text like "126 / 198" when target is set. */
export function formatCounterProgress(counter: Counter): string | null {
  if (counter.targetValue == null) {
    return null;
  }
  return `${counter.currentValue} / ${counter.targetValue}`;
}

/** Repeat text like "6 / 8" for standalone counter. */
export function formatRepeatProgress(counter: Counter): string | null {
  const position = getRepeatPosition(counter);
  if (position == null || counter.repeatLength == null) {
    return null;
  }
  return `${position} / ${counter.repeatLength}`;
}

/** Linked pattern line e.g. "Узор 2 / 12". */
export function formatLinkedRepeatProgress(
  parent: Counter,
  linked: Counter
): string | null {
  const position = getLinkedPatternPosition(parent, linked);
  if (position == null || linked.repeatLength == null) {
    return null;
  }
  return `${linked.name} ${position} / ${linked.repeatLength}`;
}

/** Whether counter value is derived from parent (not manually incremented). */
export function isLinkedCounter(counter: Counter): boolean {
  return counter.linkType === 'follow_main' && counter.parentCounterId != null;
}
