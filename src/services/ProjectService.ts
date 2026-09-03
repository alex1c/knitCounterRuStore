/**
 * Orchestrates multi-entity project workflows inside transactions.
 */

import type { CraftType, ProjectStatus } from '@/domain/codes';
import { DEFAULT_COUNTER_NAME, DEFAULT_PART_NAME } from '@/domain/labels';
import { StorageError } from '@/domain/errors';
import type { Counter, KnittingProject, ProjectPart } from '@/domain/types';
import type { SqlDatabase } from '@/db/types';
import { CounterRepository } from '@/repositories/CounterRepository';
import {
  ProjectRepository,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '@/repositories/ProjectRepository';
import { ProjectPartRepository } from '@/repositories/ProjectPartRepository';
import { Analytics } from '@/services/AnalyticsService';
import { InterstitialAdService } from '@/services/InterstitialAdService';
import { ProjectDocumentService } from '@/services/ProjectDocumentService';
import { nowIsoUtc } from '@/utils/timestamps';

export type CreateProjectWithDefaultsInput = {
  name: string;
  craftType?: CraftType;
  status?: ProjectStatus;
  projectType?: string | null;
  startedAt?: string | null;
  notes?: string | null;
};

export type ProjectWithDefaults = {
  project: KnittingProject;
  defaultPart: ProjectPart;
  primaryCounter: Counter;
};

export class ProjectService {
  constructor(private readonly db: SqlDatabase) {}

  /**
   * Creates a project with default part and primary counter atomically.
   */
  createProjectWithDefaults(
    input: CreateProjectWithDefaultsInput
  ): ProjectWithDefaults {
    try {
      const created = this.db.withTransaction(() => {
        const projects = new ProjectRepository(this.db);
        const parts = new ProjectPartRepository(this.db);
        const counters = new CounterRepository(this.db);

        const status = input.status ?? 'active';
        const startedAt =
          input.startedAt ?? (status === 'active' ? nowIsoUtc() : null);

        const project = projects.createProject({
          ...input,
          status,
          startedAt,
        } satisfies CreateProjectInput);

        const defaultPart = parts.createPart({
          projectId: project.id,
          name: DEFAULT_PART_NAME,
          position: 0,
        });

        const primaryCounter = counters.createCounter({
          projectId: project.id,
          projectPartId: defaultPart.id,
          name: DEFAULT_COUNTER_NAME,
          isPrimary: true,
          position: 0,
        });

        return { project, defaultPart, primaryCounter };
      });
      // Privacy-safe: no project name or ids in analytics payload
      Analytics.projectCreated();
      void InterstitialAdService.onProjectMilestone();
      return created;
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to create project with defaults', err);
    }
  }

  /**
   * Updates project and applies status transition side effects.
   */
  updateProject(id: string, input: UpdateProjectInput): KnittingProject {
    const projects = new ProjectRepository(this.db);
    const existing = projects.getProjectById(id);
    if (!existing) {
      throw new StorageError(`Project not found: ${id}`);
    }

    const nextStatus = input.status ?? existing.status;
    const patch: UpdateProjectInput = { ...input };

    if (nextStatus === 'active' && existing.status !== 'active' && !patch.startedAt) {
      patch.startedAt = existing.startedAt ?? nowIsoUtc();
    }
    if (nextStatus === 'completed' && existing.status !== 'completed') {
      patch.completedAt = patch.completedAt ?? nowIsoUtc();
    }
    if (nextStatus !== 'completed' && input.status && input.status !== 'completed') {
      patch.completedAt = input.completedAt ?? null;
    }

    const updated = projects.updateProject(id, patch);
    // Detect completed transition so we do not re-fire on unrelated edits
    if (nextStatus === 'completed' && existing.status !== 'completed') {
      Analytics.projectCompleted();
      void InterstitialAdService.onProjectMilestone();
    }
    return updated;
  }

  /** Bumps updated_at when user interacts with a project (e.g. knitting). */
  touchProject(id: string): void {
    const projects = new ProjectRepository(this.db);
    projects.touchProject(id);
  }

  /**
   * Deletes project and attempts managed document cleanup.
   * Database cascade removes document rows; file cleanup is best-effort.
   */
  deleteProject(id: string): void {
    const projects = new ProjectRepository(this.db);
    const existing = projects.getProjectById(id);
    if (!existing) {
      throw new StorageError(`Project not found: ${id}`);
    }

    const documentService = new ProjectDocumentService(this.db);
    try {
      documentService.cleanupProjectFiles(id);
    } catch {
      // Best-effort — do not block project deletion on filesystem errors.
    }

    projects.deleteProject(id);
    Analytics.projectDeleted();
  }
}
