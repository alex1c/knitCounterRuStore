/**
 * Manual project diary entries — CRUD with validation.
 */

import type { DiaryEntryType } from '@/domain/codes';
import { StorageError } from '@/domain/errors';
import type { ProjectDiaryEntry } from '@/domain/types';
import { DomainValidationError } from '@/domain/validation';
import type { SqlDatabase } from '@/db/types';
import { createId } from '@/utils/id';
import { assertIsoTimestamp, nowIsoUtc } from '@/utils/timestamps';

type DiaryRow = {
  id: string;
  project_id: string;
  type: string;
  title: string | null;
  text: string;
  occurred_at: string;
  document_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateDiaryEntryInput = {
  projectId: string;
  type?: DiaryEntryType;
  text: string;
  title?: string | null;
  occurredAt?: string;
  documentId?: string | null;
};

export type UpdateDiaryEntryInput = {
  type?: DiaryEntryType;
  text?: string;
  title?: string | null;
  occurredAt?: string;
  documentId?: string | null;
};

export class ProjectDiaryEntryRepository {
  constructor(private readonly db: SqlDatabase) {}

  create(input: CreateDiaryEntryInput): ProjectDiaryEntry {
    this.assertProjectExists(input.projectId);
    const text = this.validateText(input.text);
    const type = input.type ?? 'note';
    this.validateType(type);
    const title = this.normalizeTitle(input.title);
    const occurredAt = input.occurredAt ?? nowIsoUtc();
    assertIsoTimestamp(occurredAt);
    this.validateDocumentScope(input.projectId, input.documentId ?? null);

    const now = nowIsoUtc();
    const id = createId();

    try {
      this.db.run(
        `INSERT INTO project_diary_entries (
          id, project_id, type, title, text, occurred_at, document_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.projectId,
          type,
          title,
          text,
          occurredAt,
          input.documentId ?? null,
          now,
          now,
        ]
      );
      return this.getById(id)!;
    } catch (err) {
      throw new StorageError('Failed to create diary entry', err);
    }
  }

  update(id: string, projectId: string, input: UpdateDiaryEntryInput): ProjectDiaryEntry {
    const existing = this.getForProject(id, projectId);
    if (!existing) {
      throw new StorageError(`Diary entry not found: ${id}`);
    }

    if (input.type != null) {
      this.validateType(input.type);
    }
    if (input.occurredAt != null) {
      assertIsoTimestamp(input.occurredAt);
    }
    if (input.documentId !== undefined) {
      this.validateDocumentScope(projectId, input.documentId);
    }

    const now = nowIsoUtc();
    const nextText =
      input.text != null ? this.validateText(input.text) : existing.text;

    try {
      this.db.run(
        `UPDATE project_diary_entries SET
          type = ?, title = ?, text = ?, occurred_at = ?, document_id = ?,
          updated_at = ?
        WHERE id = ? AND project_id = ?`,
        [
          input.type ?? existing.type,
          input.title !== undefined
            ? this.normalizeTitle(input.title)
            : existing.title,
          nextText,
          input.occurredAt ?? existing.occurredAt,
          input.documentId !== undefined
            ? input.documentId
            : existing.documentId,
          now,
          id,
          projectId,
        ]
      );
      return this.getById(id)!;
    } catch (err) {
      throw new StorageError('Failed to update diary entry', err);
    }
  }

  delete(id: string, projectId: string): void {
    const existing = this.getForProject(id, projectId);
    if (!existing) {
      throw new StorageError(`Diary entry not found: ${id}`);
    }
    try {
      this.db.run(
        'DELETE FROM project_diary_entries WHERE id = ? AND project_id = ?',
        [id, projectId]
      );
    } catch (err) {
      throw new StorageError('Failed to delete diary entry', err);
    }
  }

  getById(id: string): ProjectDiaryEntry | null {
    try {
      const row = this.db.getFirst<DiaryRow>(
        'SELECT * FROM project_diary_entries WHERE id = ?',
        [id]
      );
      return row ? mapDiaryEntry(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get diary entry', err);
    }
  }

  getForProject(id: string, projectId: string): ProjectDiaryEntry | null {
    try {
      const row = this.db.getFirst<DiaryRow>(
        'SELECT * FROM project_diary_entries WHERE id = ? AND project_id = ?',
        [id, projectId]
      );
      return row ? mapDiaryEntry(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get diary entry', err);
    }
  }

  listForProject(projectId: string, limit = 200): ProjectDiaryEntry[] {
    try {
      const rows = this.db.getAll<DiaryRow>(
        `SELECT * FROM project_diary_entries
         WHERE project_id = ?
         ORDER BY occurred_at DESC
         LIMIT ?`,
        [projectId, limit]
      );
      return rows.map(mapDiaryEntry);
    } catch (err) {
      throw new StorageError('Failed to list diary entries', err);
    }
  }

  private validateText(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new DomainValidationError(
        'Текст заметки не может быть пустым',
        'text'
      );
    }
    return trimmed;
  }

  private normalizeTitle(title: string | null | undefined): string | null {
    if (title == null) {
      return null;
    }
    const trimmed = title.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private validateType(type: DiaryEntryType): void {
    if (type !== 'note' && type !== 'milestone') {
      throw new DomainValidationError('Недопустимый тип записи', 'type');
    }
  }

  private assertProjectExists(projectId: string): void {
    const row = this.db.getFirst<{ id: string }>(
      'SELECT id FROM knitting_projects WHERE id = ?',
      [projectId]
    );
    if (!row) {
      throw new DomainValidationError('Проект не найден', 'projectId');
    }
  }

  private validateDocumentScope(
    projectId: string,
    documentId: string | null
  ): void {
    if (documentId == null) {
      return;
    }
    const row = this.db.getFirst<{ project_id: string }>(
      'SELECT project_id FROM project_documents WHERE id = ?',
      [documentId]
    );
    if (!row || row.project_id !== projectId) {
      throw new DomainValidationError(
        'Документ не принадлежит этому проекту',
        'documentId'
      );
    }
  }
}

function mapDiaryEntry(row: DiaryRow): ProjectDiaryEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as ProjectDiaryEntry['type'],
    title: row.title,
    text: row.text,
    occurredAt: row.occurred_at,
    documentId: row.document_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
