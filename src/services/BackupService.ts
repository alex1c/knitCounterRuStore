/**
 * BackupService — create / preview / restore Knit Counter .knitbackup archives.
 *
 * Restore safety:
 * 1) read archive into memory
 * 2) validate structure
 * 3) stage document bytes
 * 4) DB replace in one transaction
 * 5) write managed files
 * 6) rewrite document URIs
 * 7) best-effort cleanup of obsolete managed project dirs
 *
 * Active sessions are closed at backup created_at during export (snapshot).
 */

import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

import type { SqlDatabase } from '@/db/types';
import {
  DATA_ENTRY,
  MANIFEST_ENTRY,
  BACKUP_FILE_EXTENSION,
} from '@/backup/constants';
import { buildBackupPayload } from '@/backup/buildBackupPayload';
import {
  restoreAtomically,
} from '@/backup/restoreCoordinator';
import {
  jsonToBytes,
  packZip,
  readManifestAndData,
  unpackZip,
  type ZipFileMap,
} from '@/backup/zipCodec';
import {
  buildPreview,
  validateBackupConsistency,
  validateBackupData,
  validateManifest,
} from '@/backup/validateBackup';
import type {
  BackupCreateResult,
  BackupPreview,
  BackupRestoreResult,
} from '@/backup/types';
import {
  materializeRestoreFile,
  deleteManagedDocumentFile,
  managedFileExists,
} from '@/storage/DocumentFileStorage';
import { managedDocumentFileName } from '@/utils/managedDocumentPaths';
import { nowIsoUtc } from '@/utils/timestamps';

/** Lazy-load expo-sharing so screens can load before a native rebuild. */
async function loadSharing(): Promise<typeof import('expo-sharing')> {
  try {
    return await import('expo-sharing');
  } catch {
    throw new Error(
      'Обмен файлами недоступен. Пересоберите приложение с модулем expo-sharing.'
    );
  }
}

function appVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

function extensionFromRow(row: Record<string, unknown>): string {
  const type = String(row.type ?? 'other');
  const mime = typeof row.mime_type === 'string' ? row.mime_type : '';
  const uri = typeof row.file_uri === 'string' ? row.file_uri : '';
  const fromUri = uri.match(/\.([a-z0-9]+)$/i)?.[1];
  if (fromUri) return fromUri.toLowerCase();
  if (type === 'pdf' || mime.includes('pdf')) return 'pdf';
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (type === 'image') return 'jpg';
  return 'bin';
}

function backupFileName(createdAt: string): string {
  const d = new Date(createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `Moya-vyazalka-backup-${stamp}.${BACKUP_FILE_EXTENSION}`;
}

function ensureBackupCacheDir(): Directory {
  const dir = new Directory(Paths.cache, 'backups');
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

export class BackupService {
  constructor(private readonly db: SqlDatabase) {}

  /** Builds an in-memory archive and writes it to cache for sharing. */
  async createBackup(): Promise<BackupCreateResult & { cacheUri: string }> {
    const createdAt = nowIsoUtc();
    const built = buildBackupPayload(this.db, {
      createdAt,
      appVersion: appVersion(),
      fileReader: {
        readManagedFile: (fileUri) => {
          try {
            if (!managedFileExists(fileUri)) return null;
            return new File(fileUri).bytesSync();
          } catch {
            return null;
          }
        },
        extensionForDocument: extensionFromRow,
      },
    });

    const files: ZipFileMap = {
      [MANIFEST_ENTRY]: jsonToBytes(built.manifest),
      [DATA_ENTRY]: jsonToBytes(built.data),
      ...built.fileBytes,
    };

    const archiveBytes = packZip(files);
    const fileName = backupFileName(createdAt);
    const cacheDir = ensureBackupCacheDir();
    const outFile = new File(cacheDir, fileName);
    if (outFile.exists) {
      outFile.delete();
    }
    outFile.create();
    outFile.write(archiveBytes);

    return {
      archiveBytes,
      fileName,
      manifest: built.manifest,
      preview: buildPreview(built.manifest, built.data),
      cacheUri: outFile.uri,
    };
  }

  /** Shares a previously created cache archive via the system sheet. */
  async shareBackup(cacheUri: string): Promise<void> {
    const Sharing = await loadSharing();
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      throw new Error('Системный обмен файлами недоступен на этом устройстве');
    }
    await Sharing.shareAsync(cacheUri, {
      mimeType: 'application/zip',
      dialogTitle: 'Сохранить резервную копию',
      UTI: 'public.zip-archive',
    });
  }

  /** Best-effort cleanup of temporary backup files in cache. */
  cleanupTempBackups(): void {
    try {
      const dir = new Directory(Paths.cache, 'backups');
      if (dir.exists) {
        dir.delete();
      }
    } catch {
      // ignore cleanup failures
    }
  }

  /** Picks a backup archive and returns a validated preview (no mutation). */
  async pickAndPreview(): Promise<{
    preview: BackupPreview;
    archiveBytes: Uint8Array;
  }> {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['application/zip', 'application/octet-stream', '*/*'],
    });
    if (result.canceled || !result.assets[0]) {
      throw new Error('Выбор файла отменён');
    }
    const asset = result.assets[0];
    const name = (asset.name ?? '').toLowerCase();
    if (
      name &&
      !name.endsWith('.knitbackup') &&
      !name.endsWith('.zip')
    ) {
      throw new Error(
        'Выберите файл резервной копии (.knitbackup или .zip)'
      );
    }

    const picked = new File(asset.uri);
    if (!picked.exists) {
      throw new Error('Не удалось прочитать выбранный файл');
    }
    const archiveBytes = picked.bytesSync();
    const preview = this.previewArchive(archiveBytes);
    return { preview, archiveBytes };
  }

  /** Validates archive bytes and returns preview without mutating live data. */
  previewArchive(archiveBytes: Uint8Array): BackupPreview {
    const files = unpackZip(archiveBytes);
    const { manifest: rawManifest, data: rawData } = readManifestAndData(files);
    const manifest = validateManifest(rawManifest);
    const data = validateBackupData(rawData);
    validateBackupConsistency(manifest, data, Object.keys(files));

    // Ensure archived document bytes are present when not marked missing
    for (const doc of data.documents) {
      if (!doc.file_missing && doc.archive_path) {
        if (!files[doc.archive_path]) {
          throw new Error(
            `В архиве отсутствует файл документа: ${doc.title}`
          );
        }
      }
    }

    return buildPreview(manifest, data);
  }

  /**
   * Replace-restore from archive bytes.
   * Validates fully before touching the live database.
   */
  restoreFromArchive(archiveBytes: Uint8Array): BackupRestoreResult {
    const files = unpackZip(archiveBytes);
    const { manifest: rawManifest, data: rawData } = readManifestAndData(files);
    const manifest = validateManifest(rawManifest);
    const data = validateBackupData(rawData);
    validateBackupConsistency(manifest, data, Object.keys(files));

    // Stage document bytes keyed by document id
    const staged = new Map<
      string,
      { projectId: string; extension: string; bytes: Uint8Array }
    >();

    for (const doc of data.documents) {
      if (doc.file_missing || !doc.archive_path) {
        continue;
      }
      const bytes = files[doc.archive_path];
      if (!bytes) {
        throw new Error(`В архиве отсутствует файл: ${doc.title}`);
      }
      const fileName = doc.archive_path.split('/').pop() ?? '';
      const ext = fileName.includes('.')
        ? fileName.slice(fileName.lastIndexOf('.') + 1)
        : extensionFromRow(doc);
      staged.set(doc.id, {
        projectId: doc.project_id,
        extension: ext,
        bytes,
      });
    }

    const warnings = [...manifest.warnings];
    const generation = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      restoreAtomically(
        this.db,
        data,
        [...staged].map(([documentId, file]) => ({ documentId, ...file })),
        {
          materialize: (file, token) => {
            const tempDir = new Directory(Paths.cache, 'restore-staging', token, file.documentId);
            tempDir.create({ intermediates: true, idempotent: true });
            const tempFile = new File(tempDir, managedDocumentFileName(file.documentId, file.extension));
            tempFile.create({ overwrite: true });
            tempFile.write(file.bytes);
            return materializeRestoreFile({ ...file, sourceUri: tempFile.uri, generation: token });
          },
          remove: (uri, projectId) => { deleteManagedDocumentFile(uri, projectId); },
        },
        generation
      );
    } catch (err) {
      warnings.push(
        err instanceof Error
          ? `Ошибка записи файлов: ${err.message}`
          : 'Ошибка записи файлов'
      );
      throw err;
    } finally {
      // Clear only this operation's staging generation.
      try {
        const staging = new Directory(Paths.cache, 'restore-staging', generation);
        if (staging.exists) staging.delete();
      } catch {
        // ignore
      }
    }

    return {
      preview: buildPreview(manifest, data),
      warnings,
    };
  }
}
