/**
 * Knitting session repository — timestamp-based timer with one active per project.
 */

import { StorageError } from '@/domain/errors';
import type { KnittingSession } from '@/domain/types';
import type { SqlDatabase } from '@/db/types';
import { createId } from '@/utils/id';
import { assertIsoTimestamp, nowIsoUtc } from '@/utils/timestamps';

type SessionRow = {
  id: string;
  project_id: string;
  project_part_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  is_active: number;
  created_at: string;
};

export class KnittingSessionRepository {
  constructor(private readonly db: SqlDatabase) {}

  /** Starts a new session; ends any existing active session for the project first. */
  startSession(projectId: string, projectPartId?: string | null): KnittingSession {
    this.validatePartScope(projectId, projectPartId ?? null);
    const now = nowIsoUtc();
    const id = createId();

    try {
      return this.db.withTransaction(() => {
        const active = this.getActiveSession(projectId);
        if (active) {
          this.stopSession(active.id);
        }

        this.db.run(
          `INSERT INTO knitting_sessions (
            id, project_id, project_part_id, started_at, ended_at,
            duration_seconds, is_active, created_at
          ) VALUES (?, ?, ?, ?, NULL, NULL, 1, ?)`,
          [id, projectId, projectPartId ?? null, now, now]
        );

        return this.getSessionById(id)!;
      });
    } catch (err) {
      throw new StorageError('Failed to start knitting session', err);
    }
  }

  stopSession(sessionId: string): KnittingSession {
    const existing = this.getSessionById(sessionId);
    if (!existing) {
      throw new StorageError(`Session not found: ${sessionId}`);
    }
    if (!existing.isActive) {
      return existing;
    }

    const endedAt = nowIsoUtc();
    assertIsoTimestamp(existing.startedAt);
    const duration = Math.max(
      0,
      Math.floor((Date.parse(endedAt) - Date.parse(existing.startedAt)) / 1000)
    );

    try {
      this.db.run(
        `UPDATE knitting_sessions SET
          ended_at = ?, duration_seconds = ?, is_active = 0
        WHERE id = ?`,
        [endedAt, duration, sessionId]
      );
      return this.getSessionById(sessionId)!;
    } catch (err) {
      throw new StorageError('Failed to stop knitting session', err);
    }
  }

  getActiveSession(projectId: string): KnittingSession | null {
    try {
      const row = this.db.getFirst<SessionRow>(
        'SELECT * FROM knitting_sessions WHERE project_id = ? AND is_active = 1',
        [projectId]
      );
      return row ? mapSession(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get active session', err);
    }
  }

  getSessionById(id: string): KnittingSession | null {
    try {
      const row = this.db.getFirst<SessionRow>(
        'SELECT * FROM knitting_sessions WHERE id = ?',
        [id]
      );
      return row ? mapSession(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get session', err);
    }
  }

  /** Elapsed seconds for active session derived from started_at. */
  getElapsedSeconds(session: KnittingSession): number {
    if (!session.isActive) {
      return session.durationSeconds ?? 0;
    }
    assertIsoTimestamp(session.startedAt);
    return Math.max(
      0,
      Math.floor((Date.now() - Date.parse(session.startedAt)) / 1000)
    );
  }

  /** Total completed knitting time for a project in seconds. */
  getTotalDurationSeconds(projectId: string): number {
    try {
      const row = this.db.getFirst<{ total: number | null }>(
        `SELECT COALESCE(SUM(duration_seconds), 0) AS total
         FROM knitting_sessions
         WHERE project_id = ? AND is_active = 0`,
        [projectId]
      );
      const completed = row?.total ?? 0;
      const active = this.getActiveSession(projectId);
      return completed + (active ? this.getElapsedSeconds(active) : 0);
    } catch (err) {
      throw new StorageError('Failed to get total duration', err);
    }
  }

  /** Sum of completed session durations only (excludes active elapsed). */
  getCompletedDurationSeconds(projectId: string): number {
    try {
      const row = this.db.getFirst<{ total: number | null }>(
        `SELECT COALESCE(SUM(duration_seconds), 0) AS total
         FROM knitting_sessions
         WHERE project_id = ? AND is_active = 0 AND duration_seconds IS NOT NULL`,
        [projectId]
      );
      return Math.max(0, row?.total ?? 0);
    } catch (err) {
      throw new StorageError('Failed to get completed duration', err);
    }
  }

  /** Completed sessions ordered by start time descending. */
  listCompletedSessions(projectId: string, limit = 100): KnittingSession[] {
    try {
      const rows = this.db.getAll<SessionRow>(
        `SELECT * FROM knitting_sessions
         WHERE project_id = ? AND is_active = 0 AND ended_at IS NOT NULL
         ORDER BY started_at DESC
         LIMIT ?`,
        [projectId, limit]
      );
      return rows.map(mapSession);
    } catch (err) {
      throw new StorageError('Failed to list completed sessions', err);
    }
  }

  /** All sessions for chart aggregation (includes active). */
  listSessionsForProject(projectId: string, limit = 200): KnittingSession[] {
    try {
      const rows = this.db.getAll<SessionRow>(
        `SELECT * FROM knitting_sessions
         WHERE project_id = ?
         ORDER BY started_at DESC
         LIMIT ?`,
        [projectId, limit]
      );
      return rows.map(mapSession);
    } catch (err) {
      throw new StorageError('Failed to list sessions', err);
    }
  }

  countCompletedSessions(projectId: string): number {
    try {
      const row = this.db.getFirst<{ count: number }>(
        `SELECT COUNT(*) AS count FROM knitting_sessions
         WHERE project_id = ? AND is_active = 0 AND ended_at IS NOT NULL`,
        [projectId]
      );
      return row?.count ?? 0;
    } catch (err) {
      throw new StorageError('Failed to count sessions', err);
    }
  }

  private validatePartScope(projectId: string, projectPartId: string | null): void {
    if (projectPartId == null) return;
    const part = this.db.getFirst<{ project_id: string }>(
      'SELECT project_id FROM project_parts WHERE id = ?',
      [projectPartId]
    );
    if (!part || part.project_id !== projectId) {
      throw new StorageError('Session part must belong to the same project');
    }
  }
}

function mapSession(row: SessionRow): KnittingSession {
  return {
    id: row.id,
    projectId: row.project_id,
    projectPartId: row.project_part_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

/** Formats seconds as HH:MM:SS. */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}
