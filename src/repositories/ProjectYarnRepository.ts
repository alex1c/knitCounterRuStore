/**
 * Project-yarn link repository — attach/detach and queries.
 */

import { StorageError } from '@/domain/errors';
import type { ProjectYarn, Yarn } from '@/domain/types';
import { validateQuantityMilliskeins } from '@/domain/yarnValidation';
import type { SqlDatabase } from '@/db/types';
import { createId } from '@/utils/id';
import { nowIsoUtc } from '@/utils/timestamps';

type ProjectYarnRow = {
  id: string;
  project_id: string;
  yarn_id: string;
  planned_quantity_milliskeins: number | null;
  used_quantity_milliskeins: number;
  created_at: string;
  updated_at: string;
};

export type ProjectYarnWithYarn = ProjectYarn & { yarn: Yarn };

export class ProjectYarnRepository {
  constructor(private readonly db: SqlDatabase) {}

  attachYarn(
    projectId: string,
    yarnId: string,
    plannedQuantityMilliskeins?: number | null
  ): ProjectYarn {
    if (plannedQuantityMilliskeins != null) {
      validateQuantityMilliskeins(
        plannedQuantityMilliskeins,
        'plannedQuantityMilliskeins'
      );
    }

    const existing = this.getLinkByProjectAndYarn(projectId, yarnId);
    if (existing) {
      throw new StorageError('Эта пряжа уже добавлена в проект');
    }

    const now = nowIsoUtc();
    const id = createId();

    try {
      this.db.run(
        `INSERT INTO project_yarns (
          id, project_id, yarn_id, planned_quantity_milliskeins,
          used_quantity_milliskeins, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?)`,
        [
          id,
          projectId,
          yarnId,
          plannedQuantityMilliskeins ?? null,
          now,
          now,
        ]
      );
      return this.getLinkById(id)!;
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to attach yarn to project', err);
    }
  }

  getLinkById(id: string): ProjectYarn | null {
    try {
      const row = this.db.getFirst<ProjectYarnRow>(
        'SELECT * FROM project_yarns WHERE id = ?',
        [id]
      );
      return row ? mapProjectYarn(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get project yarn link', err);
    }
  }

  getLinkByProjectAndYarn(
    projectId: string,
    yarnId: string
  ): ProjectYarn | null {
    try {
      const row = this.db.getFirst<ProjectYarnRow>(
        'SELECT * FROM project_yarns WHERE project_id = ? AND yarn_id = ?',
        [projectId, yarnId]
      );
      return row ? mapProjectYarn(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get project yarn link', err);
    }
  }

  listLinksByProject(projectId: string): ProjectYarn[] {
    try {
      const rows = this.db.getAll<ProjectYarnRow>(
        'SELECT * FROM project_yarns WHERE project_id = ? ORDER BY created_at ASC',
        [projectId]
      );
      return rows.map(mapProjectYarn);
    } catch (err) {
      throw new StorageError('Failed to list project yarns', err);
    }
  }

  listLinksByYarn(yarnId: string): ProjectYarn[] {
    try {
      const rows = this.db.getAll<ProjectYarnRow>(
        'SELECT * FROM project_yarns WHERE yarn_id = ? ORDER BY created_at ASC',
        [yarnId]
      );
      return rows.map(mapProjectYarn);
    } catch (err) {
      throw new StorageError('Failed to list yarn projects', err);
    }
  }

  /** Removes link without adjusting inventory (usage already deducted). */
  detachYarn(linkId: string): void {
    try {
      const result = this.db.run(
        'DELETE FROM project_yarns WHERE id = ?',
        [linkId]
      );
      if (result.changes === 0) {
        throw new StorageError(`Project yarn link not found: ${linkId}`);
      }
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to detach yarn from project', err);
    }
  }

  /** Internal: set used quantity (called from YarnUsageService). */
  setUsedQuantityMilliskeins(
    linkId: string,
    usedQuantityMilliskeins: number
  ): ProjectYarn {
    validateQuantityMilliskeins(
      usedQuantityMilliskeins,
      'usedQuantityMilliskeins'
    );
    const now = nowIsoUtc();
    try {
      this.db.run(
        `UPDATE project_yarns SET
          used_quantity_milliskeins = ?, updated_at = ?
        WHERE id = ?`,
        [usedQuantityMilliskeins, now, linkId]
      );
      return this.getLinkById(linkId)!;
    } catch (err) {
      throw new StorageError('Failed to update used quantity', err);
    }
  }
}

function mapProjectYarn(row: ProjectYarnRow): ProjectYarn {
  return {
    id: row.id,
    projectId: row.project_id,
    yarnId: row.yarn_id,
    plannedQuantityMilliskeins: row.planned_quantity_milliskeins,
    usedQuantityMilliskeins: row.used_quantity_milliskeins,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
