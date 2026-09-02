/**
 * Row rules repository — CRUD with list rows and scope validation.
 */

import type { RowRuleType } from '@/domain/codes';
import { StorageError } from '@/domain/errors';
import {
  validateRowRuleFields,
  validateRowRuleType,
} from '@/domain/rowRuleValidation';
import type { RowRule } from '@/domain/types';
import {
  validateNonEmptyName,
  validatePosition,
} from '@/domain/validation';
import type { SqlDatabase } from '@/db/types';
import { createId } from '@/utils/id';
import { nowIsoUtc } from '@/utils/timestamps';

type RuleRow = {
  id: string;
  project_id: string;
  project_part_id: string | null;
  counter_id: string;
  name: string;
  instruction: string;
  rule_type: string;
  start_row: number | null;
  every_n_rows: number | null;
  exact_row: number | null;
  end_row: number | null;
  is_active: number;
  position: number;
  created_at: string;
  updated_at: string;
};

type ListRow = {
  row_number: number;
};

export type CreateRowRuleInput = {
  projectId: string;
  counterId: string;
  name: string;
  instruction: string;
  ruleType: RowRuleType;
  projectPartId?: string | null;
  startRow?: number | null;
  everyNRows?: number | null;
  exactRow?: number | null;
  endRow?: number | null;
  listRows?: number[];
  isActive?: boolean;
  position?: number;
};

export type UpdateRowRuleInput = {
  name?: string;
  instruction?: string;
  projectPartId?: string | null;
  startRow?: number | null;
  everyNRows?: number | null;
  exactRow?: number | null;
  endRow?: number | null;
  listRows?: number[];
  isActive?: boolean;
  position?: number;
};

export class RowRuleRepository {
  constructor(private readonly db: SqlDatabase) {}

  createRule(input: CreateRowRuleInput): RowRule {
    const ruleType = validateRowRuleType(input.ruleType);
    const name = validateNonEmptyName(input.name, 'name');
    const listRows = [...new Set(input.listRows ?? [])].sort((a, b) => a - b);
    validateRowRuleFields({
      ruleType,
      instruction: input.instruction,
      exactRow: input.exactRow,
      everyNRows: input.everyNRows,
      startRow: input.startRow,
      endRow: input.endRow,
      listRows,
    });
    validatePosition(input.position ?? 0);

    const now = nowIsoUtc();
    const id = createId();

    try {
      return this.db.withTransaction(() => {
        this.db.run(
          `INSERT INTO row_rules (
            id, project_id, project_part_id, counter_id, name, instruction,
            rule_type, start_row, every_n_rows, exact_row, end_row,
            is_active, position, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            input.projectId,
            input.projectPartId ?? null,
            input.counterId,
            name,
            input.instruction.trim(),
            ruleType,
            input.startRow ?? null,
            input.everyNRows ?? null,
            input.exactRow ?? null,
            input.endRow ?? null,
            input.isActive === false ? 0 : 1,
            input.position ?? 0,
            now,
            now,
          ]
        );

        this.replaceListRows(id, ruleType, listRows);
        return this.getRuleById(id)!;
      });
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to create row rule', err);
    }
  }

  getRuleById(id: string): RowRule | null {
    try {
      const row = this.db.getFirst<RuleRow>(
        'SELECT * FROM row_rules WHERE id = ?',
        [id]
      );
      return row ? this.mapRule(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get row rule', err);
    }
  }

  listRulesByProject(projectId: string): RowRule[] {
    try {
      const rows = this.db.getAll<RuleRow>(
        'SELECT * FROM row_rules WHERE project_id = ? ORDER BY position ASC, created_at ASC, id ASC',
        [projectId]
      );
      return rows.map((row) => this.mapRule(row));
    } catch (err) {
      throw new StorageError('Failed to list row rules', err);
    }
  }

  listRulesByCounter(counterId: string): RowRule[] {
    try {
      const rows = this.db.getAll<RuleRow>(
        'SELECT * FROM row_rules WHERE counter_id = ? ORDER BY position ASC, created_at ASC, id ASC',
        [counterId]
      );
      return rows.map((row) => this.mapRule(row));
    } catch (err) {
      throw new StorageError('Failed to list counter rules', err);
    }
  }

  listActiveRulesByCounter(counterId: string): RowRule[] {
    return this.listRulesByCounter(counterId).filter((r) => r.isActive);
  }

  updateRule(id: string, input: UpdateRowRuleInput): RowRule {
    const existing = this.getRuleById(id);
    if (!existing) {
      throw new StorageError(`Row rule not found: ${id}`);
    }

    const updatedInstruction = input.instruction ?? existing.instruction;
    const listRows = [...new Set(input.listRows ?? existing.listRows)].sort(
      (a, b) => a - b
    );
    validateRowRuleFields({
      ruleType: existing.ruleType,
      instruction: updatedInstruction,
      exactRow: input.exactRow !== undefined ? input.exactRow : existing.exactRow,
      everyNRows:
        input.everyNRows !== undefined ? input.everyNRows : existing.everyNRows,
      startRow: input.startRow !== undefined ? input.startRow : existing.startRow,
      endRow: input.endRow !== undefined ? input.endRow : existing.endRow,
      listRows,
    });
    validatePosition(input.position ?? existing.position);

    const now = nowIsoUtc();

    try {
      return this.db.withTransaction(() => {
        this.db.run(
          `UPDATE row_rules SET
            name = ?, instruction = ?, project_part_id = ?,
            start_row = ?, every_n_rows = ?, exact_row = ?, end_row = ?,
            is_active = ?, position = ?, updated_at = ?
          WHERE id = ?`,
          [
            input.name !== undefined
              ? validateNonEmptyName(input.name, 'name')
              : existing.name,
            updatedInstruction.trim(),
            input.projectPartId !== undefined
              ? input.projectPartId
              : existing.projectPartId,
            input.startRow !== undefined ? input.startRow : existing.startRow,
            input.everyNRows !== undefined
              ? input.everyNRows
              : existing.everyNRows,
            input.exactRow !== undefined ? input.exactRow : existing.exactRow,
            input.endRow !== undefined ? input.endRow : existing.endRow,
            (input.isActive !== undefined ? input.isActive : existing.isActive)
              ? 1
              : 0,
            input.position !== undefined ? input.position : existing.position,
            now,
            id,
          ]
        );

        if (input.listRows !== undefined) {
          this.replaceListRows(id, existing.ruleType, listRows);
        }

        return this.getRuleById(id)!;
      });
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to update row rule', err);
    }
  }

  deleteRule(id: string): void {
    try {
      const result = this.db.run('DELETE FROM row_rules WHERE id = ?', [id]);
      if (result.changes === 0) {
        throw new StorageError(`Row rule not found: ${id}`);
      }
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to delete row rule', err);
    }
  }

  countActiveByProject(projectId: string): number {
    const row = this.db.getFirst<{ count: number }>(
      'SELECT COUNT(*) AS count FROM row_rules WHERE project_id = ? AND is_active = 1',
      [projectId]
    );
    return row?.count ?? 0;
  }

  private replaceListRows(
    ruleId: string,
    ruleType: RowRuleType,
    listRows: number[]
  ): void {
    this.db.run('DELETE FROM row_rule_rows WHERE rule_id = ?', [ruleId]);
    if (ruleType !== 'list') return;

    for (const rowNumber of listRows) {
      this.db.run(
        'INSERT INTO row_rule_rows (id, rule_id, row_number) VALUES (?, ?, ?)',
        [createId(), ruleId, rowNumber]
      );
    }
  }

  private mapRule(row: RuleRow): RowRule {
    const listRows =
      row.rule_type === 'list'
        ? this.db
            .getAll<ListRow>(
              'SELECT row_number FROM row_rule_rows WHERE rule_id = ? ORDER BY row_number ASC',
              [row.id]
            )
            .map((r) => r.row_number)
        : [];

    return {
      id: row.id,
      projectId: row.project_id,
      projectPartId: row.project_part_id,
      counterId: row.counter_id,
      name: row.name,
      instruction: row.instruction,
      ruleType: row.rule_type as RowRuleType,
      startRow: row.start_row,
      everyNRows: row.every_n_rows,
      exactRow: row.exact_row,
      endRow: row.end_row,
      isActive: row.is_active === 1,
      position: row.position,
      listRows,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
