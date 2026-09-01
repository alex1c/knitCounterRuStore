/**
 * Knitting projects repository — CRUD over knitting_projects table.
 */

import type { CraftType, ProjectStatus } from '@/domain/codes';
import { StorageError } from '@/domain/errors';
import type { KnittingProject } from '@/domain/types';
import {
  validateCraftType,
  validateNonEmptyName,
  validateOptionalIsoTimestamp,
  validateProjectStatus,
} from '@/domain/validation';
import type { SqlDatabase } from '@/db/types';
import { createId } from '@/utils/id';
import { nowIsoUtc } from '@/utils/timestamps';

type ProjectRow = {
  id: string;
  name: string;
  project_type: string | null;
  craft_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  photo_uri: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateProjectInput = {
  name: string;
  craftType?: CraftType;
  status?: ProjectStatus;
  projectType?: string | null;
  startedAt?: string | null;
  notes?: string | null;
  photoUri?: string | null;
};

export type UpdateProjectInput = {
  name?: string;
  craftType?: CraftType;
  status?: ProjectStatus;
  projectType?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  photoUri?: string | null;
};

export class ProjectRepository {
  constructor(private readonly db: SqlDatabase) {}

  createProject(input: CreateProjectInput): KnittingProject {
    const name = validateNonEmptyName(input.name, 'name');
    const craftType = validateCraftType(input.craftType ?? 'knitting');
    const status = validateProjectStatus(input.status ?? 'planned');
    validateOptionalIsoTimestamp(input.startedAt, 'startedAt');

    const now = nowIsoUtc();
    const id = createId();

    const project: KnittingProject = {
      id,
      name,
      projectType: input.projectType ?? null,
      craftType,
      status,
      startedAt: input.startedAt ?? null,
      completedAt: null,
      notes: input.notes ?? null,
      photoUri: input.photoUri ?? null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      this.db.run(
        `INSERT INTO knitting_projects (
          id, name, project_type, craft_type, status,
          started_at, completed_at, notes, photo_uri, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          project.id,
          project.name,
          project.projectType,
          project.craftType,
          project.status,
          project.startedAt,
          project.completedAt,
          project.notes,
          project.photoUri,
          project.createdAt,
          project.updatedAt,
        ]
      );
    } catch (err) {
      throw new StorageError('Failed to create project', err);
    }

    return project;
  }

  getProjectById(id: string): KnittingProject | null {
    try {
      const row = this.db.getFirst<ProjectRow>(
        'SELECT * FROM knitting_projects WHERE id = ?',
        [id]
      );
      return row ? mapProject(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get project', err);
    }
  }

  listProjects(): KnittingProject[] {
    try {
      const rows = this.db.getAll<ProjectRow>(
        'SELECT * FROM knitting_projects ORDER BY updated_at DESC'
      );
      return rows.map(mapProject);
    } catch (err) {
      throw new StorageError('Failed to list projects', err);
    }
  }

  updateProject(id: string, input: UpdateProjectInput): KnittingProject {
    const existing = this.getProjectById(id);
    if (!existing) {
      throw new StorageError(`Project not found: ${id}`);
    }

    const updated: KnittingProject = {
      ...existing,
      name: input.name !== undefined
        ? validateNonEmptyName(input.name, 'name')
        : existing.name,
      craftType: input.craftType !== undefined
        ? validateCraftType(input.craftType)
        : existing.craftType,
      status: input.status !== undefined
        ? validateProjectStatus(input.status)
        : existing.status,
      projectType: input.projectType !== undefined
        ? input.projectType
        : existing.projectType,
      startedAt: input.startedAt !== undefined
        ? input.startedAt
        : existing.startedAt,
      completedAt: input.completedAt !== undefined
        ? input.completedAt
        : existing.completedAt,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      photoUri: input.photoUri !== undefined
        ? input.photoUri
        : existing.photoUri,
      updatedAt: nowIsoUtc(),
    };

    validateOptionalIsoTimestamp(updated.startedAt, 'startedAt');
    validateOptionalIsoTimestamp(updated.completedAt, 'completedAt');

    try {
      this.db.run(
        `UPDATE knitting_projects SET
          name = ?, project_type = ?, craft_type = ?, status = ?,
          started_at = ?, completed_at = ?, notes = ?, photo_uri = ?,
          updated_at = ?
        WHERE id = ?`,
        [
          updated.name,
          updated.projectType,
          updated.craftType,
          updated.status,
          updated.startedAt,
          updated.completedAt,
          updated.notes,
          updated.photoUri,
          updated.updatedAt,
          id,
        ]
      );
    } catch (err) {
      throw new StorageError('Failed to update project', err);
    }

    return updated;
  }

  deleteProject(id: string): void {
    try {
      const result = this.db.run(
        'DELETE FROM knitting_projects WHERE id = ?',
        [id]
      );
      if (result.changes === 0) {
        throw new StorageError(`Project not found: ${id}`);
      }
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to delete project', err);
    }
  }

  /** Updates only updated_at — used when user resumes knitting. */
  touchProject(id: string): void {
    try {
      const result = this.db.run(
        'UPDATE knitting_projects SET updated_at = ? WHERE id = ?',
        [nowIsoUtc(), id]
      );
      if (result.changes === 0) {
        throw new StorageError(`Project not found: ${id}`);
      }
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to touch project', err);
    }
  }
}

function mapProject(row: ProjectRow): KnittingProject {
  return {
    id: row.id,
    name: row.name,
    projectType: row.project_type,
    craftType: row.craft_type as CraftType,
    status: row.status as ProjectStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    notes: row.notes,
    photoUri: row.photo_uri,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
