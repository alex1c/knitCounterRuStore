/**
 * Hook to load project detail with parts and counters.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useDatabase } from '@/providers/DatabaseProvider';
import type { Counter, KnittingProject, ProjectPart } from '@/domain/types';

export type ProjectDetail = {
  project: KnittingProject;
  parts: ProjectPart[];
  counters: Counter[];
};

export function useProjectDetail(projectId: string | undefined) {
  const { projectRepository, projectPartRepository, counterRepository } =
    useDatabase();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!projectId || !projectRepository || !projectPartRepository || !counterRepository) {
      setDetail(null);
      setLoading(false);
      return;
    }

    const project = projectRepository.getProjectById(projectId);
    if (!project) {
      setDetail(null);
      setLoading(false);
      return;
    }

    const parts = projectPartRepository.listPartsByProject(projectId);
    const counters = counterRepository.listCountersByProject(projectId);
    setDetail({ project, parts, counters });
    setLoading(false);
  }, [projectId, projectRepository, projectPartRepository, counterRepository]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      reload();
    }, [reload])
  );

  return { detail, loading, reload };
}
