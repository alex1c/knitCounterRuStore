/**
 * Applies a validated backup payload into SQLite inside one transaction.
 *
 * Caller must materialize managed document files and rewrite file_uri afterward
 * (or pass already-rewritten document rows).
 */

import type { SqlDatabase } from '@/db/types';
import { BACKUP_TABLE_ORDER, type BackupTableName } from './constants';
import type { BackupDataPayload } from './types';

const DELETE_ORDER: BackupTableName[] = [
  'counter_events',
  'project_diary_entries',
  'project_documents',
  'project_yarns',
  'yarns',
  'knitting_sessions',
  'row_rule_rows',
  'row_rules',
  'counters',
  'project_parts',
  'knitting_projects',
  'app_settings',
];

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Некорректное имя колонки: ${name}`);
  }
  return `"${name}"`;
}

function insertRows(
  db: SqlDatabase,
  table: BackupTableName,
  rows: Record<string, unknown>[]
): void {
  if (rows.length === 0) return;

  for (const row of rows) {
    const columns = Object.keys(row);
    if (columns.length === 0) continue;
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.map(quoteIdent).join(', ')}) VALUES (${placeholders})`;
    db.run(
      sql,
      columns.map((c) => row[c] ?? null)
    );
  }
}

/**
 * Replaces all user data with the backup payload.
 * Runs PRAGMA foreign_key_check before commit.
 */
export function applyBackupToDatabase(
  db: SqlDatabase,
  data: BackupDataPayload
): void {
  db.withTransaction(() => {
    for (const table of DELETE_ORDER) {
      db.run(`DELETE FROM ${table}`);
    }

    for (const table of BACKUP_TABLE_ORDER) {
      insertRows(db, table, data.tables[table]);
    }

    const fkViolations = db.getAll('PRAGMA foreign_key_check');
    if (fkViolations.length > 0) {
      throw new Error('Нарушение внешних ключей при восстановлении');
    }
  });
}

/** Clears dangling active_project / similar settings after restore. */
export function sanitizeSettingsAfterRestore(db: SqlDatabase): void {
  const settings = db.getAll<{ key: string; value: string }>(
    'SELECT key, value FROM app_settings'
  );
  for (const setting of settings) {
    if (
      setting.key === 'activeProjectId' ||
      setting.key === 'active_project_id'
    ) {
      const exists = db.getFirst(
        'SELECT id FROM knitting_projects WHERE id = ?',
        [setting.value]
      );
      if (!exists) {
        db.run('DELETE FROM app_settings WHERE key = ?', [setting.key]);
      }
    }
  }
}
