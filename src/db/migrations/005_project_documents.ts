/**
 * Migration 005 — project documents (PDFs and reference images).
 */

import type { Migration, SqlDatabase } from '../types';

export const migration005ProjectDocuments: Migration = {
  version: 5,
  name: '005_project_documents',

  up(db: SqlDatabase): void {
    db.exec(`
      CREATE TABLE project_documents (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('pdf', 'image', 'other')),
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        original_name TEXT,
        file_uri TEXT NOT NULL,
        mime_type TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES knitting_projects(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_project_documents_project_id
        ON project_documents(project_id);
      CREATE INDEX idx_project_documents_sort
        ON project_documents(project_id, sort_order);
    `);
  },
};
