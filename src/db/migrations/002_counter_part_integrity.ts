import type { Migration, SqlDatabase } from '../types';

/**
 * Keeps counters/history when a part is removed and enforces that an attached
 * part belongs to the counter's project. Tables are rebuilt because SQLite
 * cannot alter foreign-key actions in place.
 */
export const migration002CounterPartIntegrity: Migration = {
  version: 2,
  name: '002_counter_part_integrity',

  up(db: SqlDatabase): void {
    db.exec(`
      CREATE TABLE counters_v2 (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        project_part_id TEXT,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        current_value INTEGER NOT NULL DEFAULT 0 CHECK (current_value >= 0),
        start_value INTEGER NOT NULL DEFAULT 0 CHECK (start_value >= 0),
        target_value INTEGER CHECK (target_value IS NULL OR target_value >= 0),
        repeat_length INTEGER CHECK (repeat_length IS NULL OR repeat_length > 0),
        is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
        position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES knitting_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (project_part_id) REFERENCES project_parts(id) ON DELETE SET NULL
      );

      CREATE TABLE counter_events_v2 (
        id TEXT PRIMARY KEY NOT NULL,
        counter_id TEXT NOT NULL,
        previous_value INTEGER NOT NULL CHECK (previous_value >= 0),
        new_value INTEGER NOT NULL CHECK (new_value >= 0),
        event_type TEXT NOT NULL CHECK (
          event_type IN ('increment', 'decrement', 'set', 'reset')
        ),
        created_at TEXT NOT NULL,
        FOREIGN KEY (counter_id) REFERENCES counters_v2(id) ON DELETE CASCADE
      );

      INSERT INTO counters_v2 SELECT * FROM counters;
      INSERT INTO counter_events_v2 SELECT * FROM counter_events;
      DROP TABLE counter_events;
      DROP TABLE counters;
      ALTER TABLE counters_v2 RENAME TO counters;
      ALTER TABLE counter_events_v2 RENAME TO counter_events;

      CREATE INDEX idx_counters_project_id ON counters(project_id);
      CREATE INDEX idx_counters_project_part_id ON counters(project_part_id);
      CREATE INDEX idx_counter_events_counter_id ON counter_events(counter_id);

      CREATE TRIGGER counters_part_project_insert
      BEFORE INSERT ON counters
      WHEN NEW.project_part_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM project_parts
          WHERE id = NEW.project_part_id AND project_id = NEW.project_id
        )
      BEGIN
        SELECT RAISE(ABORT, 'counter part must belong to counter project');
      END;

      CREATE TRIGGER counters_part_project_update
      BEFORE UPDATE OF project_id, project_part_id ON counters
      WHEN NEW.project_part_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM project_parts
          WHERE id = NEW.project_part_id AND project_id = NEW.project_id
        )
      BEGIN
        SELECT RAISE(ABORT, 'counter part must belong to counter project');
      END;
    `);
  },
};
