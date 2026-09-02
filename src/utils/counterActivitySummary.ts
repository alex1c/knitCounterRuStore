/**
 * Counter event aggregation for diary timeline and session row progress.
 *
 * Uses first previous_value → last new_value per group (net change).
 * Linked/derived counters are excluded by the caller.
 */

import type { CounterEventType } from '@/domain/codes';

export type CounterEventSlice = {
  counterId: string;
  counterName: string;
  isPrimary: boolean;
  previousValue: number;
  newValue: number;
  eventType: CounterEventType;
  createdAt: string;
};

export type CounterDaySummary = {
  counterId: string;
  counterName: string;
  isPrimary: boolean;
  dateKey: string;
  startValue: number;
  endValue: number;
  netChange: number;
  hasManualSet: boolean;
  occurredAt: string;
};

/** Russian plural helper for row counts. */
export function formatRowCount(n: number): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return `${n} ряд`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${n} ряда`;
  }
  return `${n} рядов`;
}

/** Whether a day group contains a non-undo manual set (|delta| > 1 or set without inc/dec). */
function dayGroupHasManualSet(events: CounterEventSlice[]): boolean {
  const hasIncDec = events.some(
    (e) => e.eventType === 'increment' || e.eventType === 'decrement'
  );
  return events.some((e) => {
    if (e.eventType !== 'set') {
      return false;
    }
    const delta = Math.abs(e.newValue - e.previousValue);
    if (delta > 1) {
      return true;
    }
    return !hasIncDec;
  });
}

/** Groups events by counter + local date key and computes net summaries. */
export function summarizeCounterEventsByDay(
  events: CounterEventSlice[],
  dateKeyFor: (isoUtc: string) => string
): CounterDaySummary[] {
  const groups = new Map<string, CounterEventSlice[]>();

  for (const event of events) {
    const key = `${event.counterId}:${dateKeyFor(event.createdAt)}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(event);
    groups.set(key, bucket);
  }

  const summaries: CounterDaySummary[] = [];

  for (const [, bucket] of groups) {
    const sorted = [...bucket].sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const startValue = first.previousValue;
    const endValue = last.newValue;
    const netChange = endValue - startValue;
    const hasManualSet = dayGroupHasManualSet(sorted);

    if (netChange === 0 && !hasManualSet) {
      continue;
    }

    summaries.push({
      counterId: first.counterId,
      counterName: first.counterName,
      isPrimary: first.isPrimary,
      dateKey: dateKeyFor(first.createdAt),
      startValue,
      endValue,
      netChange,
      hasManualSet,
      occurredAt: last.createdAt,
    });
  }

  return summaries;
}

/** User-facing primary line for a counter day summary. */
export function formatCounterSummaryText(summary: CounterDaySummary): string {
  if (summary.hasManualSet) {
    return `Счётчик «${summary.counterName}» изменён: ${summary.startValue} → ${summary.endValue}`;
  }
  if (summary.netChange > 0 && summary.isPrimary) {
    return `Провязано ${formatRowCount(summary.netChange)}`;
  }
  if (summary.netChange !== 0) {
    return `Счётчик «${summary.counterName}»: ${summary.startValue} → ${summary.endValue}`;
  }
  return `Счётчик «${summary.counterName}»: ${summary.endValue}`;
}

/** Net row change for a primary counter within a time window (session bounds). */
export function netRowChangeInWindow(
  events: CounterEventSlice[],
  windowStartIso: string,
  windowEndIso: string
): number | null {
  const startMs = Date.parse(windowStartIso);
  const endMs = Date.parse(windowEndIso);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return null;
  }

  const inWindow = events
    .filter((e) => e.isPrimary)
    .filter((e) => {
      const t = Date.parse(e.createdAt);
      return t >= startMs && t <= endMs;
    })
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  if (inWindow.length === 0) {
    return null;
  }

  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  return last.newValue - first.previousValue;
}

/** Maximum row value ever reached from event history + current value. */
export function maxRowFromEvents(
  events: CounterEventSlice[],
  currentValue: number
): number {
  let max = currentValue;
  for (const event of events) {
    max = Math.max(max, event.previousValue, event.newValue);
  }
  return max;
}
