/**
 * Applies pending numbered migrations using SQLite PRAGMA user_version.
 * Each migration runs inside its own transaction; version is bumped after success.
 */

import { StorageError } from '@/domain/errors';
import { CURRENT_SCHEMA_VERSION, MIGRATIONS } from './migrations';
import type { Migration, SqlDatabase } from './types';

/**
 * Runs all migrations with version > current user_version, in order.
 * Idempotent: calling again when already up-to-date is a no-op.
 */
export function runMigrations(
  db: SqlDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
  supportedVersion = CURRENT_SCHEMA_VERSION
): void {
  const current = db.getUserVersion();

  if (current > supportedVersion) {
    throw new StorageError(
      `Database schema version ${current} is newer than supported version ${supportedVersion}`
    );
  }

  let previousVersion = 0;
  for (const migration of migrations) {
    if (migration.version <= previousVersion) {
      throw new StorageError('Migrations must be ordered by strictly increasing version');
    }
    previousVersion = migration.version;
  }

  for (const migration of migrations) {
    if (migration.version <= current) {
      continue;
    }

    try {
      db.withTransaction(() => {
        migration.up(db);
        // Bump user_version inside the same transaction so a failed up() rolls back.
        db.setUserVersion(migration.version);
      });
    } catch (err) {
      throw new StorageError(
        `Migration ${migration.version} (${migration.name}) failed`,
        err
      );
    }
  }
}
