/**
 * Phase 8 tests — backup/restore round-trip, validation, ZIP safety.
 */

import initSqlJs from 'sql.js';
import { zipSync } from 'fflate';

import { createDatabaseFromClient } from '@/db/database';
import { CURRENT_SCHEMA_VERSION } from '@/db/migrations';
import { createSqlJsAdapter } from '@/db/sqlJsAdapter';
import type { SqlDatabase } from '@/db/types';
import {
  applyBackupToDatabase,
  sanitizeSettingsAfterRestore,
} from '@/backup/applyBackup';
import {
  buildBackupPayload,
  snapshotSessionsForBackup,
} from '@/backup/buildBackupPayload';
import {
  DATA_ENTRY,
  MANIFEST_ENTRY,
  BACKUP_FORMAT_VERSION,
} from '@/backup/constants';
import {
  buildPreview,
  validateBackupData,
  validateBackupConsistency,
  validateManifest,
} from '@/backup/validateBackup';
import {
  jsonToBytes,
  packZip,
  readManifestAndData,
  unpackZip,
} from '@/backup/zipCodec';
import {
  assertSafeZipEntries,
  isAllowedBackupEntryPath,
  sanitizeZipEntryPath,
} from '@/backup/zipPathSafety';
import { CounterRepository } from '@/repositories/CounterRepository';
import { KnittingSessionRepository } from '@/repositories/KnittingSessionRepository';
import { ProjectDiaryEntryRepository } from '@/repositories/ProjectDiaryEntryRepository';
import { ProjectDocumentRepository } from '@/repositories/ProjectDocumentRepository';
import { ProjectYarnRepository } from '@/repositories/ProjectYarnRepository';
import { YarnRepository } from '@/repositories/YarnRepository';
import { ProjectService } from '@/services/ProjectService';
import { RowRuleRepository } from '@/repositories/RowRuleRepository';
import { SettingsRepository } from '@/repositories/SettingsRepository';
import { restoreAtomically } from '@/backup/restoreCoordinator';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  return createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
}

function seedDataset(db: SqlDatabase) {
  const service = new ProjectService(db);
  const counters = new CounterRepository(db);
  const sessions = new KnittingSessionRepository(db);
  const yarns = new YarnRepository(db);
  const projectYarns = new ProjectYarnRepository(db);
  const docs = new ProjectDocumentRepository(db);
  const diary = new ProjectDiaryEntryRepository(db);
  const rules = new RowRuleRepository(db);
  const settings = new SettingsRepository(db);

  const { project, primaryCounter, defaultPart } =
    service.createProjectWithDefaults({ name: 'Резервная шапка' });

  counters.incrementCounter(primaryCounter.id);
  counters.incrementCounter(primaryCounter.id);
  counters.undoLastChange(primaryCounter.id);

  rules.createRule({
    projectId: project.id,
    counterId: primaryCounter.id,
    projectPartId: defaultPart.id,
    name: 'Маркер',
    instruction: 'Сменить цвет',
    ruleType: 'exact',
    exactRow: 10,
  });

  const s = sessions.startSession(project.id);
  sessions.stopSession(s.id);
  db.run(
    `UPDATE knitting_sessions SET duration_seconds = 600,
      started_at = '2026-09-01T10:00:00.000Z',
      ended_at = '2026-09-01T10:10:00.000Z'
     WHERE id = ?`,
    [s.id]
  );

  const yarn = yarns.createYarn({
    name: 'Alize Lanagold',
    quantityMilliskeins: 5000,
  });
  const link = projectYarns.attachYarn(project.id, yarn.id);
  projectYarns.setPlannedQuantityMilliskeins(link.id, 3000);
  db.run(
    'UPDATE project_yarns SET used_quantity_milliskeins = 1200 WHERE id = ?',
    [link.id]
  );

  docs.create({
    projectId: project.id,
    type: 'pdf',
    title: 'Схема',
    fileUri: `file:///data/user/0/app/files/projects/${project.id}/documents/doc1.pdf`,
    originalName: 'schema.pdf',
    mimeType: 'application/pdf',
  });

  diary.create({
    projectId: project.id,
    text: 'Примерила — нужно ещё 8 рядов',
    title: 'Прогресс',
    occurredAt: '2026-09-01T18:00:00.000Z',
  });

  settings.setSetting('theme', 'light');

  return { project, primaryCounter, yarn, defaultPart };
}

describe('ZIP path safety', () => {
  test('rejects traversal and absolute paths', () => {
    expect(sanitizeZipEntryPath('../../evil')).toBeNull();
    expect(sanitizeZipEntryPath('/absolute/path')).toBeNull();
    expect(sanitizeZipEntryPath('files/../../../evil')).toBeNull();
    expect(sanitizeZipEntryPath('files\\..\\..\\evil')).toBeNull();
    expect(sanitizeZipEntryPath('C:\\windows\\system32')).toBeNull();
    expect(isAllowedBackupEntryPath('files/projects/x/documents/a.pdf')).toBe(
      true
    );
    expect(() => assertSafeZipEntries(['../../evil'])).toThrow();
  });
});

describe('active session snapshot', () => {
  test('closes active session at backup created_at', () => {
    const snap = snapshotSessionsForBackup(
      [
        {
          id: 's1',
          project_id: 'p1',
          started_at: '2026-09-01T10:00:00.000Z',
          ended_at: null,
          duration_seconds: null,
          is_active: 1,
          created_at: '2026-09-01T10:00:00.000Z',
        },
      ],
      '2026-09-01T10:25:00.000Z'
    );
    expect(snap[0].is_active).toBe(0);
    expect(snap[0].ended_at).toBe('2026-09-01T10:25:00.000Z');
    expect(snap[0].duration_seconds).toBe(25 * 60);
  });
});

describe('backup round-trip', () => {
  test('export → restore into empty DB preserves relationships', async () => {
    const source = await openTestDb();
    const { project, primaryCounter, yarn } = seedDataset(source);

    // Start an active session — must be closed in snapshot
    const sessions = new KnittingSessionRepository(source);
    const activeSession = sessions.startSession(project.id);
    source.run('UPDATE knitting_sessions SET started_at = ? WHERE id = ?', [
      '2026-09-02T11:30:00.000Z', activeSession.id,
    ]);

    const pdfBytes = new TextEncoder().encode('%PDF-1.4 backup-test');
    const built = buildBackupPayload(source, {
      createdAt: '2026-09-02T12:00:00.000Z',
      appVersion: '1.0.0',
      fileReader: {
        readManagedFile: (uri) =>
          uri.includes('/documents/') ? pdfBytes : null,
        extensionForDocument: () => 'pdf',
      },
    });

    expect(
      built.data.tables.knitting_sessions.every((s) => s.is_active === 0)
    ).toBe(true);

    const archive = packZip({
      [MANIFEST_ENTRY]: jsonToBytes(built.manifest),
      [DATA_ENTRY]: jsonToBytes(built.data),
      ...built.fileBytes,
    });

    const unpacked = unpackZip(archive);
    const { manifest: rawM, data: rawD } = readManifestAndData(unpacked);
    const manifest = validateManifest(rawM);
    const data = validateBackupData(rawD);
    expect(manifest.backup_format_version).toBe(BACKUP_FORMAT_VERSION);
    expect(manifest.schema_version).toBe(CURRENT_SCHEMA_VERSION);

    // Rewrite URIs as restore would (without Expo FS)
    for (const row of data.tables.project_documents) {
      const docMeta = data.documents.find((d) => d.id === row.id);
      if (docMeta && !docMeta.file_missing) {
        row.file_uri = `file:///restored/projects/${row.project_id}/documents/${row.id}.pdf`;
      } else {
        row.file_uri = '';
      }
    }

    const target = await openTestDb();
    applyBackupToDatabase(target, data);
    sanitizeSettingsAfterRestore(target);

    expect(target.getAll('PRAGMA foreign_key_check')).toEqual([]);
    expect(
      target.getFirst('SELECT name FROM knitting_projects WHERE id = ?', [
        project.id,
      ])
    ).toEqual({ name: 'Резервная шапка' });

    const restoredCounter = target.getFirst<{ current_value: number }>(
      'SELECT current_value FROM counters WHERE id = ?',
      [primaryCounter.id]
    );
    expect(restoredCounter?.current_value).toBe(1);

    expect(
      target.getFirst('SELECT name FROM yarns WHERE id = ?', [yarn.id])
    ).toEqual({ name: 'Alize Lanagold' });

    const diary = target.getFirst<{ text: string }>(
      'SELECT text FROM project_diary_entries LIMIT 1'
    );
    expect(diary?.text).toContain('8 рядов');

    const doc = target.getFirst<{ file_uri: string }>(
      'SELECT file_uri FROM project_documents LIMIT 1'
    );
    expect(doc?.file_uri).toContain('/restored/projects/');
    expect(doc?.file_uri).not.toContain('file:///data/user/0/app/files');

    const active = target.getFirst(
      'SELECT id FROM knitting_sessions WHERE is_active = 1'
    );
    expect(active).toBeNull();

    expect(buildPreview(manifest, data).projectCount).toBe(1);
  });
});

describe('corrupt backup rejection', () => {
  test('manifest table count mismatch is rejected', async () => {
    const db = await openTestDb();
    seedDataset(db);
    const built = buildBackupPayload(db, {
      createdAt: '2026-09-02T12:00:00.000Z', appVersion: '1.0.0',
      fileReader: { readManagedFile: () => null, extensionForDocument: () => 'pdf' },
    });
    built.manifest.tables.knitting_projects += 1;
    expect(() => validateBackupConsistency(built.manifest, built.data, [MANIFEST_ENTRY, DATA_ENTRY])).toThrow(/Количество записей/);
  });
  test('invalid JSON', () => {
    expect(() =>
      unpackZip(packZip({ [MANIFEST_ENTRY]: new Uint8Array([1, 2, 3]) }))
    ).not.toThrow();
    const files = unpackZip(
      packZip({ [MANIFEST_ENTRY]: new TextEncoder().encode('not-json{') })
    );
    expect(() => readManifestAndData(files)).toThrow(/Повреждённый JSON/);
  });

  test('missing manifest', () => {
    const files = unpackZip(
      packZip({ [DATA_ENTRY]: jsonToBytes({ tables: {}, documents: [] }) })
    );
    expect(() => readManifestAndData(files)).toThrow(/manifest/);
  });

  test('unsupported format version', () => {
    expect(() =>
      validateManifest({
        backup_format_version: 99,
        schema_version: CURRENT_SCHEMA_VERSION,
        created_at: '2026-09-01T00:00:00.000Z',
        tables: {},
        files: 0,
        files_missing: 0,
        warnings: [],
      })
    ).toThrow(/более новой версией/);
  });

  test('orphan child rejected', async () => {
    const db = await openTestDb();
    seedDataset(db);
    const built = buildBackupPayload(db, {
      createdAt: '2026-09-02T12:00:00.000Z',
      appVersion: '1.0.0',
      fileReader: {
        readManagedFile: () => null,
        extensionForDocument: () => 'pdf',
      },
    });
    built.data.tables.counter_events.push({
      id: 'orphan-event-id-0001',
      counter_id: 'missing-counter-id-xx',
      previous_value: 0,
      new_value: 1,
      event_type: 'increment',
      created_at: '2026-09-01T00:00:00.000Z',
    });
    expect(() => validateBackupData(built.data)).toThrow();
  });

  test('invalid enum rejected', async () => {
    const db = await openTestDb();
    seedDataset(db);
    const built = buildBackupPayload(db, {
      createdAt: '2026-09-02T12:00:00.000Z',
      appVersion: '1.0.0',
      fileReader: {
        readManagedFile: () => null,
        extensionForDocument: () => 'pdf',
      },
    });
    built.data.tables.knitting_projects[0].status = 'flying';
    expect(() => validateBackupData(built.data)).toThrow(/Недопустимое/);
  });

  test('invalid timestamp rejected', async () => {
    const db = await openTestDb();
    seedDataset(db);
    const built = buildBackupPayload(db, {
      createdAt: '2026-09-02T12:00:00.000Z',
      appVersion: '1.0.0',
      fileReader: {
        readManagedFile: () => null,
        extensionForDocument: () => 'pdf',
      },
    });
    built.data.tables.project_diary_entries[0].occurred_at = 'yesterday';
    expect(() => validateBackupData(built.data)).toThrow(/метк/);
  });
});

describe('Cyrillic round-trip encoding', () => {
  test('UTF-8 JSON preserves Russian text', async () => {
    const db = await openTestDb();
    seedDataset(db);
    const built = buildBackupPayload(db, {
      createdAt: '2026-09-02T12:00:00.000Z',
      appVersion: '1.0.0',
      fileReader: {
        readManagedFile: () => new Uint8Array([1]),
        extensionForDocument: () => 'pdf',
      },
    });
    const packed = packZip({
      [MANIFEST_ENTRY]: jsonToBytes(built.manifest),
      [DATA_ENTRY]: jsonToBytes(built.data),
      ...built.fileBytes,
    });
    const { data } = readManifestAndData(unpackZip(packed));
    expect(data.tables.knitting_projects[0].name).toBe('Резервная шапка');
    expect(data.tables.project_diary_entries[0].text).toContain('рядов');
  });
});

describe('restore filesystem/database atomicity', () => {
  test('file materialization failure preserves old database and old files', async () => {
    const oldDb = await openTestDb();
    const old = seedDataset(oldDb);
    const source = await openTestDb();
    seedDataset(source);
    const built = buildBackupPayload(source, {
      createdAt: '2026-09-02T12:00:00.000Z', appVersion: '1.0.0',
      fileReader: { readManagedFile: () => new Uint8Array([1]), extensionForDocument: () => 'pdf' },
    });
    const oldUri = oldDb.getFirst<{ file_uri: string }>('SELECT file_uri FROM project_documents')!.file_uri;
    const removed: string[] = [];
    expect(() => restoreAtomically(oldDb, built.data, [
      { documentId: String(built.data.tables.project_documents[0].id), projectId: String(built.data.tables.project_documents[0].project_id), extension: 'pdf', bytes: new Uint8Array([1]) },
      { documentId: 'second-doc-id', projectId: old.project.id, extension: 'pdf', bytes: new Uint8Array([2]) },
    ], {
      materialize: (file) => { if (file.documentId === 'second-doc-id') throw new Error('disk full'); return `file:///new/${file.documentId}.pdf`; },
      remove: (uri) => { removed.push(uri); },
    }, 'generation')).toThrow('disk full');
    expect(oldDb.getFirst('SELECT id FROM knitting_projects WHERE id = ?', [old.project.id])).not.toBeNull();
    expect(oldDb.getFirst<{ file_uri: string }>('SELECT file_uri FROM project_documents')!.file_uri).toBe(oldUri);
    expect(removed).toEqual([expect.stringContaining('file:///new/')]);
  });

  test('database failure removes new generation and preserves same-id old URI', async () => {
    const db = await openTestDb();
    seedDataset(db);
    const oldUri = db.getFirst<{ file_uri: string }>('SELECT file_uri FROM project_documents')!.file_uri;
    const built = buildBackupPayload(db, {
      createdAt: '2026-09-02T12:00:00.000Z', appVersion: '1.0.0',
      fileReader: { readManagedFile: () => new Uint8Array([1]), extensionForDocument: () => 'pdf' },
    });
    built.data.tables.knitting_projects[0].name = null;
    const doc = built.data.tables.project_documents[0];
    const newUri = `file:///managed/${doc.id}-restore-generation.pdf`;
    const removed: string[] = [];
    expect(() => restoreAtomically(db, built.data, [{ documentId: String(doc.id), projectId: String(doc.project_id), extension: 'pdf', bytes: new Uint8Array([1]) }], {
      materialize: () => newUri,
      remove: (uri) => { removed.push(uri); },
    }, 'generation')).toThrow();
    expect(db.getFirst<{ file_uri: string }>('SELECT file_uri FROM project_documents')!.file_uri).toBe(oldUri);
    expect(removed).toContain(newUri);
    expect(removed).not.toContain(oldUri);
  });

  test('unpack rejects unsafe entries instead of silently discarding them', () => {
    expect(() => unpackZip(zipSync({ '../../evil': new Uint8Array([1]) }))).toThrow(/Небезопасный/);
  });
});
