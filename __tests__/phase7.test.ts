/**
 * Phase 7 tests — diary CRUD, activity aggregation, statistics, date grouping.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/db/database';
import { runMigrations } from '@/db/migrate';
import { MIGRATIONS, CURRENT_SCHEMA_VERSION } from '@/db/migrations';
import { createSqlJsAdapter } from '@/db/sqlJsAdapter';
import type { SqlDatabase } from '@/db/types';
import { DomainValidationError } from '@/domain/validation';
import { CounterRepository } from '@/repositories/CounterRepository';
import { KnittingSessionRepository } from '@/repositories/KnittingSessionRepository';
import { ProjectDiaryEntryRepository } from '@/repositories/ProjectDiaryEntryRepository';
import { ProjectService } from '@/services/ProjectService';
import { ProjectActivityService } from '@/services/ProjectActivityService';
import { ProjectStatisticsService } from '@/services/ProjectStatisticsService';
import {
  formatCounterSummaryText,
  summarizeCounterEventsByDay,
} from '@/utils/counterActivitySummary';
import { formatDayGroupLabel, localDateKeyFromIso } from '@/utils/localDates';
import { splitSessionSecondsByLocalDay } from '@/utils/sessionDaySplit';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  return createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
}

async function openAtVersion(version: number): Promise<SqlDatabase> {
  const db = await openTestDb();
  runMigrations(db, MIGRATIONS.filter((m) => m.version <= version));
  return db;
}

describe('migration v5 to v6', () => {
  test('preserves documents and adds project_diary_entries', async () => {
    const db = await openAtVersion(5);
    const service = new ProjectService(db);
    const { project } = service.createProjectWithDefaults({ name: 'Diary Test' });

    runMigrations(db, MIGRATIONS);
    expect(db.getUserVersion()).toBe(CURRENT_SCHEMA_VERSION);
    expect(
      db.getFirst(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='project_diary_entries'"
      )
    ).toBeTruthy();
    expect(
      db.getFirst('SELECT id FROM knitting_projects WHERE id = ?', [project.id])
    ).toBeTruthy();
    expect(db.getAll('PRAGMA foreign_key_check')).toEqual([]);
  });
});

describe('ProjectDiaryEntryRepository', () => {
  test('create, trim, blank rejection, edit, delete', async () => {
    const db = await openAtVersion(CURRENT_SCHEMA_VERSION);
    const service = new ProjectService(db);
    const diary = new ProjectDiaryEntryRepository(db);
    const { project } = service.createProjectWithDefaults({ name: 'Notes' });

    const created = diary.create({
      projectId: project.id,
      text: '  Примерила рукав  ',
      title: '  Прогресс  ',
    });
    expect(created.text).toBe('Примерила рукав');
    expect(created.title).toBe('Прогресс');

    expect(() =>
      diary.create({ projectId: project.id, text: '   ' })
    ).toThrow(DomainValidationError);

    const updated = diary.update(created.id, project.id, {
      text: 'Нужно ещё 8 рядов',
      occurredAt: '2026-01-15T10:00:00.000Z',
    });
    expect(updated.text).toBe('Нужно ещё 8 рядов');
    expect(updated.occurredAt).toBe('2026-01-15T10:00:00.000Z');

    diary.delete(created.id, project.id);
    expect(diary.getForProject(created.id, project.id)).toBeNull();
  });

  test('rejects cross-project access', async () => {
    const db = await openAtVersion(CURRENT_SCHEMA_VERSION);
    const service = new ProjectService(db);
    const diary = new ProjectDiaryEntryRepository(db);
    const a = service.createProjectWithDefaults({ name: 'A' });
    const b = service.createProjectWithDefaults({ name: 'B' });
    const entry = diary.create({ projectId: a.project.id, text: 'Note' });

    expect(() => diary.update(entry.id, b.project.id, { text: 'Hack' })).toThrow();
    expect(() => diary.delete(entry.id, b.project.id)).toThrow();
  });
});

describe('local date grouping', () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'Europe/Moscow';
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  test('UTC timestamp maps to correct local day', () => {
    expect(localDateKeyFromIso('2026-01-01T23:30:00.000Z')).toBe('2026-01-02');
  });

  test('day group labels', () => {
    const ref = new Date('2026-09-02T12:00:00');
    expect(formatDayGroupLabel('2026-09-02', ref)).toBe('Сегодня');
    expect(formatDayGroupLabel('2026-09-01', ref)).toBe('Вчера');
    expect(formatDayGroupLabel('2026-08-15', ref)).toBe('15 августа');
  });
});

describe('counter day summaries', () => {
  test('+1 +1 +1 produces net progress', () => {
    const summaries = summarizeCounterEventsByDay(
      [
        {
          counterId: 'c1',
          counterName: 'Ряд',
          isPrimary: true,
          previousValue: 0,
          newValue: 1,
          eventType: 'increment',
          createdAt: '2026-01-01T10:00:00.000Z',
        },
        {
          counterId: 'c1',
          counterName: 'Ряд',
          isPrimary: true,
          previousValue: 1,
          newValue: 2,
          eventType: 'increment',
          createdAt: '2026-01-01T10:01:00.000Z',
        },
        {
          counterId: 'c1',
          counterName: 'Ряд',
          isPrimary: true,
          previousValue: 2,
          newValue: 3,
          eventType: 'increment',
          createdAt: '2026-01-01T10:02:00.000Z',
        },
      ],
      (iso) => iso.slice(0, 10)
    );
    expect(summaries).toHaveLength(1);
    expect(summaries[0].netChange).toBe(3);
    expect(formatCounterSummaryText(summaries[0])).toContain('3 ряда');
  });

  test('+1 +1 undo nets to +1', () => {
    const summaries = summarizeCounterEventsByDay(
      [
        {
          counterId: 'c1',
          counterName: 'Ряд',
          isPrimary: true,
          previousValue: 42,
          newValue: 43,
          eventType: 'increment',
          createdAt: '2026-01-01T10:00:00.000Z',
        },
        {
          counterId: 'c1',
          counterName: 'Ряд',
          isPrimary: true,
          previousValue: 43,
          newValue: 44,
          eventType: 'increment',
          createdAt: '2026-01-01T10:01:00.000Z',
        },
        {
          counterId: 'c1',
          counterName: 'Ряд',
          isPrimary: true,
          previousValue: 44,
          newValue: 43,
          eventType: 'set',
          createdAt: '2026-01-01T10:02:00.000Z',
        },
      ],
      (iso) => iso.slice(0, 10)
    );
    expect(summaries[0].netChange).toBe(1);
    expect(formatCounterSummaryText(summaries[0])).toContain('1 ряд');
  });

  test('manual set shows adjustment wording', () => {
    const summaries = summarizeCounterEventsByDay(
      [
        {
          counterId: 'c1',
          counterName: 'Ряд',
          isPrimary: true,
          previousValue: 10,
          newValue: 60,
          eventType: 'set',
          createdAt: '2026-01-01T10:00:00.000Z',
        },
      ],
      (iso) => iso.slice(0, 10)
    );
    expect(formatCounterSummaryText(summaries[0])).toBe(
      'Счётчик «Ряд» изменён: 10 → 60'
    );
  });
});

describe('session statistics', () => {
  test('completed sessions, average excludes active elapsed from average', async () => {
    const db = await openAtVersion(CURRENT_SCHEMA_VERSION);
    const service = new ProjectService(db);
    const sessions = new KnittingSessionRepository(db);
    const stats = new ProjectStatisticsService(db);
    const { project } = service.createProjectWithDefaults({ name: 'Timer' });

    const s1 = sessions.startSession(project.id);
    sessions.stopSession(s1.id);
    db.run(
      'UPDATE knitting_sessions SET duration_seconds = 1200, started_at = ?, ended_at = ? WHERE id = ?',
      ['2026-01-01T10:00:00.000Z', '2026-01-01T10:20:00.000Z', s1.id]
    );

    const s2 = sessions.startSession(project.id);
    sessions.stopSession(s2.id);
    db.run(
      'UPDATE knitting_sessions SET duration_seconds = 600, started_at = ?, ended_at = ? WHERE id = ?',
      ['2026-01-02T10:00:00.000Z', '2026-01-02T10:10:00.000Z', s2.id]
    );

    sessions.startSession(project.id);

    const result = stats.getStatistics(
      project.id,
      new Date('2026-01-02T15:00:00.000Z')
    );
    expect(result.completedSessionCount).toBe(2);
    expect(result.averageSessionSeconds).toBe(900);
    expect(result.activeSessionElapsedSeconds).not.toBeNull();
  });
});

describe('cross-midnight session split', () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'Europe/Moscow';
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  test('splits duration across local days', () => {
    const split = splitSessionSecondsByLocalDay(
      '2026-01-01T20:50:00.000Z',
      '2026-01-01T21:20:00.000Z'
    );
    const total = Object.values(split).reduce((a, b) => a + b, 0);
    expect(total).toBe(30 * 60);
  });
});

describe('ProjectActivityService timeline', () => {
  test('includes note and excludes linked counter events', async () => {
    const db = await openAtVersion(CURRENT_SCHEMA_VERSION);
    const service = new ProjectService(db);
    const counters = new CounterRepository(db);
    const diary = new ProjectDiaryEntryRepository(db);
    const activity = new ProjectActivityService(db);
    const { project, primaryCounter } = service.createProjectWithDefaults({
      name: 'Timeline',
    });

    diary.create({
      projectId: project.id,
      text: 'Заметка',
      occurredAt: '2026-01-02T12:00:00.000Z',
    });

    counters.incrementCounter(primaryCounter.id);
    counters.incrementCounter(primaryCounter.id);

    counters.createCounter({
      projectId: project.id,
      name: 'Узор',
      parentCounterId: primaryCounter.id,
      linkType: 'follow_main',
      repeatLength: 12,
    });

    const timeline = activity.buildTimeline(
      project.id,
      'all',
      new Date('2026-01-02T18:00:00.000Z')
    );
    const items = timeline.flatMap((g) => g.items);
    expect(items.some((i) => i.kind === 'note')).toBe(true);
    expect(items.some((i) => i.kind === 'counter_summary')).toBe(true);
    expect(items.some((i) => i.primaryText.includes('Узор'))).toBe(false);
  });
});

describe('daily chart aggregation', () => {
  test('attributes completed minutes to session local day', async () => {
    const db = await openAtVersion(CURRENT_SCHEMA_VERSION);
    const service = new ProjectService(db);
    const sessions = new KnittingSessionRepository(db);
    const stats = new ProjectStatisticsService(db);
    const { project } = service.createProjectWithDefaults({ name: 'Chart' });

    const s = sessions.startSession(project.id);
    sessions.stopSession(s.id);
    db.run(
      `UPDATE knitting_sessions SET
        started_at = '2026-09-01T10:00:00.000Z',
        ended_at = '2026-09-01T10:30:00.000Z',
        duration_seconds = 1800
      WHERE id = ?`,
      [s.id]
    );

    const result = stats.getStatistics(
      project.id,
      new Date('2026-09-02T12:00:00.000Z')
    );
    const day = result.dailyMinutes.find((d) => d.dateKey === '2026-09-01');
    expect(day?.minutes).toBe(30);
  });
});
