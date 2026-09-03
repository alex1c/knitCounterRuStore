import type { SqlDatabase } from '@/db/types';
import type { BackupDataPayload } from './types';
import { applyBackupToDatabase, sanitizeSettingsAfterRestore } from './applyBackup';

export type RestoreFile = {
  documentId: string;
  projectId: string;
  extension: string;
  bytes: Uint8Array;
};

export type RestoreFileStore = {
  materialize: (file: RestoreFile, generation: string) => string;
  remove: (uri: string, projectId: string) => void;
};

/**
 * Materializes collision-free files before replacing SQLite. If either phase
 * fails, the old database and every file it references remain untouched.
 */
export function restoreAtomically(
  db: SqlDatabase,
  data: BackupDataPayload,
  files: RestoreFile[],
  store: RestoreFileStore,
  generation: string
): void {
  const oldDocuments = db.getAll<{ file_uri: string; project_id: string }>(
    'SELECT file_uri, project_id FROM project_documents'
  );
  const newUris: { uri: string; projectId: string }[] = [];

  try {
    const uriById = new Map<string, string>();
    for (const file of files) {
      const uri = store.materialize(file, generation);
      newUris.push({ uri, projectId: file.projectId });
      uriById.set(file.documentId, uri);
    }

    for (const row of data.tables.project_documents) {
      row.file_uri = uriById.get(String(row.id)) ?? '';
    }

    db.withTransaction(() => {
      applyBackupToDatabase(db, data, false);
      sanitizeSettingsAfterRestore(db);
    });
  } catch (error) {
    for (const file of newUris) {
      try { store.remove(file.uri, file.projectId); } catch { /* best effort */ }
    }
    throw error;
  }

  const liveUris = new Set(
    data.tables.project_documents.map((row) => String(row.file_uri ?? ''))
  );
  for (const old of oldDocuments) {
    if (old.file_uri && !liveUris.has(old.file_uri)) {
      try { store.remove(old.file_uri, old.project_id); } catch { /* best effort */ }
    }
  }
}
