/**
 * Hook to load project detail with parts, counters, rules, and knitting time.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { Counter, KnittingProject, ProjectPart, ProjectYarn, RowRule, Yarn } from '@/domain/types';
import { useDatabase } from '@/providers/DatabaseProvider';

export type ProjectYarnDetail = ProjectYarn & { yarn: Yarn };

export type ProjectDetail = {
  project: KnittingProject;
  parts: ProjectPart[];
  counters: Counter[];
  rules: RowRule[];
  projectYarns: ProjectYarnDetail[];
  totalKnittingSeconds: number;
  activeRuleCount: number;
};

export function useProjectDetail(projectId: string | undefined) {
  const {
    projectRepository,
    projectPartRepository,
    counterRepository,
    rowRuleRepository,
    knittingSessionRepository,
    projectYarnRepository,
    yarnRepository,
  } = useDatabase();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (
      !projectId ||
      !projectRepository ||
      !projectPartRepository ||
      !counterRepository ||
      !rowRuleRepository ||
      !knittingSessionRepository ||
      !projectYarnRepository ||
      !yarnRepository
    ) {
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
    const rules = rowRuleRepository.listRulesByProject(projectId);
    const totalKnittingSeconds =
      knittingSessionRepository.getTotalDurationSeconds(projectId);
    const activeRuleCount = rowRuleRepository.countActiveByProject(projectId);
    const links = projectYarnRepository.listLinksByProject(projectId);
    const projectYarns = links
      .map((link) => {
        const yarn = yarnRepository.getYarnById(link.yarnId);
        return yarn ? { ...link, yarn } : null;
      })
      .filter((row): row is ProjectYarnDetail => row != null);

    setDetail({
      project,
      parts,
      counters,
      rules,
      projectYarns,
      totalKnittingSeconds,
      activeRuleCount,
    });
    setLoading(false);
  }, [
    projectId,
    projectRepository,
    projectPartRepository,
    counterRepository,
    rowRuleRepository,
    knittingSessionRepository,
    projectYarnRepository,
    yarnRepository,
  ]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      reload();
    }, [reload])
  );

  return { detail, loading, reload };
}
