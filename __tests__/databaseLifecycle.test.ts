import type { SqlDatabase } from '@/db/types';

function readyDatabase(): SqlDatabase {
  return {
    exec: jest.fn(),
    run: jest.fn(),
    getAll: jest.fn(() => []),
    getFirst: jest.fn(() => null),
    withTransaction: jest.fn((fn: () => unknown) => fn()),
    getUserVersion: jest.fn(() => 2),
    setUserVersion: jest.fn(),
  } as SqlDatabase;
}

describe('app database lifecycle', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('repeated consumers share one open/bootstrap result', () => {
    const rawClient = {};
    const db = readyDatabase();
    const openDatabaseSync = jest.fn(() => rawClient);
    const createExpoSqliteAdapter = jest.fn(() => db);
    jest.doMock('expo-sqlite', () => ({ openDatabaseSync }));
    jest.doMock('@/db/expoSqliteAdapter', () => ({ createExpoSqliteAdapter }));

    const { openAppDatabase } = jest.requireActual<typeof import('@/db/database')>(
      '@/db/database'
    );
    const first = openAppDatabase();
    const second = openAppDatabase();

    expect(second).toBe(first);
    expect(openDatabaseSync).toHaveBeenCalledTimes(1);
    expect(createExpoSqliteAdapter).toHaveBeenCalledTimes(1);
    expect(db.exec).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
  });

  test('failed bootstrap is not cached and can be retried', () => {
    const rawClient = {};
    const db = readyDatabase();
    const exec = jest.mocked(db.exec);
    exec.mockImplementationOnce(() => {
      throw new Error('controlled bootstrap failure');
    });
    const openDatabaseSync = jest.fn(() => rawClient);
    jest.doMock('expo-sqlite', () => ({ openDatabaseSync }));
    jest.doMock('@/db/expoSqliteAdapter', () => ({
      createExpoSqliteAdapter: jest.fn(() => db),
    }));

    const { openAppDatabase } = jest.requireActual<typeof import('@/db/database')>(
      '@/db/database'
    );
    expect(() => openAppDatabase()).toThrow('controlled bootstrap failure');
    expect(openAppDatabase()).toBe(db);
    expect(openDatabaseSync).toHaveBeenCalledTimes(2);
  });
});
