/**
 * Key-value settings repository backed by the app_settings table.
 */

import { StorageError } from '@/domain/errors';
import type { AppSetting } from '@/domain/types';
import type { SqlDatabase } from '@/db/types';
import { nowIsoUtc } from '@/utils/timestamps';

type SettingsRow = {
  key: string;
  value: string;
  updated_at: string;
};

export class SettingsRepository {
  constructor(private readonly db: SqlDatabase) {}

  getSetting(key: string): AppSetting | null {
    try {
      const row = this.db.getFirst<SettingsRow>(
        'SELECT key, value, updated_at FROM app_settings WHERE key = ?',
        [key]
      );
      return row ? mapSetting(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get setting', err);
    }
  }

  listSettings(): AppSetting[] {
    try {
      const rows = this.db.getAll<SettingsRow>(
        'SELECT key, value, updated_at FROM app_settings ORDER BY key ASC'
      );
      return rows.map(mapSetting);
    } catch (err) {
      throw new StorageError('Failed to list settings', err);
    }
  }

  setSetting(key: string, value: string): AppSetting {
    const now = nowIsoUtc();
    try {
      this.db.run(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`,
        [key, value, now]
      );
    } catch (err) {
      throw new StorageError('Failed to set setting', err);
    }

    return { key, value, updatedAt: now };
  }

  deleteSetting(key: string): void {
    try {
      this.db.run('DELETE FROM app_settings WHERE key = ?', [key]);
    } catch (err) {
      throw new StorageError('Failed to delete setting', err);
    }
  }
}

function mapSetting(row: SettingsRow): AppSetting {
  return {
    key: row.key,
    value: row.value,
    updatedAt: row.updated_at,
  };
}
