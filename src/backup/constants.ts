/**
 * Backup archive format constants and safety bounds.
 *
 * BACKUP_FORMAT_VERSION is independent of DB schema version (CURRENT_SCHEMA_VERSION).
 * Phase 8 v1 supports format 1 + schema 6 only.
 */

import { CURRENT_SCHEMA_VERSION } from '@/db/migrations';

/** Knit Counter backup archive format version (not DB user_version). */
export const BACKUP_FORMAT_VERSION = 1;

/** Schema version this backup format expects. */
export const SUPPORTED_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;

/** Preferred backup file extension (ZIP bytes with app-specific suffix). */
export const BACKUP_FILE_EXTENSION = 'knitbackup';

/** Manifest and data entry names inside the ZIP. */
export const MANIFEST_ENTRY = 'manifest.json';
export const DATA_ENTRY = 'data.json';
export const FILES_PREFIX = 'files/';

/** Logical archive root for managed project documents. */
export const ARCHIVE_PROJECTS_PREFIX = 'files/projects/';

/**
 * Safety bounds against pathological archives (ZIP bombs / huge payloads).
 * Sized for knitting-app usage (docs + DB JSON), not enterprise media vaults.
 */
// fflate is synchronous and in-memory; keep enough headroom for the ZIP input,
// inflated output and JS/native copies on typical Android devices.
export const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024; // 32 MB compressed
export const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024; // 64 MB total uncompressed
export const MAX_ZIP_ENTRIES = 5_000;
export const MAX_SINGLE_ENTRY_BYTES = 32 * 1024 * 1024; // 32 MB per file

/** Tables exported / restored in FK-safe dependency order (insert order). */
export const BACKUP_TABLE_ORDER = [
  'app_settings',
  'knitting_projects',
  'project_parts',
  'counters',
  'row_rules',
  'row_rule_rows',
  'knitting_sessions',
  'yarns',
  'project_yarns',
  'project_documents',
  'project_diary_entries',
  'counter_events',
] as const;

export type BackupTableName = (typeof BACKUP_TABLE_ORDER)[number];
