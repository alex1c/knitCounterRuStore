/**
 * Hook for aggregated project statistics.
 */

import { useMemo, useState, useCallback } from 'react';

import type { ProjectStatistics } from '@/domain/types';
import { useDatabase } from '@/providers/DatabaseProvider';
import { ProjectStatisticsService } from '@/services/ProjectStatisticsService';

const EMPTY: ProjectStatistics = {
  hasData: false,
  totalKnittingSeconds: 0,
  activeSessionElapsedSeconds: null,
  completedSessionCount: 0,
  averageSessionSeconds: null,
  currentPrimaryRow: null,
  maxRowReached: null,
  projectAgeDays: 0,
  projectCreatedLabel: '',
  yarns: [],
  dailyMinutes: [],
  recentActivityAt: null,
};

export function useProjectStatistics(projectId: string | undefined) {
  const { db } = useDatabase();
  const [revision, setRevision] = useState(0);

  const statsService = useMemo(
    () => (db ? new ProjectStatisticsService(db) : null),
    [db]
  );

  const reload = useCallback(() => {
    setRevision((v) => v + 1);
  }, []);

  const statistics: ProjectStatistics = useMemo(() => {
    void revision;
    if (!projectId || !statsService) {
      return EMPTY;
    }
    return statsService.getStatistics(projectId);
  }, [projectId, statsService, revision]);

  return { statistics, reload };
}
