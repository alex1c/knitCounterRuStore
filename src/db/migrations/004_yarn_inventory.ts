/**
 * Migration 004 — personal yarn inventory and project yarn links.
 */

import type { Migration, SqlDatabase } from '../types';

export const migration004YarnInventory: Migration = {
  version: 4,
  name: '004_yarn_inventory',

  up(db: SqlDatabase): void {
    db.exec(`
      CREATE TABLE yarns (
        id TEXT PRIMARY KEY NOT NULL,
        brand TEXT,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        color_name TEXT,
        color_code TEXT,
        dye_lot TEXT,
        composition TEXT,
        weight_per_skein_g INTEGER CHECK (
          weight_per_skein_g IS NULL OR weight_per_skein_g > 0
        ),
        length_per_skein_m INTEGER CHECK (
          length_per_skein_m IS NULL OR length_per_skein_m > 0
        ),
        quantity_milliskeins INTEGER NOT NULL DEFAULT 0 CHECK (quantity_milliskeins >= 0),
        purchase_price_minor INTEGER CHECK (
          purchase_price_minor IS NULL OR purchase_price_minor >= 0
        ),
        currency TEXT NOT NULL DEFAULT 'RUB',
        notes TEXT,
        photo_uri TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE project_yarns (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        yarn_id TEXT NOT NULL,
        planned_quantity_milliskeins INTEGER CHECK (
          planned_quantity_milliskeins IS NULL
          OR planned_quantity_milliskeins >= 0
        ),
        used_quantity_milliskeins INTEGER NOT NULL DEFAULT 0 CHECK (
          used_quantity_milliskeins >= 0
        ),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES knitting_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (yarn_id) REFERENCES yarns(id) ON DELETE RESTRICT,
        UNIQUE(project_id, yarn_id)
      );

      CREATE INDEX idx_yarns_name ON yarns(name);
      CREATE INDEX idx_yarns_brand ON yarns(brand);
      CREATE INDEX idx_yarns_updated_at ON yarns(updated_at);
      CREATE INDEX idx_project_yarns_project_id ON project_yarns(project_id);
      CREATE INDEX idx_project_yarns_yarn_id ON project_yarns(yarn_id);

      CREATE TRIGGER project_yarns_scope_insert
      BEFORE INSERT ON project_yarns
      WHEN NOT EXISTS (
        SELECT 1 FROM knitting_projects WHERE id = NEW.project_id
      )
      OR NOT EXISTS (
        SELECT 1 FROM yarns WHERE id = NEW.yarn_id
      )
      BEGIN
        SELECT RAISE(ABORT, 'project yarn link must reference valid project and yarn');
      END;
    `);
  },
};
