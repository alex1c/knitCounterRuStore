/**
 * Phase 2 integration tests — project creation, undo, rapid increments.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/db/database';
import { createSqlJsAdapter } from '@/db/sqlJsAdapter';
import type { SqlDatabase } from '@/db/types';
import { DEFAULT_COUNTER_NAME, DEFAULT_PART_NAME } from '@/domain/labels';
import { DomainValidationError } from '@/domain/validation';
import { CounterRepository } from '@/repositories/CounterRepository';
import { ProjectPartRepository } from '@/repositories/ProjectPartRepository';
import { ProjectRepository } from '@/repositories/ProjectRepository';
import { ProjectService } from '@/services/ProjectService';
import { clearCounterQueues, enqueueCounterMutation } from '@/utils/counterQueue';
import { formatRepeatProgress } from '@/utils/counterDisplay';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

describe('ProjectService', () => {
  test('createProjectWithDefaults creates project, part, and primary counter atomically', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const projects = new ProjectRepository(db);

    const result = service.createProjectWithDefaults({
      name: 'Свитер',
      craftType: 'knitting',
      status: 'active',
    });

    expect(result.project.name).toBe('Свитер');
    expect(result.project.status).toBe('active');
    expect(result.defaultPart.name).toBe(DEFAULT_PART_NAME);
    expect(result.primaryCounter.name).toBe(DEFAULT_COUNTER_NAME);
    expect(result.primaryCounter.isPrimary).toBe(true);
    expect(result.primaryCounter.currentValue).toBe(0);
    expect(projects.listProjects()).toHaveLength(1);
  });

  test('rolls back entire create when counter insert would fail', async () => {
    const db = await openTestDb();
    const projects = new ProjectRepository(db);

    const transactionalCreate = () =>
      db.withTransaction(() => {
        const p = new ProjectRepository(db);
        const pt = new ProjectPartRepository(db);
        const c = new CounterRepository(db);
        const project = p.createProject({ name: 'Fail', status: 'active' });
        pt.createPart({ projectId: project.id, name: DEFAULT_PART_NAME });
        c.createCounter({
          projectId: project.id,
          name: DEFAULT_COUNTER_NAME,
          isPrimary: true,
        });
        throw new Error('simulated failure');
      });

    expect(() => transactionalCreate()).toThrow();
    expect(projects.listProjects()).toHaveLength(0);
  });

  test('updateProject sets startedAt when becoming active', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);

    const created = service.createProjectWithDefaults({
      name: 'Шапка',
      status: 'planned',
    });
    expect(created.project.startedAt).toBeNull();

    const updated = service.updateProject(created.project.id, { status: 'active' });
    expect(updated.status).toBe('active');
    expect(updated.startedAt).toBeTruthy();
  });
});

describe('Counter undo and rapid increments', () => {
  beforeEach(() => clearCounterQueues());

  test('undoLastChange restores previous value and appends set event', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const counters = new CounterRepository(db);

    const { primaryCounter } = service.createProjectWithDefaults({ name: 'Тест' });
    counters.incrementCounter(primaryCounter.id);
    counters.incrementCounter(primaryCounter.id);
    expect(counters.getCounterById(primaryCounter.id)?.currentValue).toBe(2);

    const undone = counters.undoLastChange(primaryCounter.id);
    expect(undone.counter.currentValue).toBe(1);
    expect(undone.event.eventType).toBe('set');
    expect(counters.listEventsByCounter(primaryCounter.id)).toHaveLength(3);
  });

  test('undo throws when no events exist', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const counters = new CounterRepository(db);

    const { primaryCounter } = service.createProjectWithDefaults({ name: 'Тест' });
    expect(() => counters.undoLastChange(primaryCounter.id)).toThrow(
      DomainValidationError
    );
  });

  test('rapid sequential increments via queue preserve order', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const counters = new CounterRepository(db);

    const { primaryCounter } = service.createProjectWithDefaults({ name: 'Быстро' });
    const id = primaryCounter.id;

    const tasks = Array.from({ length: 10 }, () =>
      enqueueCounterMutation(id, () => {
        counters.incrementCounter(id);
      })
    );
    await Promise.all(tasks);

    expect(counters.getCounterById(id)?.currentValue).toBe(10);
    expect(counters.listEventsByCounter(id)).toHaveLength(10);
  });

  test('decrement at zero is rejected', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const counters = new CounterRepository(db);

    const { primaryCounter } = service.createProjectWithDefaults({ name: 'Ноль' });
    expect(() => counters.decrementCounter(primaryCounter.id)).toThrow(
      DomainValidationError
    );
  });

  test('counter can exceed target without corruption', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const counters = new CounterRepository(db);

    const { primaryCounter } = service.createProjectWithDefaults({ name: 'Цель' });
    counters.updateCounter(primaryCounter.id, { targetValue: 5 });
    for (let i = 0; i < 7; i++) {
      counters.incrementCounter(primaryCounter.id);
    }
    const counter = counters.getCounterById(primaryCounter.id)!;
    expect(counter.currentValue).toBe(7);
    expect(counter.targetValue).toBe(5);
  });

  test('deleting part detaches counter but preserves history', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const parts = new ProjectPartRepository(db);
    const counters = new CounterRepository(db);

    const { project, defaultPart, primaryCounter } = service.createProjectWithDefaults({
      name: 'Часть',
    });
    counters.incrementCounter(primaryCounter.id);
    parts.deletePart(defaultPart.id);

    const counter = counters.getCounterById(primaryCounter.id)!;
    expect(counter.projectPartId).toBeNull();
    expect(counters.listEventsByCounter(primaryCounter.id)).toHaveLength(1);
    expect(new ProjectRepository(db).getProjectById(project.id)).toBeTruthy();
  });

  test('deleting project removes all data', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const projects = new ProjectRepository(db);
    const counters = new CounterRepository(db);

    const { project, primaryCounter } = service.createProjectWithDefaults({
      name: 'Удалить',
    });
    counters.incrementCounter(primaryCounter.id);
    projects.deleteProject(project.id);

    expect(projects.getProjectById(project.id)).toBeNull();
    expect(counters.getCounterById(primaryCounter.id)).toBeNull();
  });
});

describe('counterDisplay', () => {
  test('repeat position wraps correctly', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const counters = new CounterRepository(db);

    const { primaryCounter } = service.createProjectWithDefaults({ name: 'Узор' });
    counters.updateCounter(primaryCounter.id, { repeatLength: 8 });
    for (let i = 0; i < 13; i++) {
      counters.incrementCounter(primaryCounter.id);
    }
    const counter = counters.getCounterById(primaryCounter.id)!;
    expect(formatRepeatProgress(counter)).toBe('5 / 8');
  });
});
