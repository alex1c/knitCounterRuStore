/**
 * Hook to load and sort all projects.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useDatabase } from '@/providers/DatabaseProvider';
import type { Counter, KnittingProject } from '@/domain/types';
import { sortProjectsForList } from '@/utils/projectSort';

export type ProjectListItem = {
  project: KnittingProject;
  primaryCounter: Counter | null;
};

export function useProjectList() {
  const { projectRepository, counterRepository } = useDatabase();
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!projectRepository || !counterRepository) {
      setItems([]);
      setLoading(false);
      return;
    }

    const projects = sortProjectsForList(
      projectRepository.listProjects().filter((p) => p.status !== 'archived')
    );

    const list = projects.map((project) => {
      const counters = counterRepository.listCountersByProject(project.id);
      const primaryCounter =
        counters.find((c) => c.isPrimary) ?? counters[0] ?? null;
      return { project, primaryCounter };
    });

    setItems(list);
    setLoading(false);
  }, [projectRepository, counterRepository]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      reload();
    }, [reload])
  );

  return { items, loading, reload };
}
