/**
 * Builds a backup payload from live SQLite (source-of-truth tables only).
 *
 * Active knitting sessions are closed at backup created_at (snapshot semantics).
 */

import type { SqlDatabase } from '@/db/types';
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_TABLE_ORDER,
  SUPPORTED_SCHEMA_VERSION,
  type BackupTableName,
} from './constants';
import type {
  BackupDataPayload,
  BackupDocumentRecord,
  BackupManifest,
} from './types';
import { archiveDocumentPath } from './zipPathSafety';
import { managedDocumentFileName } from '@/utils/managedDocumentPaths';

export type ManagedFileReader = {
  /** Returns file bytes when the managed URI exists; null if missing. */
  readManagedFile: (fileUri: string) => Uint8Array | null;
  /** Extracts extension without dot for a document type/filename. */
  extensionForDocument: (row: Record<string, unknown>) => string;
};

function dumpTable(
  db: SqlDatabase,
  name: BackupTableName
): Record<string, unknown>[] {
  return db.getAll<Record<string, unknown>>(`SELECT * FROM ${name}`);
}

/**
 * Closes any active sessions at snapshotTime for backup export.
 * Mutates the in-memory session rows only (does not write live DB).
 */
export function snapshotSessionsForBackup(
  sessions: Record<string, unknown>[],
  snapshotTime: string
): Record<string, unknown>[] {
  const snapshotMs = Date.parse(snapshotTime);
  return sessions.map((row) => {
    if (row.is_active !== 1) {
      return { ...row };
    }
    const startedAt = String(row.started_at);
    const startedMs = Date.parse(startedAt);
    if (Number.isNaN(startedMs) || Number.isNaN(snapshotMs) || startedMs > snapshotMs) {
      throw new Error('Активная сессия начинается после времени резервной копии');
    }
    const duration = Math.floor((snapshotMs - startedMs) / 1000);
    return {
      ...row,
      ended_at: snapshotTime,
      duration_seconds: duration,
      is_active: 0,
    };
  });
}

/** Collects all tables + document file metadata for packing. */
export function buildBackupPayload(
  db: SqlDatabase,
  options: {
    createdAt: string;
    appVersion: string;
    fileReader: ManagedFileReader;
  }
): {
  manifest: BackupManifest;
  data: BackupDataPayload;
  fileBytes: Record<string, Uint8Array>;
} {
  const warnings: string[] = [];
  const tables = {} as BackupDataPayload['tables'];

  // SQLite read transaction gives every table the same point-in-time snapshot.
  // File reads happen afterwards; imported managed documents are immutable.
  db.withTransaction(() => {
    for (const name of BACKUP_TABLE_ORDER) {
      tables[name] = dumpTable(db, name);
    }
    tables.knitting_sessions = snapshotSessionsForBackup(
      tables.knitting_sessions,
      options.createdAt
    );
  });

  const fileBytes: Record<string, Uint8Array> = {};
  const documents: BackupDocumentRecord[] = [];
  let filesMissing = 0;

  for (const row of tables.project_documents) {
    const id = String(row.id);
    const projectId = String(row.project_id);
    const title = String(row.title);
    const type = String(row.type);
    const fileUri = typeof row.file_uri === 'string' ? row.file_uri : '';
    const ext = options.fileReader.extensionForDocument(row);
    const fileName = managedDocumentFileName(id, ext);
    const archivePath = archiveDocumentPath(projectId, fileName);

    const bytes = fileUri
      ? options.fileReader.readManagedFile(fileUri)
      : null;

    if (!bytes) {
      filesMissing += 1;
      warnings.push(`Файл документа «${title}» отсутствует — сохранены только метаданные`);
      documents.push({
        id,
        project_id: projectId,
        type,
        title,
        file_uri: fileUri,
        archive_path: null,
        file_missing: true,
      });
      // Keep DB row but clear absolute URI so restore rewrites cleanly
      row.file_uri = '';
      continue;
    }

    fileBytes[archivePath] = bytes;
    documents.push({
      id,
      project_id: projectId,
      type,
      title,
      file_uri: fileUri,
      archive_path: archivePath,
      file_missing: false,
    });
    // Strip device-absolute URI from exported DB row — restore writes new URI
    row.file_uri = `archive:${archivePath}`;
  }

  const tableCounts: Record<string, number> = {};
  for (const name of BACKUP_TABLE_ORDER) {
    tableCounts[name] = tables[name].length;
  }

  const manifest: BackupManifest = {
    backup_format_version: BACKUP_FORMAT_VERSION,
    schema_version: SUPPORTED_SCHEMA_VERSION,
    created_at: options.createdAt,
    app_version: options.appVersion,
    tables: tableCounts,
    files: Object.keys(fileBytes).length,
    files_missing: filesMissing,
    warnings,
  };

  return {
    manifest,
    data: { tables, documents },
    fileBytes,
  };
}
