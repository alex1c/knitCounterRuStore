/**
 * Domain entity types (camelCase) mapped from SQLite rows in repositories.
 */

import type {
  CounterEventType,
  CraftType,
  ProjectStatus,
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
