/**
 * Phase 3 integration tests — row rules, linked counters, timer, migration.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/db/database';
import { runMigrations } from '@/db/migrate';
import { migration001Initial } from '@/db/migrations/001_initial';
import { migration002CounterPartIntegrity } from '@/db/migrations/002_counter_part_integrity';
import { migration003RowRulesAndTimer } from '@/db/migrations/003_row_rules_and_timer';
import { CURRENT_SCHEMA_VERSION } from '@/db/migrations';
import { createSqlJsAdapter } from '@/db/sqlJsAdapter';
import type { SqlDatabase } from '@/db/types';
import {
  getDueRowRules,
  getNextRuleOccurrence,
} from '@/domain/rowRuleEngine';
import { DomainValidationError } from '@/domain/validation';
import { CounterRepository } from '@/repositories/CounterRepository';
import { KnittingSessionRepository } from '@/repositories/KnittingSessionRepository';
import { ProjectPartRepository } from '@/repositories/ProjectPartRepository';
import { ProjectRepository } from '@/repositories/ProjectRepository';
import { RowRuleRepository } from '@/repositories/RowRuleRepository';
import { ProjectService } from '@/services/ProjectService';
import {
  formatLinkedRepeatProgress,
  getLinkedPatternPosition,
} from '@/utils/counterDisplay';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

describe('migration v2 to v3', () => {
  test('preserves counters and events', async () => {
    const SQL = await initSqlJs();
    const db = createSqlJsAdapter(new SQL.Database());
    db.exec('PRAGMA foreign_keys = ON;');
    runMigrations(db, [migration001Initial, migration002CounterPartIntegrity], 2);

    const projects = new ProjectRepository(db);
    const counters = new CounterRepository(db);
    const project = projects.createProject({ name: 'Миграция v3' });
    const counterId = 'counter-migration-v3';
    const now = '2026-01-01T00:00:00.000Z';
    db.run(
      `INSERT INTO counters (
        id, project_id, project_part_id, name, current_value, start_value,
        target_value, repeat_length, is_primary, position, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [counterId, project.id, null, 'Ряды', 1, 0, null, null, 1, 0, now, now]
    );
    db.run(
      `INSERT INTO counter_events (
        id, counter_id, previous_value, new_value, event_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      ['event-migration-v3', counterId, 0, 1, 'increment', now]
    );

    runMigrations(
      db,
      [migration001Initial, migration002CounterPartIntegrity, migration003RowRulesAndTimer],
      CURRENT_SCHEMA_VERSION
    );

    expect(db.getUserVersion()).toBe(3);
    expect(counters.getCounterById(counterId)?.currentValue).toBe(1);
    expect(counters.listEventsByCounter(counterId)).toHaveLength(1);

    const tables = db.getAll<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('row_rules', 'knitting_sessions')`
    );
    expect(tables).toHaveLength(2);
  });
});

describe('RowRuleRepository', () => {
  test('create, update, delete rule', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const rules = new RowRuleRepository(db);
    const { project, primaryCounter } = service.createProjectWithDefaults({
      name: 'Правила',
    });

    const created = rules.createRule({
      projectId: project.id,
      counterId: primaryCounter.id,
      name: 'Убавка',
      instruction: 'Убавить 1 петлю',
      ruleType: 'every_n',
      everyNRows: 6,
    });
    expect(created.everyNRows).toBe(6);

    const updated = rules.updateRule(created.id, {
      instruction: 'Сменить цвет',
      isActive: false,
    });
    expect(updated.instruction).toBe('Сменить цвет');
    expect(updated.isActive).toBe(false);

    rules.deleteRule(created.id);
    expect(rules.getRuleById(created.id)).toBeNull();
  });

  test('rejects invalid rule', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const rules = new RowRuleRepository(db);
    const { project, primaryCounter } = service.createProjectWithDefaults({
      name: 'Валидация',
    });

    expect(() =>
      rules.createRule({
        projectId: project.id,
        counterId: primaryCounter.id,
        name: 'Пусто',
        instruction: '',
        ruleType: 'exact',
        exactRow: 10,
      })
    ).toThrow(DomainValidationError);

    expect(() =>
      rules.createRule({
        projectId: project.id,
        counterId: primaryCounter.id,
        name: 'Ноль',
        instruction: 'Действие',
        ruleType: 'every_n',
        everyNRows: 0,
      })
    ).toThrow(DomainValidationError);
  });

  test('rejects cross-project counter', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const rules = new RowRuleRepository(db);
    const a = service.createProjectWithDefaults({ name: 'A' });
    const b = service.createProjectWithDefaults({ name: 'B' });

    expect(() =>
      rules.createRule({
        projectId: a.project.id,
        counterId: b.primaryCounter.id,
        name: 'Чужой',
        instruction: 'Нельзя',
        ruleType: 'exact',
        exactRow: 5,
      })
    ).toThrow();
  });

  test('rejects cross-project part', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const rules = new RowRuleRepository(db);
    const parts = new ProjectPartRepository(db);
    const a = service.createProjectWithDefaults({ name: 'A' });
    const b = service.createProjectWithDefaults({ name: 'B' });
    const foreignPart = parts.createPart({ projectId: b.project.id, name: 'Чужая' });

    expect(() =>
      rules.createRule({
        projectId: a.project.id,
        counterId: a.primaryCounter.id,
        projectPartId: foreignPart.id,
        name: 'Часть',
        instruction: 'Нельзя',
        ruleType: 'exact',
        exactRow: 5,
      })
    ).toThrow();
  });

  test('list rule stores normalized rows', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const rules = new RowRuleRepository(db);
    const { project, primaryCounter } = service.createProjectWithDefaults({
      name: 'Список',
    });

    const rule = rules.createRule({
      projectId: project.id,
      counterId: primaryCounter.id,
      name: 'Список',
      instruction: 'Действие',
      ruleType: 'list',
      listRows: [54, 30, 42, 30],
    });
    expect(rule.listRows).toEqual([30, 42, 54]);
  });
});

describe('rule evaluation with counter mutations', () => {
  test('undo/decrement recomputes due action', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const counters = new CounterRepository(db);
    const rules = new RowRuleRepository(db);
    const { project, primaryCounter } = service.createProjectWithDefaults({
      name: 'Отмена',
    });

    rules.createRule({
      projectId: project.id,
      counterId: primaryCounter.id,
      name: 'Точный',
      instruction: 'Закрыть петли',
      ruleType: 'exact',
      exactRow: 3,
    });

    for (let i = 0; i < 3; i++) {
      counters.incrementCounter(primaryCounter.id);
    }
    const activeRules = rules.listActiveRulesByCounter(primaryCounter.id);
    expect(getDueRowRules(activeRules, 3)).toHaveLength(1);

    counters.decrementCounter(primaryCounter.id);
    const afterDec = counters.getCounterById(primaryCounter.id)!;
    expect(getDueRowRules(activeRules, afterDec.currentValue)).toHaveLength(0);

    counters.undoLastChange(primaryCounter.id);
    const afterUndo = counters.getCounterById(primaryCounter.id)!;
    expect(getDueRowRules(activeRules, afterUndo.currentValue)).toHaveLength(1);
  });

  test('next occurrence after current row', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const rules = new RowRuleRepository(db);
    const { project, primaryCounter } = service.createProjectWithDefaults({
      name: 'Следующий',
    });

    rules.createRule({
      projectId: project.id,
      counterId: primaryCounter.id,
      name: 'Каждые 6',
      instruction: 'Убавка',
      ruleType: 'every_n',
      everyNRows: 6,
    });

    const activeRules = rules.listActiveRulesByCounter(primaryCounter.id);
    const next = getNextRuleOccurrence(activeRules, 4);
    expect(next?.dueAtRow).toBe(6);
    expect(next?.rowsUntil).toBe(2);
  });
});

describe('linked counters', () => {
  test('derived pattern position from main row', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const counters = new CounterRepository(db);
    const { project, primaryCounter } = service.createProjectWithDefaults({
      name: 'Узор',
    });

    const pattern = counters.createCounter({
      projectId: project.id,
      name: 'Узор',
      parentCounterId: primaryCounter.id,
      linkType: 'follow_main',
      repeatLength: 12,
    });

    for (let i = 0; i < 26; i++) {
      counters.incrementCounter(primaryCounter.id);
    }

    const main = counters.getCounterById(primaryCounter.id)!;
    const linked = counters.getCounterById(pattern.id)!;
    expect(getLinkedPatternPosition(main, linked)).toBe(2);
    expect(formatLinkedRepeatProgress(main, linked)).toBe('Узор 2 / 12');
  });

  test('rejects chained links', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const counters = new CounterRepository(db);
    const { project, primaryCounter } = service.createProjectWithDefaults({
      name: 'Цепочка',
    });

    const child = counters.createCounter({
      projectId: project.id,
      name: 'Узор',
      parentCounterId: primaryCounter.id,
      linkType: 'follow_main',
      repeatLength: 8,
    });

    expect(() =>
      counters.createCounter({
        projectId: project.id,
        name: 'Внук',
        parentCounterId: child.id,
        linkType: 'follow_main',
        repeatLength: 4,
      })
    ).toThrow(DomainValidationError);
  });
});

describe('KnittingSessionRepository', () => {
  test('start, stop, and total duration', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const sessions = new KnittingSessionRepository(db);
    const { project } = service.createProjectWithDefaults({ name: 'Таймер' });

    const started = sessions.startSession(project.id);
    expect(started.isActive).toBe(true);
    expect(sessions.getElapsedSeconds(started)).toBeGreaterThanOrEqual(0);

    const stopped = sessions.stopSession(started.id);
    expect(stopped.isActive).toBe(false);
    expect(stopped.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(sessions.getTotalDurationSeconds(project.id)).toBeGreaterThanOrEqual(0);
  });

  test('only one active session per project', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const sessions = new KnittingSessionRepository(db);
    const { project } = service.createProjectWithDefaults({ name: 'Один таймер' });

    const first = sessions.startSession(project.id);
    const second = sessions.startSession(project.id);

    expect(second.isActive).toBe(true);
    const firstAfter = sessions.getSessionById(first.id);
    expect(firstAfter?.isActive).toBe(false);
    expect(sessions.getActiveSession(project.id)?.id).toBe(second.id);
  });
});

describe('cascade delete', () => {
  test('project deletion removes rules and sessions', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const projects = new ProjectRepository(db);
    const rules = new RowRuleRepository(db);
    const sessions = new KnittingSessionRepository(db);
    const { project, primaryCounter } = service.createProjectWithDefaults({
      name: 'Удалить',
    });

    const rule = rules.createRule({
      projectId: project.id,
      counterId: primaryCounter.id,
      name: 'R',
      instruction: 'X',
      ruleType: 'exact',
      exactRow: 1,
    });
    sessions.startSession(project.id);
    sessions.stopSession(sessions.getActiveSession(project.id)!.id);

    projects.deleteProject(project.id);
    expect(rules.getRuleById(rule.id)).toBeNull();
    expect(sessions.getActiveSession(project.id)).toBeNull();
  });
});
