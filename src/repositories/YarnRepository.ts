/**
 * Yarn inventory repository — CRUD and local search.
 */

import { StorageError } from '@/domain/errors';
import type { Yarn } from '@/domain/types';
import {
  validateOptionalPositiveInt,
  validateOptionalPriceMinor,
  validateQuantityMilliskeins,
  validateYarnName,
} from '@/domain/yarnValidation';
import type { SqlDatabase } from '@/db/types';
import { createId } from '@/utils/id';
import { nowIsoUtc } from '@/utils/timestamps';

type YarnRow = {
  id: string;
  brand: string | null;
  name: string;
  color_name: string | null;
  color_code: string | null;
  dye_lot: string | null;
  composition: string | null;
  weight_per_skein_g: number | null;
  length_per_skein_m: number | null;
  quantity_milliskeins: number;
  purchase_price_minor: number | null;
  currency: string;
  notes: string | null;
  photo_uri: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateYarnInput = {
  name: string;
  brand?: string | null;
  colorName?: string | null;
  colorCode?: string | null;
  dyeLot?: string | null;
  composition?: string | null;
  weightPerSkeinG?: number | null;
  lengthPerSkeinM?: number | null;
  quantityMilliskeins?: number;
  purchasePriceMinor?: number | null;
  currency?: string;
  notes?: string | null;
  photoUri?: string | null;
};

export type UpdateYarnInput = Partial<CreateYarnInput>;

export type YarnSortMode = 'name' | 'updated';

export class YarnRepository {
  constructor(private readonly db: SqlDatabase) {}

  createYarn(input: CreateYarnInput): Yarn {
    const name = validateYarnName(input.name);
    const quantityMilliskeins = input.quantityMilliskeins ?? 0;
    validateQuantityMilliskeins(quantityMilliskeins, 'quantityMilliskeins');
    validateOptionalPositiveInt(input.weightPerSkeinG, 'weightPerSkeinG');
    validateOptionalPositiveInt(input.lengthPerSkeinM, 'lengthPerSkeinM');
    validateOptionalPriceMinor(input.purchasePriceMinor);

    const now = nowIsoUtc();
    const id = createId();

    try {
      this.db.run(
        `INSERT INTO yarns (
          id, brand, name, color_name, color_code, dye_lot, composition,
          weight_per_skein_g, length_per_skein_m, quantity_milliskeins,
          purchase_price_minor, currency, notes, photo_uri, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.brand?.trim() || null,
          name,
          input.colorName?.trim() || null,
          input.colorCode?.trim() || null,
          input.dyeLot?.trim() || null,
          input.composition?.trim() || null,
          input.weightPerSkeinG ?? null,
          input.lengthPerSkeinM ?? null,
          quantityMilliskeins,
          input.purchasePriceMinor ?? null,
          input.currency ?? 'RUB',
          input.notes?.trim() || null,
          input.photoUri ?? null,
          now,
          now,
        ]
      );
      return this.getYarnById(id)!;
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to create yarn', err);
    }
  }

  getYarnById(id: string): Yarn | null {
    try {
      const row = this.db.getFirst<YarnRow>(
        'SELECT * FROM yarns WHERE id = ?',
        [id]
      );
      return row ? mapYarn(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get yarn', err);
    }
  }

  listYarns(sort: YarnSortMode = 'name'): Yarn[] {
    const order =
      sort === 'updated'
        ? 'updated_at DESC, name ASC'
        : 'COALESCE(brand, \'\') ASC, name ASC';
    try {
      const rows = this.db.getAll<YarnRow>(
        `SELECT * FROM yarns ORDER BY ${order}`
      );
      return rows.map(mapYarn);
    } catch (err) {
      throw new StorageError('Failed to list yarns', err);
    }
  }

  /** Case-insensitive search across name, brand, color, lot. */
  searchYarns(query: string, sort: YarnSortMode = 'name'): Yarn[] {
    const trimmed = query.trim().toLowerCase();
    if (trimmed === '') {
      return this.listYarns(sort);
    }
    const pattern = `%${trimmed}%`;
    const order =
      sort === 'updated'
        ? 'updated_at DESC, name ASC'
        : 'COALESCE(brand, \'\') ASC, name ASC';
    try {
      const rows = this.db.getAll<YarnRow>(
        `SELECT * FROM yarns
         WHERE lower(name) LIKE ?
           OR lower(COALESCE(brand, '')) LIKE ?
           OR lower(COALESCE(color_name, '')) LIKE ?
           OR lower(COALESCE(color_code, '')) LIKE ?
           OR lower(COALESCE(dye_lot, '')) LIKE ?
         ORDER BY ${order}`,
        [pattern, pattern, pattern, pattern, pattern]
      );
      return rows.map(mapYarn);
    } catch (err) {
      throw new StorageError('Failed to search yarns', err);
    }
  }

  updateYarn(id: string, input: UpdateYarnInput): Yarn {
    const existing = this.getYarnById(id);
    if (!existing) {
      throw new StorageError(`Yarn not found: ${id}`);
    }

    const name =
      input.name !== undefined ? validateYarnName(input.name) : existing.name;
    const quantityMilliskeins =
      input.quantityMilliskeins !== undefined
        ? input.quantityMilliskeins
        : existing.quantityMilliskeins;
    validateQuantityMilliskeins(quantityMilliskeins, 'quantityMilliskeins');

    const weight =
      input.weightPerSkeinG !== undefined
        ? input.weightPerSkeinG
        : existing.weightPerSkeinG;
    const length =
      input.lengthPerSkeinM !== undefined
        ? input.lengthPerSkeinM
        : existing.lengthPerSkeinM;
    validateOptionalPositiveInt(weight, 'weightPerSkeinG');
    validateOptionalPositiveInt(length, 'lengthPerSkeinM');

    const price =
      input.purchasePriceMinor !== undefined
        ? input.purchasePriceMinor
        : existing.purchasePriceMinor;
    validateOptionalPriceMinor(price);

    const now = nowIsoUtc();

    try {
      this.db.run(
        `UPDATE yarns SET
          brand = ?, name = ?, color_name = ?, color_code = ?, dye_lot = ?,
          composition = ?, weight_per_skein_g = ?, length_per_skein_m = ?,
          quantity_milliskeins = ?, purchase_price_minor = ?, currency = ?,
          notes = ?, photo_uri = ?, updated_at = ?
        WHERE id = ?`,
        [
          input.brand !== undefined
            ? input.brand?.trim() || null
            : existing.brand,
          name,
          input.colorName !== undefined
            ? input.colorName?.trim() || null
            : existing.colorName,
          input.colorCode !== undefined
            ? input.colorCode?.trim() || null
            : existing.colorCode,
          input.dyeLot !== undefined
            ? input.dyeLot?.trim() || null
            : existing.dyeLot,
          input.composition !== undefined
            ? input.composition?.trim() || null
            : existing.composition,
          weight,
          length,
          quantityMilliskeins,
          price,
          input.currency ?? existing.currency,
          input.notes !== undefined
            ? input.notes?.trim() || null
            : existing.notes,
          input.photoUri !== undefined ? input.photoUri : existing.photoUri,
          now,
          id,
        ]
      );
      return this.getYarnById(id)!;
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to update yarn', err);
    }
  }

  /** Deletes yarn only when not linked to any project. */
  deleteYarn(id: string): void {
    const linkCount = this.countProjectLinks(id);
    if (linkCount > 0) {
      throw new StorageError(
        'Пряжа используется в проектах. Сначала удалите её из проектов.'
      );
    }
    try {
      const result = this.db.run('DELETE FROM yarns WHERE id = ?', [id]);
      if (result.changes === 0) {
        throw new StorageError(`Yarn not found: ${id}`);
      }
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to delete yarn', err);
    }
  }

  countProjectLinks(yarnId: string): number {
    const row = this.db.getFirst<{ count: number }>(
      'SELECT COUNT(*) AS count FROM project_yarns WHERE yarn_id = ?',
      [yarnId]
    );
    return row?.count ?? 0;
  }

  /** Internal: adjust inventory quantity (used by YarnUsageService). */
  adjustQuantityMilliskeins(yarnId: string, delta: number): Yarn {
    if (!Number.isSafeInteger(delta)) {
      throw new StorageError('Invalid quantity delta');
    }
    const existing = this.getYarnById(yarnId);
    if (!existing) {
      throw new StorageError(`Yarn not found: ${yarnId}`);
    }
    const next = existing.quantityMilliskeins + delta;
    if (next < 0) {
      throw new StorageError('Недостаточно пряжи на складе');
    }
    return this.updateYarn(yarnId, { quantityMilliskeins: next });
  }
}

function mapYarn(row: YarnRow): Yarn {
  return {
    id: row.id,
    brand: row.brand,
    name: row.name,
    colorName: row.color_name,
    colorCode: row.color_code,
    dyeLot: row.dye_lot,
    composition: row.composition,
    weightPerSkeinG: row.weight_per_skein_g,
    lengthPerSkeinM: row.length_per_skein_m,
    quantityMilliskeins: row.quantity_milliskeins,
    purchasePriceMinor: row.purchase_price_minor,
    currency: row.currency,
    notes: row.notes,
    photoUri: row.photo_uri,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
