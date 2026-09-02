/**
 * Provides the opened SqlDatabase and repository instances to the React tree.
 * Opens the DB once on mount; exposes ready / error states for splash gating.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { openAppDatabase } from '@/db/database';
import type { SqlDatabase } from '@/db/types';
import { formatErrorForDiagnostics } from '@/domain/errors';
import { CounterRepository } from '@/repositories/CounterRepository';
import { ProjectPartRepository } from '@/repositories/ProjectPartRepository';
import { ProjectRepository } from '@/repositories/ProjectRepository';
import { SettingsRepository } from '@/repositories/SettingsRepository';
import { RowRuleRepository } from '@/repositories/RowRuleRepository';
import { KnittingSessionRepository } from '@/repositories/KnittingSessionRepository';
import { ProjectYarnRepository } from '@/repositories/ProjectYarnRepository';
import { YarnRepository } from '@/repositories/YarnRepository';
import { ProjectService } from '@/services/ProjectService';
import { YarnUsageService } from '@/services/YarnUsageService';

export type DatabaseContextValue = {
  ready: boolean;
  error: string | null;
  db: SqlDatabase | null;
  projectRepository: ProjectRepository | null;
  projectPartRepository: ProjectPartRepository | null;
  counterRepository: CounterRepository | null;
  settingsRepository: SettingsRepository | null;
  rowRuleRepository: RowRuleRepository | null;
  knittingSessionRepository: KnittingSessionRepository | null;
  yarnRepository: YarnRepository | null;
  projectYarnRepository: ProjectYarnRepository | null;
  yarnUsageService: YarnUsageService | null;
  projectService: ProjectService | null;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

type Props = {
  children: ReactNode;
};

/**
 * Opens the local SQLite database on mount and shares repositories via context.
 */
export function DatabaseProvider({ children }: Props) {
  const [db, setDb] = useState<SqlDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      try {
        const opened = openAppDatabase();
        if (!cancelled) {
          setDb(opened);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatErrorForDiagnostics(err));
          setDb(null);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<DatabaseContextValue>(() => {
    if (!db) {
      return {
        ready: false,
        error,
        db: null,
        projectRepository: null,
        projectPartRepository: null,
        counterRepository: null,
        settingsRepository: null,
        rowRuleRepository: null,
        knittingSessionRepository: null,
        yarnRepository: null,
        projectYarnRepository: null,
        yarnUsageService: null,
        projectService: null,
      };
    }

    return {
      ready: true,
      error: null,
      db,
      projectRepository: new ProjectRepository(db),
      projectPartRepository: new ProjectPartRepository(db),
      counterRepository: new CounterRepository(db),
      settingsRepository: new SettingsRepository(db),
      rowRuleRepository: new RowRuleRepository(db),
      knittingSessionRepository: new KnittingSessionRepository(db),
      yarnRepository: new YarnRepository(db),
      projectYarnRepository: new ProjectYarnRepository(db),
      yarnUsageService: new YarnUsageService(db),
      projectService: new ProjectService(db),
    };
  }, [db, error]);

  return (
    <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>
  );
}

/** Hook to access the database context. */
export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }
  return ctx;
}
