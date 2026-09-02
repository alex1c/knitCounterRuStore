/**
 * Splits a completed session duration across local calendar days.
 *
 * Used for the daily knitting-time chart when a session crosses midnight.
 */

import { localDateKeyFromIso, toLocalDateKey } from '@/utils/localDates';

/** Seconds per local calendar day between two UTC ISO timestamps (inclusive start). */
export function splitSessionSecondsByLocalDay(
  startedAt: string,
  endedAt: string
): Record<string, number> {
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return {};
  }

  const result: Record<string, number> = {};
  let cursor = startMs;

  while (cursor < endMs) {
    const cursorDate = new Date(cursor);
    const nextLocalMidnight = new Date(
      cursorDate.getFullYear(),
      cursorDate.getMonth(),
      cursorDate.getDate() + 1,
      0,
      0,
      0,
      0
    ).getTime();
    const segmentEnd = Math.min(endMs, nextLocalMidnight);
    const key = toLocalDateKey(cursorDate);
    const seconds = Math.floor((segmentEnd - cursor) / 1000);
    if (seconds > 0) {
      result[key] = (result[key] ?? 0) + seconds;
    }
    cursor = segmentEnd;
  }

  return result;
}

/** Validates ended_at before splitting; returns empty map for active sessions. */
export function splitCompletedSession(
  startedAt: string,
  endedAt: string | null,
  durationSeconds: number | null
): Record<string, number> {
  if (!endedAt) {
    return {};
  }

  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return {};
  }

  const split = splitSessionSecondsByLocalDay(startedAt, endedAt);
  const splitTotal = Object.values(split).reduce((sum, v) => sum + v, 0);
  const expected =
    durationSeconds != null && durationSeconds >= 0
      ? durationSeconds
      : Math.floor((endMs - startMs) / 1000);

  if (splitTotal === 0 && expected > 0) {
    return { [localDateKeyFromIso(startedAt)]: expected };
  }

  return split;
}
