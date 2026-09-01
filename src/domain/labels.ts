/**
 * Russian UI labels for persisted domain codes.
 */

import type { CraftType, ProjectStatus } from './codes';

export const CRAFT_TYPE_LABELS: Record<CraftType, string> = {
  knitting: 'Спицами',
  crochet: 'Крючком',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: 'Запланирован',
  active: 'Вяжу',
  paused: 'Пауза',
  completed: 'Готов',
  archived: 'В архиве',
};

/** Statuses shown in create/edit form (no archived). */
export const EDITABLE_PROJECT_STATUSES = [
  'planned',
  'active',
  'paused',
  'completed',
] as const satisfies readonly ProjectStatus[];

export const PROJECT_TYPE_PRESETS = [
  'Свитер',
  'Кардиган',
  'Шапка',
  'Шарф',
  'Носки',
  'Варежки',
  'Игрушка',
  'Плед',
  'Другое',
] as const;

export type ProjectTypePreset = (typeof PROJECT_TYPE_PRESETS)[number];

export const DEFAULT_PART_NAME = 'Основная часть';
export const DEFAULT_COUNTER_NAME = 'Ряд';

export function getCraftTypeLabel(craftType: CraftType): string {
  return CRAFT_TYPE_LABELS[craftType];
}

export function getProjectStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUS_LABELS[status];
}
