/**
 * Builds a derived project activity timeline from source-of-truth tables.
 *
 * Does not duplicate events into a separate activity table.
 */

import type {
  ActivityDayGroup,
  ActivityTimelineItem,
  DiaryFilter,
  KnittingSession,
} from '@/domain/types';
import { CounterRepository } from '@/repositories/CounterRepository';
import {
  KnittingSessionRepository,
  formatDuration,
} from '@/repositories/KnittingSessionRepository';
import { ProjectDiaryEntryRepository } from '@/repositories/ProjectDiaryEntryRepository';
import { ProjectDocumentRepository } from '@/repositories/ProjectDocumentRepository';
import { ProjectYarnRepository } from '@/repositories/ProjectYarnRepository';
import { YarnRepository } from '@/repositories/YarnRepository';
import {
  formatCounterSummaryText,
  formatRowCount,
  netRowChangeInWindow,
  summarizeCounterEventsByDay,
  type CounterEventSlice,
} from '@/utils/counterActivitySummary';
import {
  formatDayGroupLabel,
  formatLocalTime,
  localDateKeyFromIso,
} from '@/utils/localDates';
import { formatYarnTitle } from '@/utils/yarnDisplay';
import type { SqlDatabase } from '@/db/types';

const TIMELINE_LIMIT = 200;

export class ProjectActivityService {
  private readonly diaryRepo: ProjectDiaryEntryRepository;
  private readonly sessionRepo: KnittingSessionRepository;
  private readonly counterRepo: CounterRepository;
  private readonly documentRepo: ProjectDocumentRepository;
  private readonly projectYarnRepo: ProjectYarnRepository;
  private readonly yarnRepo: YarnRepository;

  constructor(private readonly db: SqlDatabase) {
    this.diaryRepo = new ProjectDiaryEntryRepository(db);
    this.sessionRepo = new KnittingSessionRepository(db);
    this.counterRepo = new CounterRepository(db);
    this.documentRepo = new ProjectDocumentRepository(db);
    this.projectYarnRepo = new ProjectYarnRepository(db);
    this.yarnRepo = new YarnRepository(db);
  }

  /** Active session banner, if any — not part of completed history. */
  getActiveSessionBanner(projectId: string): ActivityTimelineItem | null {
    const active = this.sessionRepo.getActiveSession(projectId);
    if (!active) {
      return null;
    }
    const elapsed = this.sessionRepo.getElapsedSeconds(active);
    const minutes = Math.max(1, Math.round(elapsed / 60));
    return {
      id: `active-session:${active.id}`,
      kind: 'active_session',
      occurredAt: active.startedAt,
      primaryText: `Сейчас вяжете · ${minutes} мин`,
    };
  }

  buildTimeline(
    projectId: string,
    filter: DiaryFilter = 'all',
    referenceDate: Date = new Date()
  ): ActivityDayGroup[] {
    const items: ActivityTimelineItem[] = [];

    for (const entry of this.diaryRepo.listForProject(projectId, TIMELINE_LIMIT)) {
      items.push({
        id: `diary:${entry.id}`,
        kind: entry.type === 'milestone' ? 'milestone' : 'note',
        occurredAt: entry.occurredAt,
        primaryText: entry.title ?? entry.text,
        secondaryText: entry.title ? entry.text : undefined,
      });
    }

    for (const session of this.sessionRepo.listCompletedSessions(
      projectId,
      TIMELINE_LIMIT
    )) {
      items.push(this.sessionToTimelineItem(projectId, session));
    }

    const eventSlices = this.loadCounterEventSlices(projectId);
    for (const summary of summarizeCounterEventsByDay(
      eventSlices,
      localDateKeyFromIso
    )) {
      items.push({
        id: `counter:${summary.counterId}:${summary.dateKey}`,
        kind: 'counter_summary',
        occurredAt: summary.occurredAt,
        primaryText: formatCounterSummaryText(summary),
      });
    }

    for (const doc of this.documentRepo.listForProject(projectId)) {
      items.push({
        id: `document:${doc.id}`,
        kind: 'document_added',
        occurredAt: doc.createdAt,
        primaryText: `Добавлен документ: ${doc.title}`,
        secondaryText: doc.type.toUpperCase(),
      });
    }

    for (const link of this.projectYarnRepo.listLinksByProject(projectId)) {
      const yarn = this.yarnRepo.getYarnById(link.yarnId);
      if (!yarn) {
        continue;
      }
      items.push({
        id: `yarn:${link.id}`,
        kind: 'yarn_attached',
        occurredAt: link.createdAt,
        primaryText: `Пряжа добавлена: ${formatYarnTitle(yarn)}`,
      });
    }

    const filtered = items.filter((item) => matchesFilter(item, filter));
    filtered.sort(
      (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)
    );

    const limited = filtered.slice(0, TIMELINE_LIMIT);
    return groupByDay(limited, referenceDate);
  }

  private sessionToTimelineItem(
    projectId: string,
    session: KnittingSession
  ): ActivityTimelineItem {
    const duration = session.durationSeconds ?? 0;
    const minutes = Math.max(1, Math.round(duration / 60));
    const timeLabel = formatLocalTime(session.startedAt);
    const slices = this.loadCounterEventSlices(projectId);
    const rowDelta =
      session.endedAt != null
        ? netRowChangeInWindow(slices, session.startedAt, session.endedAt)
        : null;

    let secondary = `${minutes} мин`;
    if (rowDelta != null && rowDelta > 0) {
      secondary = `${minutes} мин · +${formatRowCount(rowDelta)}`;
    }

    return {
      id: `session:${session.id}`,
      kind: 'session',
      occurredAt: session.startedAt,
      primaryText: timeLabel ? `Занятие, ${timeLabel}` : 'Занятие вязанием',
      secondaryText: secondary,
    };
  }

  private loadCounterEventSlices(projectId: string): CounterEventSlice[] {
    return this.counterRepo.listManualEventSlicesForProject(projectId).map(
      (event) => ({
        counterId: event.counterId,
        counterName: event.counterName,
        isPrimary: event.isPrimary,
        previousValue: event.previousValue,
        newValue: event.newValue,
        eventType: event.eventType,
        createdAt: event.createdAt,
      })
    );
  }
}

function matchesFilter(item: ActivityTimelineItem, filter: DiaryFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'notes') {
    return item.kind === 'note' || item.kind === 'milestone';
  }
  if (filter === 'knitting') {
    return (
      item.kind === 'session' ||
      item.kind === 'counter_summary' ||
      item.kind === 'active_session'
    );
  }
  if (filter === 'yarn') {
    return item.kind === 'yarn_attached';
  }
  return true;
}

function groupByDay(
  items: ActivityTimelineItem[],
  referenceDate: Date
): ActivityDayGroup[] {
  const map = new Map<string, ActivityTimelineItem[]>();

  for (const item of items) {
    const key = localDateKeyFromIso(item.occurredAt);
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }

  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, dayItems]) => ({
      dateKey,
      label: formatDayGroupLabel(dateKey, referenceDate),
      items: dayItems.sort(
        (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)
      ),
    }));
}

/** Formats session duration for statistics cards. */
export function formatSessionDurationLabel(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} сек`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} мин`;
  }
  return formatDuration(seconds);
}
