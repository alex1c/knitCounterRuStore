/**
 * Yarn usage service — atomic inventory adjustments with project tracking.
 *
 * Source of truth:
 * - yarns.quantity_milliskeins = physical stock on hand
 * - project_yarns.used_quantity_milliskeins = cumulative usage per project link
 *
 * Recording usage decrements inventory and increments project used in one transaction.
 * Correcting used amount adjusts inventory by the delta (return or consume).
 */

import { StorageError } from '@/domain/errors';
import type { ProjectYarn } from '@/domain/types';
import { validateQuantityMilliskeins } from '@/domain/yarnValidation';
import type { SqlDatabase } from '@/db/types';
import { ProjectYarnRepository } from '@/repositories/ProjectYarnRepository';
import { YarnRepository } from '@/repositories/YarnRepository';

export class YarnUsageService {
  private readonly db: SqlDatabase;
  private readonly yarns: YarnRepository;
  private readonly projectYarns: ProjectYarnRepository;

  constructor(db: SqlDatabase) {
    this.db = db;
    this.yarns = new YarnRepository(db);
    this.projectYarns = new ProjectYarnRepository(db);
  }

  /** Records additional yarn consumption for a project link. */
  recordUsage(linkId: string, amountMilliskeins: number): ProjectYarn {
    if (!Number.isSafeInteger(amountMilliskeins) || amountMilliskeins <= 0) {
      throw new StorageError('Укажите положительное количество');
    }

    return this.db.withTransaction(() => {
      const link = this.projectYarns.getLinkById(linkId);
      if (!link) {
        throw new StorageError(`Project yarn link not found: ${linkId}`);
      }

      const yarn = this.yarns.getYarnById(link.yarnId);
      if (!yarn) {
        throw new StorageError(`Yarn not found: ${link.yarnId}`);
      }

      if (yarn.quantityMilliskeins < amountMilliskeins) {
        throw new StorageError('Недостаточно пряжи на складе');
      }

      this.yarns.adjustQuantityMilliskeins(link.yarnId, -amountMilliskeins);
      return this.projectYarns.setUsedQuantityMilliskeins(
        linkId,
        link.usedQuantityMilliskeins + amountMilliskeins
      );
    });
  }

  /**
   * Sets cumulative used quantity; inventory adjusted by delta.
   * Example: used 2000 → 1500 returns 500 to inventory.
   */
  adjustUsedQuantity(linkId: string, newUsedMilliskeins: number): ProjectYarn {
    validateQuantityMilliskeins(
      newUsedMilliskeins,
      'usedQuantityMilliskeins'
    );

    return this.db.withTransaction(() => {
      const link = this.projectYarns.getLinkById(linkId);
      if (!link) {
        throw new StorageError(`Project yarn link not found: ${linkId}`);
      }

      const delta = newUsedMilliskeins - link.usedQuantityMilliskeins;
      if (delta === 0) {
        return link;
      }

      if (delta > 0) {
        const yarn = this.yarns.getYarnById(link.yarnId);
        if (!yarn || yarn.quantityMilliskeins < delta) {
          throw new StorageError('Недостаточно пряжи на складе');
        }
      }

      this.yarns.adjustQuantityMilliskeins(link.yarnId, -delta);
      return this.projectYarns.setUsedQuantityMilliskeins(
        linkId,
        newUsedMilliskeins
      );
    });
  }
}
