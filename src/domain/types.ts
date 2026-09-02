/**
 * Domain entity types (camelCase) mapped from SQLite rows in repositories.
 */

import type {
  CounterEventType,
  CounterLinkType,
  CraftType,
  DiaryEntryType,
  ProjectDocumentType,
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

/** Personal yarn inventory item. Quantity stored as milliskeins (1 skein = 1000). */
export type Yarn = {
  id: string;
  brand: string | null;
  name: string;
  colorName: string | null;
  colorCode: string | null;
  dyeLot: string | null;
  composition: string | null;
  weightPerSkeinG: number | null;
  lengthPerSkeinM: number | null;
  quantityMilliskeins: number;
  purchasePriceMinor: number | null;
  currency: string;
  notes: string | null;
  photoUri: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Join between a project and yarn from personal inventory. */
export type ProjectYarn = {
  id: string;
  projectId: string;
  yarnId: string;
  plannedQuantityMilliskeins: number | null;
  usedQuantityMilliskeins: number;
  createdAt: string;
  updatedAt: string;
};

/** Project-attached PDF or reference image stored in app-managed storage. */
export type ProjectDocument = {
  id: string;
  projectId: string;
  type: ProjectDocumentType;
  title: string;
  originalName: string | null;
  fileUri: string;
  mimeType: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** User-authored diary note stored in project_diary_entries. */
export type ProjectDiaryEntry = {
  id: string;
  projectId: string;
  type: DiaryEntryType;
  title: string | null;
  text: string;
  occurredAt: string;
  documentId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Derived activity timeline item kinds — not persisted separately. */
export type ActivityKind =
  | 'note'
  | 'milestone'
  | 'session'
  | 'counter_summary'
  | 'yarn_attached'
  | 'document_added'
  | 'active_session';

/** Filter tabs for the project diary timeline. */
export type DiaryFilter = 'all' | 'notes' | 'knitting' | 'yarn';

/** Single row in the reverse-chronological project activity feed. */
export type ActivityTimelineItem = {
  id: string;
  kind: ActivityKind;
  occurredAt: string;
  primaryText: string;
  secondaryText?: string;
};

/** Date-grouped section in the diary timeline. */
export type ActivityDayGroup = {
  dateKey: string;
  label: string;
  items: ActivityTimelineItem[];
};

/** Per-yarn usage line for project statistics. */
export type ProjectYarnStat = {
  yarnId: string;
  yarnName: string;
  usedMilliskeins: number;
  plannedMilliskeins: number | null;
};

/** One bar in the daily knitting-time chart. */
export type DailyKnittingMinutes = {
  dateKey: string;
  label: string;
  minutes: number;
};

/** Aggregated project statistics view model. */
export type ProjectStatistics = {
  hasData: boolean;
  totalKnittingSeconds: number;
  activeSessionElapsedSeconds: number | null;
  completedSessionCount: number;
  averageSessionSeconds: number | null;
  currentPrimaryRow: number | null;
  maxRowReached: number | null;
  projectAgeDays: number;
  projectCreatedLabel: string;
  yarns: ProjectYarnStat[];
  dailyMinutes: DailyKnittingMinutes[];
  recentActivityAt: string | null;
};
