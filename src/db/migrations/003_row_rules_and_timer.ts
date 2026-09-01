/**
 * Migration 003 — row rules, knitting sessions, linked counters.
 */

import type { Migration, SqlDatabase } from '../types';

export const migration003RowRulesAndTimer: Migration = {
  version: 3,
  name: '003_row_rules_and_timer',

  up(db: SqlDatabase): void {
    db.exec(`
      CREATE TABLE row_rules (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        project_part_id TEXT,
        counter_id TEXT NOT NULL,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        instruction TEXT NOT NULL CHECK (length(trim(instruction)) > 0),
        rule_type TEXT NOT NULL CHECK (
          rule_type IN ('exact', 'every_n', 'every_n_from', 'list')
        ),
        start_row INTEGER CHECK (start_row IS NULL OR start_row > 0),
        every_n_rows INTEGER CHECK (every_n_rows IS NULL OR every_n_rows > 0),
        exact_row INTEGER CHECK (exact_row IS NULL OR exact_row > 0),
        end_row INTEGER CHECK (end_row IS NULL OR end_row > 0),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES knitting_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (project_part_id) REFERENCES project_parts(id) ON DELETE SET NULL,
        FOREIGN KEY (counter_id) REFERENCES counters(id) ON DELETE CASCADE
      );

      CREATE TABLE row_rule_rows (
        id TEXT PRIMARY KEY NOT NULL,
        rule_id TEXT NOT NULL,
        row_number INTEGER NOT NULL CHECK (row_number > 0),
        FOREIGN KEY (rule_id) REFERENCES row_rules(id) ON DELETE CASCADE,
        UNIQUE(rule_id, row_number)
      );

      CREATE TABLE knitting_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        project_part_id TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES knitting_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (project_part_id) REFERENCES project_parts(id) ON DELETE SET NULL
      );

      CREATE INDEX idx_row_rules_project_id ON row_rules(project_id);
      CREATE INDEX idx_row_rules_counter_id ON row_rules(counter_id);
      CREATE INDEX idx_row_rule_rows_rule_id ON row_rule_rows(rule_id);
      CREATE INDEX idx_knitting_sessions_project_id ON knitting_sessions(project_id);
      CREATE UNIQUE INDEX idx_knitting_sessions_active_project
        ON knitting_sessions(project_id)
        WHERE is_active = 1;

      CREATE TABLE counter_events_v3 (
        id TEXT PRIMARY KEY NOT NULL,
        counter_id TEXT NOT NULL,
        previous_value INTEGER NOT NULL CHECK (previous_value >= 0),
        new_value INTEGER NOT NULL CHECK (new_value >= 0),
        event_type TEXT NOT NULL CHECK (
          event_type IN ('increment', 'decrement', 'set', 'reset')
        ),
        created_at TEXT NOT NULL
      );

      INSERT INTO counter_events_v3 SELECT * FROM counter_events;
      DROP TABLE counter_events;

      CREATE TABLE counters_v3 (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        project_part_id TEXT,
        parent_counter_id TEXT,
        link_type TEXT CHECK (link_type IS NULL OR link_type IN ('follow_main')),
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
        FOREIGN KEY (project_part_id) REFERENCES project_parts(id) ON DELETE SET NULL,
        FOREIGN KEY (parent_counter_id) REFERENCES counters_v3(id) ON DELETE CASCADE
      );

      INSERT INTO counters_v3 (
        id, project_id, project_part_id, parent_counter_id, link_type,
        name, current_value, start_value, target_value, repeat_length,
        is_primary, position, created_at, updated_at
      )
      SELECT
        id, project_id, project_part_id, NULL, NULL,
        name, current_value, start_value, target_value, repeat_length,
        is_primary, position, created_at, updated_at
      FROM counters;

      DROP TABLE counters;
      ALTER TABLE counters_v3 RENAME TO counters;

      CREATE INDEX idx_counters_project_id ON counters(project_id);
      CREATE INDEX idx_counters_project_part_id ON counters(project_part_id);
      CREATE INDEX idx_counters_parent_counter_id ON counters(parent_counter_id);

      CREATE TABLE counter_events_new (
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

      INSERT INTO counter_events_new SELECT * FROM counter_events_v3;
      DROP TABLE counter_events_v3;
      ALTER TABLE counter_events_new RENAME TO counter_events;
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

      CREATE TRIGGER counters_parent_scope_insert
      BEFORE INSERT ON counters
      WHEN NEW.parent_counter_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM counters AS parent
          WHERE parent.id = NEW.parent_counter_id
            AND parent.project_id = NEW.project_id
        )
      BEGIN
        SELECT RAISE(ABORT, 'parent counter must belong to same project');
      END;

      CREATE TRIGGER counters_parent_scope_update
      BEFORE UPDATE OF project_id, parent_counter_id ON counters
      WHEN NEW.parent_counter_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM counters AS parent
          WHERE parent.id = NEW.parent_counter_id
            AND parent.project_id = NEW.project_id
        )
      BEGIN
        SELECT RAISE(ABORT, 'parent counter must belong to same project');
      END;

      CREATE TRIGGER row_rules_scope_insert
      BEFORE INSERT ON row_rules
      WHEN NOT EXISTS (
        SELECT 1 FROM counters
        WHERE id = NEW.counter_id AND project_id = NEW.project_id
      )
      OR (
        NEW.project_part_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM project_parts
          WHERE id = NEW.project_part_id AND project_id = NEW.project_id
        )
      )
      BEGIN
        SELECT RAISE(ABORT, 'row rule scope must match project/counter/part');
      END;

      CREATE TRIGGER row_rules_scope_update
      BEFORE UPDATE ON row_rules
      WHEN NOT EXISTS (
        SELECT 1 FROM counters
        WHERE id = NEW.counter_id AND project_id = NEW.project_id
      )
      OR (
        NEW.project_part_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM project_parts
          WHERE id = NEW.project_part_id AND project_id = NEW.project_id
        )
      )
      BEGIN
        SELECT RAISE(ABORT, 'row rule scope must match project/counter/part');
      END;
    `);
  },
};
