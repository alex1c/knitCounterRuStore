/**
 * Migration 001 — initial knitting app schema (schema version 1).
 */

import type { Migration, SqlDatabase } from '../types';

/**
 * Creates all Phase 1 tables, foreign keys, and indexes.
 * Foreign keys must already be enabled by the opener (PRAGMA foreign_keys = ON).
 */
export const migration001Initial: Migration = {
  version: 1,
  name: '001_initial',

  up(db: SqlDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS knitting_projects (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        project_type TEXT,
        craft_type TEXT NOT NULL CHECK (craft_type IN ('knitting', 'crochet')),
        status TEXT NOT NULL CHECK (
          status IN ('planned', 'active', 'paused', 'completed', 'archived')
        ),
        started_at TEXT,
        completed_at TEXT,
        notes TEXT,
        photo_uri TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS project_parts (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES knitting_projects(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS counters (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        project_part_id TEXT,
        name TEXT NOT NULL,
        current_value INTEGER NOT NULL DEFAULT 0 CHECK (current_value >= 0),
        start_value INTEGER NOT NULL DEFAULT 0 CHECK (start_value >= 0),
        target_value INTEGER CHECK (target_value IS NULL OR target_value >= 0),
        repeat_length INTEGER CHECK (repeat_length IS NULL OR repeat_length > 0),
        is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES knitting_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (project_part_id) REFERENCES project_parts(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS counter_events (
        id TEXT PRIMARY KEY NOT NULL,
        counter_id TEXT NOT NULL,
        previous_value INTEGER NOT NULL CHECK (previous_value >= 0),
        new_value INTEGER NOT NULL CHECK (new_value >= 0),
        event_type TEXT NOT NULL CHECK (
          event_type IN ('increment', 'decrement', 'set', 'reset')
        ),
        created_at TEXT NOT NULL,
        FOREIGN KEY (counter_id) REFERENCES counters(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_knitting_projects_status
        ON knitting_projects(status);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_project_parts_project_id
        ON project_parts(project_id);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_counters_project_id
        ON counters(project_id);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_counters_project_part_id
        ON counters(project_part_id);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_counter_events_counter_id
        ON counter_events(counter_id);
    `);
  },
};
