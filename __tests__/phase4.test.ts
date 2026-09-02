/**
 * Phase 4 integration tests — yarn inventory and project usage.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/db/database';
import { runMigrations } from '@/db/migrate';
import { MIGRATIONS } from '@/db/migrations';
import { createSqlJsAdapter } from '@/db/sqlJsAdapter';
import type { SqlDatabase } from '@/db/types';
import { DomainValidationError } from '@/domain/validation';
import { ProjectRepository } from '@/repositories/ProjectRepository';
import { ProjectYarnRepository } from '@/repositories/ProjectYarnRepository';
import { RowRuleRepository } from '@/repositories/RowRuleRepository';
import { YarnRepository } from '@/repositories/YarnRepository';
import { ProjectService } from '@/services/ProjectService';
import { YarnUsageService } from '@/services/YarnUsageService';
import {
  calcTotalLengthM,
  calcTotalWeightG,
  calcInventoryValueMinor,
  MILLISKEINS_PER_SKEIN,
  skeinsToMilliskeins,
} from '@/utils/yarnQuantity';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

describe('YarnRepository', () => {
  test('create, edit, fractional and zero quantity', async () => {
    const db = await openTestDb();
    const yarns = new YarnRepository(db);

    const created = yarns.createYarn({
      name: 'Lanagold',
      brand: 'Alize',
      quantityMilliskeins: skeinsToMilliskeins(4.3),
      weightPerSkeinG: 100,
      lengthPerSkeinM: 240,
      purchasePriceMinor: 35000,
    });
    expect(created.quantityMilliskeins).toBe(4300);

    const updated = yarns.updateYarn(created.id, {
      quantityMilliskeins: 0,
      colorCode: '62',
      dyeLot: '1814',
    });
    expect(updated.quantityMilliskeins).toBe(0);
    expect(updated.colorCode).toBe('62');
  });

  test('rejects blank name and negative quantity', async () => {
    const db = await openTestDb();
    const yarns = new YarnRepository(db);

    expect(() =>
      yarns.createYarn({ name: '  ', quantityMilliskeins: 1000 })
    ).toThrow(DomainValidationError);

    expect(() =>
      yarns.createYarn({ name: 'Test', quantityMilliskeins: -1 })
    ).toThrow(DomainValidationError);
  });

  test('rejects negative price and invalid weight', async () => {
    const db = await openTestDb();
    const yarns = new YarnRepository(db);

    expect(() =>
      yarns.createYarn({
        name: 'Test',
        purchasePriceMinor: -100,
      })
    ).toThrow(DomainValidationError);

    expect(() =>
      yarns.createYarn({
        name: 'Test',
        weightPerSkeinG: 0,
      })
    ).toThrow(DomainValidationError);
  });

  test('delete unattached yarn', async () => {
    const db = await openTestDb();
    const yarns = new YarnRepository(db);
    const yarn = yarns.createYarn({ name: 'Temp', quantityMilliskeins: 1000 });
    yarns.deleteYarn(yarn.id);
    expect(yarns.getYarnById(yarn.id)).toBeNull();
  });

  test('blocks delete when linked to project', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const yarns = new YarnRepository(db);
    const projectYarns = new ProjectYarnRepository(db);
    const { project } = service.createProjectWithDefaults({ name: 'P' });
    const yarn = yarns.createYarn({ name: 'Linked', quantityMilliskeins: 2000 });
    projectYarns.attachYarn(project.id, yarn.id);
    expect(() => yarns.deleteYarn(yarn.id)).toThrow();
  });

  test('search finds by dye lot', async () => {
    const db = await openTestDb();
    const yarns = new YarnRepository(db);
    yarns.createYarn({
      name: 'Jeans',
      brand: 'YarnArt',
      dyeLot: '1814',
      quantityMilliskeins: 1000,
    });
    const found = yarns.searchYarns('1814');
    expect(found).toHaveLength(1);
  });
});

describe('Project yarn linking', () => {
  test('attach, duplicate rejected, detach', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const yarns = new YarnRepository(db);
    const projectYarns = new ProjectYarnRepository(db);
    const { project } = service.createProjectWithDefaults({ name: 'Свитер' });
    const yarn = yarns.createYarn({ name: 'Cotton', quantityMilliskeins: 5000 });

    const link = projectYarns.attachYarn(project.id, yarn.id);
    expect(link.usedQuantityMilliskeins).toBe(0);

    expect(() => projectYarns.attachYarn(project.id, yarn.id)).toThrow();

    projectYarns.detachYarn(link.id);
    expect(projectYarns.listLinksByProject(project.id)).toHaveLength(0);
  });

  test('project delete leaves yarn inventory intact', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const projects = new ProjectRepository(db);
    const yarns = new YarnRepository(db);
    const projectYarns = new ProjectYarnRepository(db);
    const usage = new YarnUsageService(db);

    const { project } = service.createProjectWithDefaults({ name: 'Del' });
    const yarn = yarns.createYarn({ name: 'Stay', quantityMilliskeins: 5000 });
    const link = projectYarns.attachYarn(project.id, yarn.id);
    usage.recordUsage(link.id, 1500);

    projects.deleteProject(project.id);
    expect(yarns.getYarnById(yarn.id)?.quantityMilliskeins).toBe(3500);
    expect(projectYarns.listLinksByProject(project.id)).toHaveLength(0);
  });
});

describe('YarnUsageService', () => {
  test('record usage decreases inventory and increases used', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const yarns = new YarnRepository(db);
    const projectYarns = new ProjectYarnRepository(db);
    const usage = new YarnUsageService(db);

    const { project } = service.createProjectWithDefaults({ name: 'U' });
    const yarn = yarns.createYarn({ name: 'Wool', quantityMilliskeins: 5000 });
    const link = projectYarns.attachYarn(project.id, yarn.id);

    usage.recordUsage(link.id, 1500);

    expect(yarns.getYarnById(yarn.id)?.quantityMilliskeins).toBe(3500);
    expect(
      projectYarns.getLinkById(link.id)?.usedQuantityMilliskeins
    ).toBe(1500);
  });

  test('rejects insufficient inventory', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const yarns = new YarnRepository(db);
    const projectYarns = new ProjectYarnRepository(db);
    const usage = new YarnUsageService(db);

    const { project } = service.createProjectWithDefaults({ name: 'U' });
    const yarn = yarns.createYarn({ name: 'Wool', quantityMilliskeins: 500 });
    const link = projectYarns.attachYarn(project.id, yarn.id);

    expect(() => usage.recordUsage(link.id, 1000)).toThrow();
    expect(yarns.getYarnById(yarn.id)?.quantityMilliskeins).toBe(500);
  });

  test('correction adjusts inventory by delta', async () => {
    const db = await openTestDb();
    const service = new ProjectService(db);
    const yarns = new YarnRepository(db);
    const projectYarns = new ProjectYarnRepository(db);
    const usage = new YarnUsageService(db);

    const { project } = service.createProjectWithDefaults({ name: 'U' });
    const yarn = yarns.createYarn({ name: 'Wool', quantityMilliskeins: 5000 });
    const link = projectYarns.attachYarn(project.id, yarn.id);
    usage.recordUsage(link.id, 2000);

    usage.adjustUsedQuantity(link.id, 1500);
    expect(yarns.getYarnById(yarn.id)?.quantityMilliskeins).toBe(3500);
    expect(
      projectYarns.getLinkById(link.id)?.usedQuantityMilliskeins
    ).toBe(1500);

    usage.adjustUsedQuantity(link.id, 2500);
    expect(yarns.getYarnById(yarn.id)?.quantityMilliskeins).toBe(2500);
    expect(
      projectYarns.getLinkById(link.id)?.usedQuantityMilliskeins
    ).toBe(2500);
  });
});

describe('derived yarn totals', () => {
  test('weight, length, value with missing metadata', () => {
    expect(calcTotalWeightG(4300, 100)).toBe(430);
    expect(calcTotalLengthM(4300, 240)).toBe(1032);
    expect(calcInventoryValueMinor(2000, 35000)).toBe(70000);
    expect(calcTotalWeightG(1000, null)).toBeNull();
    expect(calcInventoryValueMinor(1000, null)).toBeNull();
  });
});

describe('migration v3 to v4', () => {
  test('preserves phase 3 data', async () => {
    const SQL = await initSqlJs();
    const db = createSqlJsAdapter(new SQL.Database());
    db.exec('PRAGMA foreign_keys = ON;');
    runMigrations(db, MIGRATIONS.slice(0, 3), 3);

    const service = new ProjectService(db);
    const rules = new RowRuleRepository(db);
    const { project, primaryCounter } = service.createProjectWithDefaults({
      name: 'Phase3',
    });
    rules.createRule({
      projectId: project.id,
      counterId: primaryCounter.id,
      name: 'Rule',
      instruction: 'Test',
      ruleType: 'exact',
      exactRow: 10,
    });

    runMigrations(db, MIGRATIONS.filter((m) => m.version <= 4), 4);
    expect(db.getUserVersion()).toBe(4);

    expect(service.createProjectWithDefaults({ name: 'After' }).project).toBeTruthy();
    expect(rules.listRulesByProject(project.id)).toHaveLength(1);

    const fk = db.getAll<{ fk: string }>('PRAGMA foreign_key_check');
    expect(fk).toHaveLength(0);

    const tables = db.getAll<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('yarns', 'project_yarns')`
    );
    expect(tables).toHaveLength(2);
  });
});

describe('quantity constants', () => {
  test('milliskeins conversion', () => {
    expect(MILLISKEINS_PER_SKEIN).toBe(1000);
    expect(skeinsToMilliskeins(1.5)).toBe(1500);
  });
});
