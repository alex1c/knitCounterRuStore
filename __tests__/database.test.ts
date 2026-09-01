/**
 * Integration-style DB tests using sql.js (in-memory) + repositories.
 */

import initSqlJs from 'sql.js';

import {
  areForeignKeysEnabled,
  createDatabaseFromClient,
} from '@/db/database';
import { CURRENT_SCHEMA_VERSION } from '@/db/migrations';
import { createSqlJsAdapter } from '@/db/sqlJsAdapter';
import type { SqlDatabase } from '@/db/types';
import { DomainValidationError } from '@/domain/validation';
import { CounterRepository } from '@/repositories/CounterRepository';
import { ProjectPartRepository } from '@/repositories/ProjectPartRepository';
import { ProjectRepository } from '@/repositories/ProjectRepository';
import { SettingsRepository } from '@/repositories/SettingsRepository';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const adapter = createSqlJsAdapter(raw);
  return createDatabaseFromClient(adapter);
}

describe('database', () => {
  test('init sets schema version and is idempotent on re-init', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    const adapter = createSqlJsAdapter(raw);

    const db1 = createDatabaseFromClient(adapter);
    expect(db1.getUserVersion()).toBe(CURRENT_SCHEMA_VERSION);
    expect(areForeignKeysEnabled(db1)).toBe(true);

    const db2 = createDatabaseFromClient(adapter);
    expect(db2.getUserVersion()).toBe(CURRENT_SCHEMA_VERSION);

    const tables = db2.getAll<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'knitting_projects'`
    );
    expect(tables).toHaveLength(1);
  });

  test('foreign keys reject orphan project part', async () => {
    const db = await openTestDb();
    const parts = new ProjectPartRepository(db);

    expect(() =>
      parts.createPart({
        projectId: '00000000-0000-4000-8000-000000000099',
        name: 'Перед',
      })
    ).toThrow();
  });
});

describe('ProjectRepository', () => {
  test('CRUD and cascade delete removes parts and counters', async () => {
    const db = await openTestDb();
    const projects = new ProjectRepository(db);
    const parts = new ProjectPartRepository(db);
    const counters = new CounterRepository(db);

    const project = projects.createProject({
      name: 'Свитер',
      craftType: 'knitting',
      status: 'active',
    });

    expect(project.name).toBe('Свитер');
    expect(projects.getProjectById(project.id)?.status).toBe('active');
    expect(projects.listProjects()).toHaveLength(1);

    const part = parts.createPart({ projectId: project.id, name: 'Перед' });
    const counter = counters.createCounter({
      projectId: project.id,
      projectPartId: part.id,
      name: 'Основной ряд',
    });

    projects.updateProject(project.id, { notes: 'Тестовая заметка' });
    expect(projects.getProjectById(project.id)?.notes).toBe('Тестовая заметка');

    projects.deleteProject(project.id);
    expect(projects.getProjectById(project.id)).toBeNull();
    expect(parts.getPartById(part.id)).toBeNull();
    expect(counters.getCounterById(counter.id)).toBeNull();
  });

  test('rejects empty project name', async () => {
    const db = await openTestDb();
    const projects = new ProjectRepository(db);

    expect(() => projects.createProject({ name: '   ' })).toThrow(
      DomainValidationError
    );
  });
});

describe('CounterRepository', () => {
  test('increment creates counter_event atomically', async () => {
    const db = await openTestDb();
    const projects = new ProjectRepository(db);
    const counters = new CounterRepository(db);

    const project = projects.createProject({ name: 'Шапка' });
    const counter = counters.createCounter({
      projectId: project.id,
      name: 'Ряды',
      startValue: 5,
    });

    const result = counters.incrementCounter(counter.id);
    expect(result.counter.currentValue).toBe(6);
    expect(result.event.previousValue).toBe(5);
    expect(result.event.newValue).toBe(6);
    expect(result.event.eventType).toBe('increment');

    const events = counters.listEventsByCounter(counter.id);
    expect(events).toHaveLength(1);
  });

  test('decrement rejects negative values', async () => {
    const db = await openTestDb();
    const projects = new ProjectRepository(db);
    const counters = new CounterRepository(db);

    const project = projects.createProject({ name: 'Носки' });
    const counter = counters.createCounter({
      projectId: project.id,
      name: 'Ряд',
      startValue: 0,
    });

    expect(() => counters.decrementCounter(counter.id)).toThrow(
      DomainValidationError
    );
  });

  test('setCounterValue records event', async () => {
    const db = await openTestDb();
    const projects = new ProjectRepository(db);
    const counters = new CounterRepository(db);

    const project = projects.createProject({ name: 'Плед' });
    const counter = counters.createCounter({
      projectId: project.id,
      name: 'Узор',
    });

    const result = counters.setCounterValue(counter.id, 42);
    expect(result.counter.currentValue).toBe(42);
    expect(result.event.eventType).toBe('set');
  });

  test('rejects invalid repeat_length', async () => {
    const db = await openTestDb();
    const projects = new ProjectRepository(db);
    const counters = new CounterRepository(db);

    const project = projects.createProject({ name: 'Жилет' });

    expect(() =>
      counters.createCounter({
        projectId: project.id,
        name: 'Узор',
        repeatLength: 0,
      })
    ).toThrow(DomainValidationError);
  });
});

describe('SettingsRepository', () => {
  test('upserts and reads settings', async () => {
    const db = await openTestDb();
    const settings = new SettingsRepository(db);

    settings.setSetting('theme', 'light');
    expect(settings.getSetting('theme')?.value).toBe('light');

    settings.setSetting('theme', 'dark');
    expect(settings.getSetting('theme')?.value).toBe('dark');
    expect(settings.listSettings()).toHaveLength(1);
  });
});
