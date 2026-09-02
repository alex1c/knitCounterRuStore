/**
 * Phase 6 tests — project documents migration, CRUD, and path safety.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/db/database';
import { runMigrations } from '@/db/migrate';
import { MIGRATIONS, CURRENT_SCHEMA_VERSION } from '@/db/migrations';
import { createSqlJsAdapter } from '@/db/sqlJsAdapter';
import type { SqlDatabase } from '@/db/types';
import { DomainValidationError } from '@/domain/validation';
import { ProjectDocumentRepository } from '@/repositories/ProjectDocumentRepository';
import { ProjectRepository } from '@/repositories/ProjectRepository';
import { YarnRepository } from '@/repositories/YarnRepository';
import { ProjectService } from '@/services/ProjectService';
import {
  isManagedDocumentUri,
  isExternalPickerUri,
  managedDocumentFileName,
} from '@/utils/managedDocumentPaths';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  return createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
}

async function openAtVersion(version: number): Promise<SqlDatabase> {
  const db = await openTestDb();
  runMigrations(db, MIGRATIONS.filter((m) => m.version <= version));
  return db;
}

describe('migration v4 to v5', () => {
  test('preserves yarn/project data and creates project_documents', async () => {
    const db = await openAtVersion(4);
    const service = new ProjectService(db);
    const yarns = new YarnRepository(db);
    const { project } = service.createProjectWithDefaults({ name: 'Doc Test' });
    const yarn = yarns.createYarn({ name: 'Wool', quantityMilliskeins: 1000 });

    runMigrations(db, MIGRATIONS);
    expect(db.getUserVersion()).toBe(CURRENT_SCHEMA_VERSION);

    expect(db.getFirst('SELECT id FROM knitting_projects WHERE id = ?', [project.id])).toBeTruthy();
    expect(db.getFirst('SELECT id FROM yarns WHERE id = ?', [yarn.id])).toBeTruthy();
    expect(
      db.getFirst(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='project_documents'"
      )
    ).toBeTruthy();
  });

  test('opening already-v5 DB is idempotent', async () => {
    const db = await openAtVersion(CURRENT_SCHEMA_VERSION);
    runMigrations(db, MIGRATIONS);
    expect(db.getUserVersion()).toBe(CURRENT_SCHEMA_VERSION);
  });
});

describe('ProjectDocumentRepository', () => {
  test('create, list, rename, delete', async () => {
    const db = await openAtVersion(CURRENT_SCHEMA_VERSION);
    const projects = new ProjectRepository(db);
    const docs = new ProjectDocumentRepository(db);
    const project = projects.createProject({ name: 'With docs' });

    const managedRoot = 'file:///data/user/0/app/files/projects';
    const created = docs.create({
      projectId: project.id,
      type: 'pdf',
      title: 'Pattern',
      fileUri: `${managedRoot}/${project.id}/documents/doc1.pdf`,
      originalName: 'pattern.pdf',
      mimeType: 'application/pdf',
    });

    expect(docs.listForProject(project.id)).toHaveLength(1);
    const renamed = docs.rename(created.id, 'Main pattern');
    expect(renamed.title).toBe('Main pattern');

    expect(() => docs.rename(created.id, '   ')).toThrow(DomainValidationError);

    const deleted = docs.deleteRecord(created.id);
    expect(deleted?.id).toBe(created.id);
    expect(docs.listForProject(project.id)).toHaveLength(0);
  });

  test('cross-project lookup protection', async () => {
    const db = await openAtVersion(CURRENT_SCHEMA_VERSION);
    const projects = new ProjectRepository(db);
    const docs = new ProjectDocumentRepository(db);
    const p1 = projects.createProject({ name: 'P1' });
    const p2 = projects.createProject({ name: 'P2' });
    const doc = docs.create({
      projectId: p1.id,
      type: 'image',
      title: 'Chart',
      fileUri: 'file:///managed/projects/p1/documents/x.png',
    });

    expect(docs.getByIdForProject(doc.id, p1.id)?.id).toBe(doc.id);
    expect(docs.getByIdForProject(doc.id, p2.id)).toBeNull();
  });
});

describe('managed document path safety', () => {
  const root = 'file:///data/user/0/app/files/projects';
  const projectId = 'proj-1';
  const docId = 'doc-abc';

  test('allows managed document path cleanup', () => {
    const uri = `${root}/${projectId}/documents/${managedDocumentFileName(docId, 'pdf')}`;
    expect(isManagedDocumentUri(uri, projectId, root)).toBe(true);
  });

  test('rejects external picker URI for managed cleanup', () => {
    const pickerUri = 'content://com.android.providers.downloads/document/123';
    expect(isExternalPickerUri(pickerUri, root)).toBe(true);
    expect(isManagedDocumentUri(pickerUri, projectId, root)).toBe(false);
  });

  test('rejects parent traversal paths', () => {
    const uri = `${root}/${projectId}/documents/../other/secret.pdf`;
    expect(isManagedDocumentUri(uri, projectId, root)).toBe(false);
  });

  test('rejects unrelated app document path', () => {
    const uri = 'file:///data/user/0/app/files/other/notes.pdf';
    expect(isManagedDocumentUri(uri, projectId, root)).toBe(false);
  });
});

describe('project delete with documents', () => {
  test('cascades document records from database', async () => {
    const db = await openAtVersion(CURRENT_SCHEMA_VERSION);
    const service = new ProjectService(db);
    const docs = new ProjectDocumentRepository(db);
    const { project } = service.createProjectWithDefaults({ name: 'Delete me' });

    docs.create({
      projectId: project.id,
      type: 'pdf',
      title: 'Doc',
      fileUri: `file:///data/user/0/app/files/projects/${project.id}/documents/x.pdf`,
    });

    service.deleteProject(project.id);
    expect(docs.listForProject(project.id)).toHaveLength(0);
    expect(new YarnRepository(db).listYarns()).toBeDefined();
  });
});
