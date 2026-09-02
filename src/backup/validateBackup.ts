/**
 * Validates backup manifest and data.json before any live DB mutation.
 */

import {
  BACKUP_FORMAT_VERSION,
  BACKUP_TABLE_ORDER,
  SUPPORTED_SCHEMA_VERSION,
  type BackupTableName,
} from './constants';
import type {
  BackupDataPayload,
  BackupDocumentRecord,
  BackupManifest,
  BackupPreview,
} from './types';
import {
  COUNTER_EVENT_TYPES,
  COUNTER_LINK_TYPES,
  CRAFT_TYPES,
  DIARY_ENTRY_TYPES,
  PROJECT_DOCUMENT_TYPES,
  PROJECT_STATUSES,
  ROW_RULE_TYPES,
} from '@/domain/codes';
import { assertIsoTimestamp } from '@/utils/timestamps';
import { isAllowedBackupEntryPath } from './zipPathSafety';

const ID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;

function isSafeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isSafeInteger(value)
  );
}

function assertId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ID_REGEX.test(value)) {
    throw new Error(`Некорректный идентификатор (${field})`);
  }
  return value;
}

function assertEnum(
  value: unknown,
  allowed: readonly string[],
  field: string
): string {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`Недопустимое значение «${String(value)}» для ${field}`);
  }
  return value;
}

function assertIso(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Ожидалась метка времени для ${field}`);
  }
  try {
    assertIsoTimestamp(value);
  } catch {
    throw new Error(`Некорректная метка времени (${field}): ${value}`);
  }
  return value;
}

function assertNonNegInt(value: unknown, field: string): number {
  if (!isSafeInteger(value) || value < 0) {
    throw new Error(`Некорректное целое число (${field})`);
  }
  return value;
}

function assertNullableNonNegInt(
  value: unknown,
  field: string
): number | null {
  if (value == null) return null;
  return assertNonNegInt(value, field);
}

function assertBool01(value: unknown, field: string): number {
  if (value !== 0 && value !== 1) {
    throw new Error(`Ожидалось 0 или 1 для ${field}`);
  }
  return value;
}

/** Validates manifest shape and supported versions. */
export function validateManifest(raw: unknown): BackupManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Отсутствует или повреждён manifest.json');
  }
  const m = raw as Record<string, unknown>;

  if (m.backup_format_version !== BACKUP_FORMAT_VERSION) {
    if (
      typeof m.backup_format_version === 'number' &&
      m.backup_format_version > BACKUP_FORMAT_VERSION
    ) {
      throw new Error(
        'Эта резервная копия создана более новой версией приложения.'
      );
    }
    throw new Error(
      `Неподдерживаемая версия формата резервной копии: ${String(m.backup_format_version)}`
    );
  }

  if (m.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(
      `Несовместимая версия схемы БД в копии: ${String(m.schema_version)} (ожидается ${SUPPORTED_SCHEMA_VERSION})`
    );
  }

  const createdAt = assertIso(m.created_at, 'created_at');
  const appVersion =
    typeof m.app_version === 'string' && m.app_version.trim()
      ? m.app_version
      : '1.0.0';

  if (!m.tables || typeof m.tables !== 'object') {
    throw new Error('В манифесте отсутствует tables');
  }

  return {
    backup_format_version: BACKUP_FORMAT_VERSION,
    schema_version: SUPPORTED_SCHEMA_VERSION,
    created_at: createdAt,
    app_version: appVersion,
    tables: m.tables as Record<string, number>,
    files: assertNonNegInt(m.files ?? 0, 'files'),
    files_missing: assertNonNegInt(m.files_missing ?? 0, 'files_missing'),
    warnings: Array.isArray(m.warnings)
      ? m.warnings.filter((w): w is string => typeof w === 'string')
      : [],
  };
}

function requireTable(
  tables: Record<string, unknown>,
  name: BackupTableName
): Record<string, unknown>[] {
  const rows = tables[name];
  if (!Array.isArray(rows)) {
    throw new Error(`В data.json отсутствует таблица ${name}`);
  }
  return rows as Record<string, unknown>[];
}

function uniqueIds(
  rows: Record<string, unknown>[],
  idField: string,
  label: string
): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    const id = assertId(row[idField], `${label}.${idField}`);
    if (ids.has(id)) {
      throw new Error(`Дублирующий идентификатор в ${label}: ${id}`);
    }
    ids.add(id);
  }
  return ids;
}

/** Full structural + FK validation of data.json. */
export function validateBackupData(raw: unknown): BackupDataPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Отсутствует или повреждён data.json');
  }
  const payload = raw as Record<string, unknown>;
  if (!payload.tables || typeof payload.tables !== 'object') {
    throw new Error('В data.json отсутствует tables');
  }
  if (!Array.isArray(payload.documents)) {
    throw new Error('В data.json отсутствует documents');
  }

  const tablesObj = payload.tables as Record<string, unknown>;
  const tables = {} as BackupDataPayload['tables'];
  for (const name of BACKUP_TABLE_ORDER) {
    tables[name] = requireTable(tablesObj, name);
  }

  const projectIds = uniqueIds(tables.knitting_projects, 'id', 'knitting_projects');
  const partIds = uniqueIds(tables.project_parts, 'id', 'project_parts');
  const counterIds = uniqueIds(tables.counters, 'id', 'counters');
  const ruleIds = uniqueIds(tables.row_rules, 'id', 'row_rules');
  uniqueIds(tables.row_rule_rows, 'id', 'row_rule_rows');
  uniqueIds(tables.knitting_sessions, 'id', 'knitting_sessions');
  const yarnIds = uniqueIds(tables.yarns, 'id', 'yarns');
  uniqueIds(tables.project_yarns, 'id', 'project_yarns');
  const documentIds = uniqueIds(
    tables.project_documents,
    'id',
    'project_documents'
  );
  uniqueIds(tables.project_diary_entries, 'id', 'project_diary_entries');
  uniqueIds(tables.counter_events, 'id', 'counter_events');

  for (const row of tables.app_settings) {
    if (typeof row.key !== 'string' || row.key.trim().length === 0) {
      throw new Error('Некорректный ключ настройки');
    }
    if (typeof row.value !== 'string') {
      throw new Error('Некорректное значение настройки');
    }
    assertIso(row.updated_at, 'app_settings.updated_at');
  }

  for (const row of tables.knitting_projects) {
    assertEnum(row.craft_type, CRAFT_TYPES, 'craft_type');
    assertEnum(row.status, PROJECT_STATUSES, 'status');
    if (typeof row.name !== 'string' || !row.name.trim()) {
      throw new Error('Пустое имя проекта');
    }
    assertIso(row.created_at, 'project.created_at');
    assertIso(row.updated_at, 'project.updated_at');
    if (row.started_at != null) assertIso(row.started_at, 'project.started_at');
    if (row.completed_at != null) {
      assertIso(row.completed_at, 'project.completed_at');
    }
  }

  for (const row of tables.project_parts) {
    const projectId = assertId(row.project_id, 'part.project_id');
    if (!projectIds.has(projectId)) {
      throw new Error(`Часть ссылается на неизвестный проект: ${projectId}`);
    }
    assertNonNegInt(row.position, 'part.position');
    assertIso(row.created_at, 'part.created_at');
    assertIso(row.updated_at, 'part.updated_at');
  }

  for (const row of tables.counters) {
    const projectId = assertId(row.project_id, 'counter.project_id');
    if (!projectIds.has(projectId)) {
      throw new Error(`Счётчик ссылается на неизвестный проект: ${projectId}`);
    }
    if (row.project_part_id != null) {
      const partId = assertId(row.project_part_id, 'counter.project_part_id');
      if (!partIds.has(partId)) {
        throw new Error(`Счётчик ссылается на неизвестную часть: ${partId}`);
      }
    }
    if (row.parent_counter_id != null) {
      const parentId = assertId(row.parent_counter_id, 'parent_counter_id');
      if (!counterIds.has(parentId)) {
        throw new Error('Связанный счётчик ссылается на неизвестного родителя');
      }
    }
    if (row.link_type != null) {
      assertEnum(row.link_type, COUNTER_LINK_TYPES, 'link_type');
    }
    assertNonNegInt(row.current_value, 'current_value');
    assertNonNegInt(row.start_value, 'start_value');
    assertNullableNonNegInt(row.target_value, 'target_value');
    assertNullableNonNegInt(row.repeat_length, 'repeat_length');
    assertBool01(row.is_primary, 'is_primary');
    assertNonNegInt(row.position, 'counter.position');
  }

  for (const row of tables.row_rules) {
    const projectId = assertId(row.project_id, 'rule.project_id');
    if (!projectIds.has(projectId)) {
      throw new Error('Правило ссылается на неизвестный проект');
    }
    const counterId = assertId(row.counter_id, 'rule.counter_id');
    if (!counterIds.has(counterId)) {
      throw new Error('Правило ссылается на неизвестный счётчик');
    }
    assertEnum(row.rule_type, ROW_RULE_TYPES, 'rule_type');
    assertBool01(row.is_active, 'rule.is_active');
  }

  for (const row of tables.row_rule_rows) {
    const ruleId = assertId(row.rule_id, 'rule_row.rule_id');
    if (!ruleIds.has(ruleId)) {
      throw new Error('Строка правила ссылается на неизвестное правило');
    }
    assertNonNegInt(row.row_number, 'row_number');
  }

  for (const row of tables.knitting_sessions) {
    const projectId = assertId(row.project_id, 'session.project_id');
    if (!projectIds.has(projectId)) {
      throw new Error('Сессия ссылается на неизвестный проект');
    }
    assertIso(row.started_at, 'session.started_at');
    if (row.ended_at != null) assertIso(row.ended_at, 'session.ended_at');
    assertNullableNonNegInt(row.duration_seconds, 'duration_seconds');
    assertBool01(row.is_active, 'session.is_active');
    if (row.is_active === 1) {
      throw new Error(
        'В резервной копии есть активная сессия — ожидается снимок с закрытым таймером'
      );
    }
  }

  for (const row of tables.yarns) {
    if (typeof row.name !== 'string' || !row.name.trim()) {
      throw new Error('Пустое имя пряжи');
    }
    assertNonNegInt(row.quantity_milliskeins, 'quantity_milliskeins');
    assertIso(row.created_at, 'yarn.created_at');
    assertIso(row.updated_at, 'yarn.updated_at');
  }

  for (const row of tables.project_yarns) {
    const projectId = assertId(row.project_id, 'project_yarn.project_id');
    const yarnId = assertId(row.yarn_id, 'project_yarn.yarn_id');
    if (!projectIds.has(projectId) || !yarnIds.has(yarnId)) {
      throw new Error('Связь проект–пряжа ссылается на неизвестные сущности');
    }
    assertNullableNonNegInt(
      row.planned_quantity_milliskeins,
      'planned_quantity_milliskeins'
    );
    assertNonNegInt(row.used_quantity_milliskeins, 'used_quantity_milliskeins');
  }

  for (const row of tables.project_documents) {
    const projectId = assertId(row.project_id, 'document.project_id');
    if (!projectIds.has(projectId)) {
      throw new Error('Документ ссылается на неизвестный проект');
    }
    assertEnum(row.type, PROJECT_DOCUMENT_TYPES, 'document.type');
    if (typeof row.title !== 'string' || !row.title.trim()) {
      throw new Error('Пустой заголовок документа');
    }
    assertNonNegInt(row.sort_order, 'sort_order');
  }

  for (const row of tables.project_diary_entries) {
    const projectId = assertId(row.project_id, 'diary.project_id');
    if (!projectIds.has(projectId)) {
      throw new Error('Запись дневника ссылается на неизвестный проект');
    }
    assertEnum(row.type, DIARY_ENTRY_TYPES, 'diary.type');
    if (typeof row.text !== 'string' || !row.text.trim()) {
      throw new Error('Пустой текст записи дневника');
    }
    assertIso(row.occurred_at, 'diary.occurred_at');
    if (row.document_id != null) {
      const docId = assertId(row.document_id, 'diary.document_id');
      if (!documentIds.has(docId)) {
        throw new Error('Запись дневника ссылается на неизвестный документ');
      }
    }
  }

  for (const row of tables.counter_events) {
    const counterId = assertId(row.counter_id, 'event.counter_id');
    if (!counterIds.has(counterId)) {
      throw new Error('Событие счётчика ссылается на неизвестный счётчик');
    }
    assertEnum(row.event_type, COUNTER_EVENT_TYPES, 'event_type');
    assertNonNegInt(row.previous_value, 'previous_value');
    assertNonNegInt(row.new_value, 'new_value');
    assertIso(row.created_at, 'event.created_at');
  }

  const documents: BackupDocumentRecord[] = [];
  for (const rawDoc of payload.documents as unknown[]) {
    if (!rawDoc || typeof rawDoc !== 'object') {
      throw new Error('Некорректная запись документа в documents[]');
    }
    const d = rawDoc as Record<string, unknown>;
    const id = assertId(d.id, 'documents.id');
    if (!documentIds.has(id)) {
      throw new Error(`documents[] ссылается на неизвестный документ: ${id}`);
    }
    const projectId = assertId(d.project_id, 'documents.project_id');
    if (!projectIds.has(projectId)) {
      throw new Error('documents[]: неизвестный проект');
    }
    assertEnum(d.type, PROJECT_DOCUMENT_TYPES, 'documents.type');
    if (typeof d.title !== 'string' || !d.title.trim()) {
      throw new Error('documents[]: пустой title');
    }
    const fileMissing = d.file_missing === true;
    let archivePath: string | null = null;
    if (!fileMissing) {
      if (typeof d.archive_path !== 'string') {
        throw new Error('documents[]: отсутствует archive_path');
      }
      if (!isAllowedBackupEntryPath(d.archive_path)) {
        throw new Error(`documents[]: некорректный archive_path ${d.archive_path}`);
      }
      if (!d.archive_path.startsWith(`files/projects/${projectId}/documents/`)) {
        throw new Error('documents[]: archive_path не совпадает с project_id');
      }
      archivePath = d.archive_path;
    }
    documents.push({
      ...d,
      id,
      project_id: projectId,
      type: String(d.type),
      title: String(d.title),
      archive_path: archivePath,
      file_missing: fileMissing,
    });
  }

  return { tables, documents };
}

/** Builds a user-facing preview from validated manifest + data. */
export function buildPreview(
  manifest: BackupManifest,
  data: BackupDataPayload
): BackupPreview {
  return {
    createdAt: manifest.created_at,
    schemaVersion: manifest.schema_version,
    formatVersion: manifest.backup_format_version,
    projectCount: data.tables.knitting_projects.length,
    yarnCount: data.tables.yarns.length,
    diaryCount: data.tables.project_diary_entries.length,
    documentCount: data.tables.project_documents.length,
    sessionCount: data.tables.knitting_sessions.length,
    filesPresent: data.documents.filter((d) => !d.file_missing).length,
    filesMissing: data.documents.filter((d) => d.file_missing).length,
    warnings: manifest.warnings,
  };
}
