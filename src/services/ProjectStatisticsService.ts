/**
 * Aggregated project statistics — pure service layer over repositories.
 */

import type { ProjectStatistics } from '@/domain/types';
import type { SqlDatabase } from '@/db/types';
import { CounterRepository } from '@/repositories/CounterRepository';
import { KnittingSessionRepository } from '@/repositories/KnittingSessionRepository';
import { ProjectRepository } from '@/repositories/ProjectRepository';
import { ProjectYarnRepository } from '@/repositories/ProjectYarnRepository';
import { YarnRepository } from '@/repositories/YarnRepository';
import {
  maxRowFromEvents,
  type CounterEventSlice,
} from '@/utils/counterActivitySummary';
import {
  daysSinceIso,
  formatDayGroupLabel,
  formatShortDayLabel,
  lastLocalDateKeys,
  localDateKeyFromIso,
  toLocalDateKey,
} from '@/utils/localDates';
import { splitCompletedSession } from '@/utils/sessionDaySplit';
import { formatYarnTitle } from '@/utils/yarnDisplay';
import { formatDateTimeRu } from '@/utils/numeric';

const CHART_DAYS = 7;

export class ProjectStatisticsService {
  private readonly projectRepo: ProjectRepository;
  private readonly sessionRepo: KnittingSessionRepository;
  private readonly counterRepo: CounterRepository;
  private readonly projectYarnRepo: ProjectYarnRepository;
  private readonly yarnRepo: YarnRepository;

  constructor(private readonly db: SqlDatabase) {
    this.projectRepo = new ProjectRepository(db);
    this.sessionRepo = new KnittingSessionRepository(db);
    this.counterRepo = new CounterRepository(db);
    this.projectYarnRepo = new ProjectYarnRepository(db);
    this.yarnRepo = new YarnRepository(db);
  }

  getStatistics(
    projectId: string,
    referenceDate: Date = new Date()
  ): ProjectStatistics {
    const project = this.projectRepo.getProjectById(projectId);
    if (!project) {
      return emptyStatistics();
    }

    const counters = this.counterRepo.listCountersByProject(projectId);
    const manualCounters = counters.filter(
      (c) => c.parentCounterId == null && c.linkType == null
    );
    const primary =
      manualCounters.find((c) => c.isPrimary) ?? manualCounters[0] ?? null;

    const eventSlices = this.loadPrimaryEventSlices(projectId, primary?.id);
    const completedDuration = this.sessionRepo.getCompletedDurationSeconds(
      projectId
    );
    const active = this.sessionRepo.getActiveSession(projectId);
    const activeElapsed = active
      ? this.sessionRepo.getElapsedSeconds(active)
      : null;
    const totalKnittingSeconds =
      completedDuration + (activeElapsed ?? 0);

    const completedCount = this.sessionRepo.countCompletedSessions(projectId);
    const averageSessionSeconds =
      completedCount > 0
        ? Math.round(completedDuration / completedCount)
        : null;

    const currentPrimaryRow = primary?.currentValue ?? null;
    const maxRowReached =
      primary != null
        ? maxRowFromEvents(eventSlices, primary.currentValue)
        : null;

    const yarns = this.projectYarnRepo.listLinksByProject(projectId).flatMap(
      (link) => {
        const yarn = this.yarnRepo.getYarnById(link.yarnId);
        if (!yarn) {
          return [];
        }
        return [
          {
            yarnId: yarn.id,
            yarnName: formatYarnTitle(yarn),
            usedMilliskeins: link.usedQuantityMilliskeins,
            plannedMilliskeins: link.plannedQuantityMilliskeins,
          },
        ];
      }
    );

    const dailyMinutes = this.buildDailyChart(projectId, referenceDate);
    const recentActivityAt = this.findRecentActivity(
      projectId,
      project.updatedAt
    );

    const hasData =
      completedCount > 0 ||
      activeElapsed != null ||
      eventSlices.length > 0 ||
      yarns.length > 0;

    return {
      hasData,
      totalKnittingSeconds,
      activeSessionElapsedSeconds: activeElapsed,
      completedSessionCount: completedCount,
      averageSessionSeconds,
      currentPrimaryRow,
      maxRowReached,
      projectAgeDays: daysSinceIso(project.createdAt, referenceDate),
      projectCreatedLabel: formatDateTimeRu(project.createdAt),
      yarns,
      dailyMinutes,
      recentActivityAt,
    };
  }

  /** Minutes knitted today for the Today screen summary. */
  getTodayKnittingSeconds(
    projectId: string,
    referenceDate: Date = new Date()
  ): number {
    const todayKey = toLocalDateKey(referenceDate);
    const stats = this.getStatistics(projectId, referenceDate);
    const todayBar = stats.dailyMinutes.find((d) => d.dateKey === todayKey);
    const chartSeconds = (todayBar?.minutes ?? 0) * 60;

    const active = this.sessionRepo.getActiveSession(projectId);
    if (!active) {
      return chartSeconds;
    }

    const activeStartedKey = localDateKeyFromIso(active.startedAt);
    if (activeStartedKey === todayKey) {
      return chartSeconds + this.sessionRepo.getElapsedSeconds(active);
    }
    return chartSeconds;
  }

  private buildDailyChart(projectId: string, referenceDate: Date) {
    const keys = lastLocalDateKeys(CHART_DAYS, referenceDate);
    const totals: Record<string, number> = Object.fromEntries(
      keys.map((k) => [k, 0])
    );

    for (const session of this.sessionRepo.listCompletedSessions(
      projectId,
      500
    )) {
      const split = splitCompletedSession(
        session.startedAt,
        session.endedAt,
        session.durationSeconds
      );
      for (const [dayKey, seconds] of Object.entries(split)) {
        if (totals[dayKey] != null) {
          totals[dayKey] += seconds;
        }
      }
    }

    return keys.map((dateKey) => ({
      dateKey,
      label: formatShortDayLabel(dateKey),
      minutes: Math.round((totals[dateKey] ?? 0) / 60),
    }));
  }

  private loadPrimaryEventSlices(
    projectId: string,
    primaryCounterId: string | undefined
  ): CounterEventSlice[] {
    if (!primaryCounterId) {
      return [];
    }
    return this.counterRepo
      .listManualEventSlicesForProject(projectId)
      .filter((e) => e.counterId === primaryCounterId)
      .map((event) => ({
        counterId: event.counterId,
        counterName: event.counterName,
        isPrimary: event.isPrimary,
        previousValue: event.previousValue,
        newValue: event.newValue,
        eventType: event.eventType,
        createdAt: event.createdAt,
      }));
  }

  private findRecentActivity(
    projectId: string,
    projectUpdatedAt: string
  ): string | null {
    let latest = Date.parse(projectUpdatedAt);

    const session = this.sessionRepo.listCompletedSessions(projectId, 1)[0];
    if (session) {
      latest = Math.max(latest, Date.parse(session.startedAt));
    }

    const active = this.sessionRepo.getActiveSession(projectId);
    if (active) {
      latest = Math.max(latest, Date.parse(active.startedAt));
    }

    const latestEvent = this.db.getFirst<{ created_at: string }>(
      `SELECT ce.created_at
       FROM counter_events ce
       INNER JOIN counters c ON c.id = ce.counter_id
       WHERE c.project_id = ?
         AND c.parent_counter_id IS NULL
         AND (c.link_type IS NULL OR c.link_type = '')
       ORDER BY ce.created_at DESC
       LIMIT 1`,
      [projectId]
    );
    if (latestEvent) {
      latest = Math.max(latest, Date.parse(latestEvent.created_at));
    }

    return Number.isNaN(latest) ? null : new Date(latest).toISOString();
  }
}

function emptyStatistics(): ProjectStatistics {
  return {
    hasData: false,
    totalKnittingSeconds: 0,
    activeSessionElapsedSeconds: null,
    completedSessionCount: 0,
    averageSessionSeconds: null,
    currentPrimaryRow: null,
    maxRowReached: null,
    projectAgeDays: 0,
    projectCreatedLabel: '',
    yarns: [],
    dailyMinutes: lastLocalDateKeys(CHART_DAYS).map((dateKey) => ({
      dateKey,
      label: formatShortDayLabel(dateKey),
      minutes: 0,
    })),
    recentActivityAt: null,
  };
}

/** Human label for project age in days. */
export function formatProjectAgeDays(days: number): string {
  if (days === 0) {
    return 'создан сегодня';
  }
  if (days === 1) {
    return '1 день';
  }
  if (days >= 2 && days <= 4) {
    return `${days} дня`;
  }
  return `${days} дней`;
}

/** Label for a daily chart bar accessibility. */
export function formatChartBarLabel(
  dateKey: string,
  minutes: number,
  referenceDate: Date = new Date()
): string {
  const day = formatDayGroupLabel(dateKey, referenceDate);
  return `${day}: ${minutes} минут вязания`;
}
