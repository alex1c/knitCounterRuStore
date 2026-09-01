/**
 * Domain entity types (camelCase) mapped from SQLite rows in repositories.
 */

import type {
  CounterEventType,
  CounterLinkType,
  CraftType,
  ProjectStatus,
  RowRuleType,
} from './codes';

export type KnittingProject = {
  id: string;
  name: string;
  projectType: string | null;
  craftType: CraftType;
  status: ProjectStatus;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  photoUri: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectPart = {
  id: string;
  projectId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type Counter = {
  id: string;
  projectId: string;
  projectPartId: string | null;
  parentCounterId: string | null;
  linkType: CounterLinkType | null;
  name: string;
  currentValue: number;
  startValue: number;
  targetValue: number | null;
  repeatLength: number | null;
  isPrimary: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type RowRule = {
  id: string;
  projectId: string;
  projectPartId: string | null;
  counterId: string;
  name: string;
  instruction: string;
  ruleType: RowRuleType;
  startRow: number | null;
  everyNRows: number | null;
  exactRow: number | null;
  endRow: number | null;
  isActive: boolean;
  position: number;
  listRows: number[];
  createdAt: string;
  updatedAt: string;
};

export type KnittingSession = {
  id: string;
  projectId: string;
  projectPartId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  isActive: boolean;
  createdAt: string;
};

export type CounterEvent = {
  id: string;
  counterId: string;
  previousValue: number;
  newValue: number;
  eventType: CounterEventType;
  createdAt: string;
};

export type AppSetting = {
  key: string;
  value: string;
  updatedAt: string;
};
