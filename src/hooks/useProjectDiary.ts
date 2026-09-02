/**
 * Hook for project diary timeline and manual entry CRUD.
 */

import { useCallback, useMemo, useState } from 'react';

import type { ActivityDayGroup, DiaryFilter } from '@/domain/types';
import { useDatabase } from '@/providers/DatabaseProvider';
import { ProjectActivityService } from '@/services/ProjectActivityService';
import type { CreateDiaryEntryInput, UpdateDiaryEntryInput } from '@/repositories/ProjectDiaryEntryRepository';

export function useProjectDiary(projectId: string | undefined) {
  const { db, projectDiaryEntryRepository } = useDatabase();
  const [filter, setFilter] = useState<DiaryFilter>('all');
  const [revision, setRevision] = useState(0);

  const activityService = useMemo(
    () => (db ? new ProjectActivityService(db) : null),
    [db]
  );

  const reload = useCallback(() => {
    setRevision((v) => v + 1);
  }, []);

  const timeline: ActivityDayGroup[] = useMemo(() => {
    void revision;
    if (!projectId || !activityService) {
      return [];
    }
    return activityService.buildTimeline(projectId, filter);
  }, [projectId, activityService, filter, revision]);

  const activeBanner = useMemo(() => {
    void revision;
    if (!projectId || !activityService) {
      return null;
    }
    return activityService.getActiveSessionBanner(projectId);
  }, [projectId, activityService, revision]);

  const createNote = useCallback(
    (input: Omit<CreateDiaryEntryInput, 'projectId'>) => {
      if (!projectId || !projectDiaryEntryRepository) {
        return null;
      }
      const created = projectDiaryEntryRepository.create({
        ...input,
        projectId,
      });
      reload();
      return created;
    },
    [projectId, projectDiaryEntryRepository, reload]
  );

  const updateNote = useCallback(
    (entryId: string, input: UpdateDiaryEntryInput) => {
      if (!projectId || !projectDiaryEntryRepository) {
        return null;
      }
      const updated = projectDiaryEntryRepository.update(
        entryId,
        projectId,
        input
      );
      reload();
      return updated;
    },
    [projectId, projectDiaryEntryRepository, reload]
  );

  const deleteNote = useCallback(
    (entryId: string) => {
      if (!projectId || !projectDiaryEntryRepository) {
        return;
      }
      projectDiaryEntryRepository.delete(entryId, projectId);
      reload();
    },
    [projectId, projectDiaryEntryRepository, reload]
  );

  return {
    filter,
    setFilter,
    timeline,
    activeBanner,
    createNote,
    updateNote,
    deleteNote,
    reload,
  };
}
