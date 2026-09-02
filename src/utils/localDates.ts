/**
 * Local calendar date helpers for diary grouping and charts.
 *
 * Stored timestamps are UTC ISO strings; grouping uses the device local timezone
 * via JavaScript Date — never substring the UTC date portion.
 */

const MONTHS_RU = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

/** Builds YYYY-MM-DD for a Date in local timezone. */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local date key from a persisted UTC ISO timestamp. */
export function localDateKeyFromIso(isoUtc: string): string {
  const parsed = Date.parse(isoUtc);
  if (Number.isNaN(parsed)) {
    return isoUtc.slice(0, 10);
  }
  return toLocalDateKey(new Date(parsed));
}

/** Russian day-group header: Сегодня, Вчера, or "1 сентября". */
export function formatDayGroupLabel(
  dateKey: string,
  referenceDate: Date = new Date()
): string {
  const todayKey = toLocalDateKey(referenceDate);
  if (dateKey === todayKey) {
    return 'Сегодня';
  }

  const yesterday = new Date(referenceDate);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === toLocalDateKey(yesterday)) {
    return 'Вчера';
  }

  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) {
    return dateKey;
  }

  const monthLabel = MONTHS_RU[month - 1] ?? String(month);
  if (year === referenceDate.getFullYear()) {
    return `${day} ${monthLabel}`;
  }
  return `${day} ${monthLabel} ${year}`;
}

/** Short weekday + day label for chart bars, e.g. "Пн 1". */
export function formatShortDayLabel(dateKey: string): string {
  const parsed = Date.parse(`${dateKey}T12:00:00`);
  if (Number.isNaN(parsed)) {
    return dateKey.slice(5);
  }
  const date = new Date(parsed);
  const weekday = date.toLocaleDateString('ru-RU', { weekday: 'short' });
  return `${weekday} ${date.getDate()}`;
}

/** Time only, e.g. "19:10". */
export function formatLocalTime(isoUtc: string): string {
  const parsed = Date.parse(isoUtc);
  if (Number.isNaN(parsed)) {
    return '';
  }
  return new Date(parsed).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Elapsed whole days since project creation (local calendar). */
export function daysSinceIso(isoUtc: string, referenceDate: Date = new Date()): number {
  const createdKey = localDateKeyFromIso(isoUtc);
  const todayKey = toLocalDateKey(referenceDate);
  const created = Date.parse(`${createdKey}T00:00:00`);
  const today = Date.parse(`${todayKey}T00:00:00`);
  if (Number.isNaN(created) || Number.isNaN(today)) {
    return 0;
  }
  return Math.max(0, Math.floor((today - created) / 86_400_000));
}

/** Last N local calendar days ending today, oldest first. */
export function lastLocalDateKeys(
  dayCount: number,
  referenceDate: Date = new Date()
): string[] {
  const keys: string[] = [];
  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - offset);
    keys.push(toLocalDateKey(d));
  }
  return keys;
}
