/**
 * Project parts repository — CRUD over project_parts table.
 */

import { StorageError } from '@/domain/errors';
import type { ProjectPart } from '@/domain/types';
import { validateNonEmptyName, validatePosition } from '@/domain/validation';
import type { SqlDatabase } from '@/db/types';
import { createId } from '@/utils/id';
import { nowIsoUtc } from '@/utils/timestamps';

type PartRow = {
  id: string;
  project_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type CreateProjectPartInput = {
  projectId: string;
  name: string;
  position?: number;
};

export type UpdateProjectPartInput = {
  name?: string;
  position?: number;
};

export class ProjectPartRepository {
  constructor(private readonly db: SqlDatabase) {}

  createPart(input: CreateProjectPartInput): ProjectPart {
    const name = validateNonEmptyName(input.name, 'name');
    const now = nowIsoUtc();
    const id = createId();
    const position = input.position ?? 0;
    validatePosition(position);

    const part: ProjectPart = {
      id,
      projectId: input.projectId,
      name,
      position,
      createdAt: now,
      updatedAt: now,
    };

    try {
      this.db.run(
        `INSERT INTO project_parts (id, project_id, name, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [part.id, part.projectId, part.name, part.position, part.createdAt, part.updatedAt]
      );
    } catch (err) {
      throw new StorageError('Failed to create project part', err);
    }

    return part;
  }

  getPartById(id: string): ProjectPart | null {
    try {
      const row = this.db.getFirst<PartRow>(
        'SELECT * FROM project_parts WHERE id = ?',
        [id]
      );
      return row ? mapPart(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get project part', err);
    }
  }

  listPartsByProject(projectId: string): ProjectPart[] {
    try {
      const rows = this.db.getAll<PartRow>(
        'SELECT * FROM project_parts WHERE project_id = ? ORDER BY position ASC, created_at ASC',
        [projectId]
      );
      return rows.map(mapPart);
    } catch (err) {
      throw new StorageError('Failed to list project parts', err);
    }
  }

  updatePart(id: string, input: UpdateProjectPartInput): ProjectPart {
    const existing = this.getPartById(id);
    if (!existing) {
      throw new StorageError(`Project part not found: ${id}`);
    }

    const updated: ProjectPart = {
      ...existing,
      name: input.name !== undefined
        ? validateNonEmptyName(input.name, 'name')
        : existing.name,
      position: input.position !== undefined ? input.position : existing.position,
      updatedAt: nowIsoUtc(),
    };
    validatePosition(updated.position);

    try {
      this.db.run(
        `UPDATE project_parts SET name = ?, position = ?, updated_at = ? WHERE id = ?`,
        [updated.name, updated.position, updated.updatedAt, id]
      );
    } catch (err) {
      throw new StorageError('Failed to update project part', err);
    }

    return updated;
  }

  deletePart(id: string): void {
    try {
      const result = this.db.run('DELETE FROM project_parts WHERE id = ?', [id]);
      if (result.changes === 0) {
        throw new StorageError(`Project part not found: ${id}`);
      }
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to delete project part', err);
    }
  }
}

function mapPart(row: PartRow): ProjectPart {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
