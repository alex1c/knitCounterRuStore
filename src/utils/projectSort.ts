/**
 * Deterministic project list ordering for UI.
 */

import type { ProjectStatus } from '@/domain/codes';
import type { KnittingProject } from '@/domain/types';

const STATUS_ORDER: Record<ProjectStatus, number> = {
  active: 0,
  paused: 1,
  planned: 2,
  completed: 3,
  archived: 4,
};

/** Sort projects: active first, archived last; within group by updated_at desc. */
export function sortProjectsForList(projects: KnittingProject[]): KnittingProject[] {
  return [...projects].sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/** Active projects sorted by most recently updated. */
export function getActiveProjects(projects: KnittingProject[]): KnittingProject[] {
  return projects
    .filter((p) => p.status === 'active')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
