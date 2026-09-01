/**
 * Counters repository — CRUD and atomic value changes with counter_events.
 */

import type { CounterEventType } from '@/domain/codes';
import { StorageError } from '@/domain/errors';
import type { Counter, CounterEvent } from '@/domain/types';
import {
  validateCounterEventType,
  validateCounterValue,
  validateNonEmptyName,
  validateRepeatLength,
  validatePosition,
  DomainValidationError,
} from '@/domain/validation';
import type { SqlDatabase } from '@/db/types';
import { createId } from '@/utils/id';
import { nowIsoUtc } from '@/utils/timestamps';

type CounterRow = {
  id: string;
  project_id: string;
  project_part_id: string | null;
  name: string;
  current_value: number;
  start_value: number;
  target_value: number | null;
  repeat_length: number | null;
  is_primary: number;
  position: number;
  created_at: string;
  updated_at: string;
};

type CounterEventRow = {
  id: string;
  counter_id: string;
  previous_value: number;
  new_value: number;
  event_type: string;
  created_at: string;
};

export type CreateCounterInput = {
  projectId: string;
  name: string;
  projectPartId?: string | null;
  startValue?: number;
  targetValue?: number | null;
  repeatLength?: number | null;
  isPrimary?: boolean;
  position?: number;
};

export type UpdateCounterInput = {
  name?: string;
  projectPartId?: string | null;
  targetValue?: number | null;
  repeatLength?: number | null;
  isPrimary?: boolean;
  position?: number;
};

export type CounterValueChangeResult = {
  counter: Counter;
  event: CounterEvent;
};

export class CounterRepository {
  constructor(private readonly db: SqlDatabase) {}

  createCounter(input: CreateCounterInput): Counter {
    const name = validateNonEmptyName(input.name, 'name');
    const startValue = input.startValue ?? 0;
    validateCounterValue(startValue, 'startValue');
    validateRepeatLength(input.repeatLength);
    validatePosition(input.position ?? 0);
    this.validatePartScope(input.projectId, input.projectPartId ?? null);

    if (input.targetValue != null) {
      validateCounterValue(input.targetValue, 'targetValue');
    }

    const now = nowIsoUtc();
    const id = createId();

    const counter: Counter = {
      id,
      projectId: input.projectId,
      projectPartId: input.projectPartId ?? null,
      name,
      currentValue: startValue,
      startValue,
      targetValue: input.targetValue ?? null,
      repeatLength: input.repeatLength ?? null,
      isPrimary: input.isPrimary ?? false,
      position: input.position ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    try {
      this.db.run(
        `INSERT INTO counters (
          id, project_id, project_part_id, name, current_value, start_value,
          target_value, repeat_length, is_primary, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          counter.id,
          counter.projectId,
          counter.projectPartId,
          counter.name,
          counter.currentValue,
          counter.startValue,
          counter.targetValue,
          counter.repeatLength,
          counter.isPrimary ? 1 : 0,
          counter.position,
          counter.createdAt,
          counter.updatedAt,
        ]
      );
    } catch (err) {
      throw new StorageError('Failed to create counter', err);
    }

    return counter;
  }

  getCounterById(id: string): Counter | null {
    try {
      const row = this.db.getFirst<CounterRow>(
        'SELECT * FROM counters WHERE id = ?',
        [id]
      );
      return row ? mapCounter(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get counter', err);
    }
  }

  listCountersByProject(projectId: string): Counter[] {
    try {
      const rows = this.db.getAll<CounterRow>(
        'SELECT * FROM counters WHERE project_id = ? ORDER BY position ASC, created_at ASC',
        [projectId]
      );
      return rows.map(mapCounter);
    } catch (err) {
      throw new StorageError('Failed to list counters', err);
    }
  }

  updateCounter(id: string, input: UpdateCounterInput): Counter {
    const existing = this.getCounterById(id);
    if (!existing) {
      throw new StorageError(`Counter not found: ${id}`);
    }

    validateRepeatLength(
      input.repeatLength !== undefined ? input.repeatLength : existing.repeatLength
    );

    const updated: Counter = {
      ...existing,
      name: input.name !== undefined
        ? validateNonEmptyName(input.name, 'name')
        : existing.name,
      projectPartId: input.projectPartId !== undefined
        ? input.projectPartId
        : existing.projectPartId,
      targetValue: input.targetValue !== undefined
        ? input.targetValue
        : existing.targetValue,
      repeatLength: input.repeatLength !== undefined
        ? input.repeatLength
        : existing.repeatLength,
      isPrimary: input.isPrimary !== undefined
        ? input.isPrimary
        : existing.isPrimary,
      position: input.position !== undefined ? input.position : existing.position,
      updatedAt: nowIsoUtc(),
    };

    if (updated.targetValue != null) {
      validateCounterValue(updated.targetValue, 'targetValue');
    }
    validatePosition(updated.position);
    this.validatePartScope(updated.projectId, updated.projectPartId);

    try {
      this.db.run(
        `UPDATE counters SET
          name = ?, project_part_id = ?, target_value = ?, repeat_length = ?,
          is_primary = ?, position = ?, updated_at = ?
        WHERE id = ?`,
        [
          updated.name,
          updated.projectPartId,
          updated.targetValue,
          updated.repeatLength,
          updated.isPrimary ? 1 : 0,
          updated.position,
          updated.updatedAt,
          id,
        ]
      );
    } catch (err) {
      throw new StorageError('Failed to update counter', err);
    }

    return updated;
  }

  deleteCounter(id: string): void {
    try {
      const result = this.db.run('DELETE FROM counters WHERE id = ?', [id]);
      if (result.changes === 0) {
        throw new StorageError(`Counter not found: ${id}`);
      }
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to delete counter', err);
    }
  }

  /**
   * Atomically increments counter value and records a counter_event.
   */
  incrementCounter(id: string, delta = 1): CounterValueChangeResult {
    validatePositiveDelta(delta);
    return this.changeCounterValue(id, 'increment', (current) => current + delta);
  }

  /**
   * Atomically decrements counter value and records a counter_event.
   */
  decrementCounter(id: string, delta = 1): CounterValueChangeResult {
    validatePositiveDelta(delta);
    return this.changeCounterValue(id, 'decrement', (current) => current - delta);
  }

  /**
   * Atomically sets counter value and records a counter_event.
   */
  setCounterValue(id: string, newValue: number): CounterValueChangeResult {
    validateCounterValue(newValue, 'newValue');
    return this.changeCounterValue(id, 'set', () => newValue);
  }

  listEventsByCounter(counterId: string): CounterEvent[] {
    try {
      const rows = this.db.getAll<CounterEventRow>(
        'SELECT * FROM counter_events WHERE counter_id = ? ORDER BY created_at DESC',
        [counterId]
      );
      return rows.map(mapCounterEvent);
    } catch (err) {
      throw new StorageError('Failed to list counter events', err);
    }
  }

  /** Returns how many events exist for a counter (for delete confirmation). */
  countEventsByCounter(counterId: string): number {
    try {
      const row = this.db.getFirst<{ count: number }>(
        'SELECT COUNT(*) AS count FROM counter_events WHERE counter_id = ?',
        [counterId]
      );
      return row?.count ?? 0;
    } catch (err) {
      throw new StorageError('Failed to count counter events', err);
    }
  }

  /**
   * Undoes the most recent value change by restoring previous_value.
   * Appends a new `set` event — history is never silently deleted.
   */
  undoLastChange(id: string): CounterValueChangeResult {
    const events = this.listEventsByCounter(id);
    if (events.length === 0) {
      throw new DomainValidationError('Нет изменений для отмены', 'undo');
    }

    const lastEvent = events[0];
    return this.setCounterValue(id, lastEvent.previousValue);
  }

  /**
   * Shared atomic path: read → compute → update counter → insert event.
   */
  private changeCounterValue(
    id: string,
    eventType: CounterEventType,
    compute: (current: number) => number
  ): CounterValueChangeResult {
    validateCounterEventType(eventType);

    try {
      return this.db.withTransaction(() => {
        const row = this.db.getFirst<CounterRow>(
          'SELECT * FROM counters WHERE id = ?',
          [id]
        );
        if (!row) {
          throw new StorageError(`Counter not found: ${id}`);
        }

        const previousValue = row.current_value;
        const newValue = compute(previousValue);
        validateCounterValue(newValue, 'newValue');

        const now = nowIsoUtc();
        this.db.run(
          'UPDATE counters SET current_value = ?, updated_at = ? WHERE id = ?',
          [newValue, now, id]
        );

        const eventId = createId();
        this.db.run(
          `INSERT INTO counter_events (
            id, counter_id, previous_value, new_value, event_type, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [eventId, id, previousValue, newValue, eventType, now]
        );

        const updatedRow = this.db.getFirst<CounterRow>(
          'SELECT * FROM counters WHERE id = ?',
          [id]
        )!;
        const eventRow = this.db.getFirst<CounterEventRow>(
          'SELECT * FROM counter_events WHERE id = ?',
          [eventId]
        )!;

        return {
          counter: mapCounter(updatedRow),
          event: mapCounterEvent(eventRow),
        };
      });
    } catch (err) {
      if (err instanceof StorageError || err instanceof DomainValidationError) {
        throw err;
      }
      throw new StorageError('Failed to change counter value', err);
    }
  }

  private validatePartScope(projectId: string, partId: string | null): void {
    if (partId === null) return;
    const part = this.db.getFirst<{ project_id: string }>(
      'SELECT project_id FROM project_parts WHERE id = ?',
      [partId]
    );
    if (!part || part.project_id !== projectId) {
      throw new DomainValidationError(
        'projectPartId must reference a part in the counter project',
        'projectPartId'
      );
    }
  }
}

function validatePositiveDelta(delta: number): void {
  if (!Number.isSafeInteger(delta) || delta <= 0) {
    throw new DomainValidationError('delta must be a positive integer', 'delta');
  }
}

function mapCounter(row: CounterRow): Counter {
  return {
    id: row.id,
    projectId: row.project_id,
    projectPartId: row.project_part_id,
    name: row.name,
    currentValue: row.current_value,
    startValue: row.start_value,
    targetValue: row.target_value,
    repeatLength: row.repeat_length,
    isPrimary: row.is_primary === 1,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCounterEvent(row: CounterEventRow): CounterEvent {
  return {
    id: row.id,
    counterId: row.counter_id,
    previousValue: row.previous_value,
    newValue: row.new_value,
    eventType: row.event_type as CounterEventType,
    createdAt: row.created_at,
  };
}
