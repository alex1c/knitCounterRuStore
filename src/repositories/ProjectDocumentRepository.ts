/**
 * Project document repository — metadata CRUD in SQLite.
 */

import type { ProjectDocumentType } from '@/domain/codes';
import { validateDocumentTitle } from '@/domain/documentValidation';
import { StorageError } from '@/domain/errors';
import type { ProjectDocument } from '@/domain/types';
import type { SqlDatabase } from '@/db/types';
import { createId } from '@/utils/id';
import { nowIsoUtc } from '@/utils/timestamps';

type ProjectDocumentRow = {
  id: string;
  project_id: string;
  type: ProjectDocumentType;
  title: string;
  original_name: string | null;
  file_uri: string;
  mime_type: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CreateProjectDocumentInput = {
  id?: string;
  projectId: string;
  type: ProjectDocumentType;
  title: string;
  originalName?: string | null;
  fileUri: string;
  mimeType?: string | null;
  sortOrder?: number;
};

export class ProjectDocumentRepository {
  constructor(private readonly db: SqlDatabase) {}

  create(input: CreateProjectDocumentInput): ProjectDocument {
    const title = validateDocumentTitle(input.title);
    const now = nowIsoUtc();
    const id = input.id ?? createId();
    const sortOrder =
      input.sortOrder ??
      this.getNextSortOrder(input.projectId);

    try {
      this.db.run(
        `INSERT INTO project_documents (
          id, project_id, type, title, original_name, file_uri, mime_type,
          sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.projectId,
          input.type,
          title,
          input.originalName?.trim() || null,
          input.fileUri,
          input.mimeType ?? null,
          sortOrder,
          now,
          now,
        ]
      );
      return this.getById(id)!;
    } catch (err) {
      throw new StorageError('Failed to create project document', err);
    }
  }

  getById(id: string): ProjectDocument | null {
    try {
      const row = this.db.getFirst<ProjectDocumentRow>(
        'SELECT * FROM project_documents WHERE id = ?',
        [id]
      );
      return row ? mapProjectDocument(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get project document', err);
    }
  }

  getByIdForProject(id: string, projectId: string): ProjectDocument | null {
    const doc = this.getById(id);
    if (!doc || doc.projectId !== projectId) return null;
    return doc;
  }

  listForProject(projectId: string): ProjectDocument[] {
    try {
      const rows = this.db.getAll<ProjectDocumentRow>(
        `SELECT * FROM project_documents
         WHERE project_id = ?
         ORDER BY sort_order ASC, created_at ASC`,
        [projectId]
      );
      return rows.map(mapProjectDocument);
    } catch (err) {
      throw new StorageError('Failed to list project documents', err);
    }
  }

  rename(id: string, title: string): ProjectDocument {
    const nextTitle = validateDocumentTitle(title);
    const now = nowIsoUtc();
    try {
      const result = this.db.run(
        `UPDATE project_documents SET title = ?, updated_at = ? WHERE id = ?`,
        [nextTitle, now, id]
      );
      if (result.changes === 0) {
        throw new StorageError(`Project document not found: ${id}`);
      }
      return this.getById(id)!;
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to rename project document', err);
    }
  }

  deleteRecord(id: string): ProjectDocument | null {
    const existing = this.getById(id);
    if (!existing) return null;
    try {
      this.db.run('DELETE FROM project_documents WHERE id = ?', [id]);
      return existing;
    } catch (err) {
      throw new StorageError('Failed to delete project document', err);
    }
  }

  countForProject(projectId: string): number {
    try {
      const row = this.db.getFirst<{ count: number }>(
        'SELECT COUNT(*) AS count FROM project_documents WHERE project_id = ?',
        [projectId]
      );
      return row?.count ?? 0;
    } catch (err) {
      throw new StorageError('Failed to count project documents', err);
    }
  }

  private getNextSortOrder(projectId: string): number {
    const row = this.db.getFirst<{ maxOrder: number | null }>(
      'SELECT MAX(sort_order) AS maxOrder FROM project_documents WHERE project_id = ?',
      [projectId]
    );
    return (row?.maxOrder ?? -1) + 1;
  }
}

function mapProjectDocument(row: ProjectDocumentRow): ProjectDocument {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    title: row.title,
    originalName: row.original_name,
    fileUri: row.file_uri,
    mimeType: row.mime_type,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
