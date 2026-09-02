/**
 * Migration 006 — manual project diary entries for Phase 7 history.
 */

import type { Migration, SqlDatabase } from '../types';

export const migration006ProjectDiary: Migration = {
  version: 6,
  name: '006_project_diary',

  up(db: SqlDatabase): void {
    db.exec(`
      CREATE TABLE project_diary_entries (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('note', 'milestone')),
        title TEXT,
        text TEXT NOT NULL CHECK (length(trim(text)) > 0),
        occurred_at TEXT NOT NULL,
        document_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES knitting_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES project_documents(id) ON DELETE SET NULL
      );

      CREATE INDEX idx_project_diary_project_occurred
        ON project_diary_entries(project_id, occurred_at DESC);

      CREATE INDEX idx_knitting_sessions_project_started
        ON knitting_sessions(project_id, started_at DESC);

      CREATE INDEX idx_counter_events_created
        ON counter_events(created_at);
    `);
  },
};
