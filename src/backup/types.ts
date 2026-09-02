/**
 * Backup / restore domain types for format version 1.
 */

import type { BackupTableName } from './constants';

/** Top-level ZIP manifest (UTF-8 JSON). */
export type BackupManifest = {
  backup_format_version: number;
  schema_version: number;
  created_at: string;
  app_version: string;
  tables: Record<string, number>;
  files: number;
  files_missing: number;
  warnings: string[];
};

/**
 * Document metadata as stored in data.json.
 * archive_path is relative; file_uri from the source device is NOT authoritative on restore.
 */
export type BackupDocumentRecord = Record<string, unknown> & {
  id: string;
  project_id: string;
  type: string;
  title: string;
  file_uri?: string;
  archive_path: string | null;
  file_missing: boolean;
};

/** Full backup payload (data.json). */
export type BackupDataPayload = {
  tables: Record<BackupTableName, Record<string, unknown>[]>;
  documents: BackupDocumentRecord[];
};

/** Compact preview shown before restore confirmation. */
export type BackupPreview = {
  createdAt: string;
  schemaVersion: number;
  formatVersion: number;
  projectCount: number;
  yarnCount: number;
  diaryCount: number;
  documentCount: number;
  sessionCount: number;
  filesPresent: number;
  filesMissing: number;
  warnings: string[];
};

/** Result of creating a backup archive in memory / temp. */
export type BackupCreateResult = {
  archiveBytes: Uint8Array;
  fileName: string;
  manifest: BackupManifest;
  preview: BackupPreview;
};

/** Result of a successful restore. */
export type BackupRestoreResult = {
  preview: BackupPreview;
  warnings: string[];
};
