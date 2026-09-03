/**
 * Pure ZIP pack/unpack helpers using fflate (no native modules).
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import {
  DATA_ENTRY,
  MANIFEST_ENTRY,
  MAX_ARCHIVE_BYTES,
  MAX_SINGLE_ENTRY_BYTES,
  MAX_UNCOMPRESSED_BYTES,
  MAX_ZIP_ENTRIES,
} from './constants';
import {
  assertSafeZipEntries,
  isAllowedBackupEntryPath,
  sanitizeZipEntryPath,
} from './zipPathSafety';
import type { BackupDataPayload, BackupManifest } from './types';

export type ZipFileMap = Record<string, Uint8Array>;

/** Packs a map of relative paths → bytes into a ZIP buffer. */
export function packZip(files: ZipFileMap): Uint8Array {
  const paths = Object.keys(files);
  if (paths.length > MAX_ZIP_ENTRIES) {
    throw new Error('Слишком много файлов в резервной копии');
  }
  assertSafeZipEntries(paths);

  let uncompressed = 0;
  for (const bytes of Object.values(files)) {
    if (bytes.byteLength > MAX_SINGLE_ENTRY_BYTES) {
      throw new Error('Файл в резервной копии слишком большой');
    }
    uncompressed += bytes.byteLength;
  }
  if (uncompressed > MAX_UNCOMPRESSED_BYTES) {
    throw new Error('Резервная копия слишком большая');
  }

  const zipped = zipSync(files, { level: 6 });
  if (zipped.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error('Сжатый архив резервной копии слишком большой');
  }
  return zipped;
}

/** Unpacks a ZIP buffer into a sanitized path → bytes map. */
export function unpackZip(archiveBytes: Uint8Array): ZipFileMap {
  if (archiveBytes.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error('Файл резервной копии слишком большой');
  }

  let unzipped: ZipFileMap;
  const seen = new Set<string>();
  let entryCount = 0;
  let declaredUncompressed = 0;
  try {
    unzipped = unzipSync(archiveBytes, {
      filter: (file) => {
        // Skip directory markers
        if (file.name.endsWith('/')) {
          return false;
        }
        const safe = sanitizeZipEntryPath(file.name);
        if (!safe || !isAllowedBackupEntryPath(safe)) {
          throw new Error(`Небезопасный путь в архиве: ${file.name}`);
        }
        if (seen.has(safe)) {
          throw new Error(`Дублирующийся путь в архиве: ${safe}`);
        }
        seen.add(safe);
        entryCount += 1;
        if (entryCount > MAX_ZIP_ENTRIES) {
          throw new Error('Слишком много файлов в архиве');
        }
        if (file.originalSize > MAX_SINGLE_ENTRY_BYTES) {
          throw new Error(`Файл слишком большой: ${safe}`);
        }
        declaredUncompressed += file.originalSize;
        if (declaredUncompressed > MAX_UNCOMPRESSED_BYTES) {
          throw new Error('Распакованный архив слишком большой');
        }
        return true;
      },
    });
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `Не удалось прочитать архив: ${err.message}`
        : 'Не удалось прочитать архив'
    );
  }

  const result: ZipFileMap = {};
  let uncompressed = 0;
  const entries = Object.entries(unzipped);

  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error('Слишком много файлов в архиве');
  }

  for (const [rawName, bytes] of entries) {
    const safe = sanitizeZipEntryPath(rawName);
    if (!safe || !isAllowedBackupEntryPath(safe)) {
      throw new Error(`Небезопасный путь в архиве: ${rawName}`);
    }
    if (bytes.byteLength > MAX_SINGLE_ENTRY_BYTES) {
      throw new Error(`Файл слишком большой: ${safe}`);
    }
    uncompressed += bytes.byteLength;
    if (uncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw new Error('Распакованный архив слишком большой');
    }
    result[safe] = bytes;
  }

  return result;
}

/** Reads and parses UTF-8 JSON from a ZIP entry. */
export function readJsonEntry<T>(files: ZipFileMap, name: string): T {
  const bytes = files[name];
  if (!bytes) {
    throw new Error(`В архиве отсутствует ${name}`);
  }
  try {
    return JSON.parse(strFromU8(bytes)) as T;
  } catch {
    throw new Error(`Повреждённый JSON: ${name}`);
  }
}

/** Encodes an object as UTF-8 JSON bytes. */
export function jsonToBytes(value: unknown): Uint8Array {
  return strToU8(JSON.stringify(value));
}

/** Extracts manifest + data from an unpacked ZIP. */
export function readManifestAndData(files: ZipFileMap): {
  manifest: BackupManifest;
  data: BackupDataPayload;
} {
  const manifest = readJsonEntry<BackupManifest>(files, MANIFEST_ENTRY);
  const data = readJsonEntry<BackupDataPayload>(files, DATA_ENTRY);
  return { manifest, data };
}
