/**
 * Validation helpers for project document imports and metadata.
 */

import type { ProjectDocumentType } from '@/domain/codes';
import { DomainValidationError } from '@/domain/validation';

/** Maximum allowed import size — 50 MB. */
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

const EXTENSION_TO_TYPE: Record<string, ProjectDocumentType> = {
  pdf: 'pdf',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
};

const MIME_TO_TYPE: Record<string, ProjectDocumentType> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
};

/** Normalizes and validates a user-visible document title. */
export function validateDocumentTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new DomainValidationError('Укажите название документа');
  }
  return trimmed;
}

/** Extracts lowercase extension without dot. */
export function extractExtension(fileName: string): string | null {
  const base = fileName.trim().split(/[/\\]/).pop() ?? fileName;
  const idx = base.lastIndexOf('.');
  if (idx <= 0 || idx === base.length - 1) return null;
  return base.slice(idx + 1).toLowerCase();
}

/** Default display title from source filename without extension. */
export function titleFromFileName(fileName: string): string {
  const base = fileName.trim().split(/[/\\]/).pop() ?? fileName;
  const idx = base.lastIndexOf('.');
  const stem = idx > 0 ? base.slice(0, idx) : base;
  const trimmed = stem.trim();
  if (!trimmed) {
    throw new DomainValidationError('Не удалось определить название файла');
  }
  return trimmed;
}

/** Resolves supported document type from MIME and/or extension. */
export function resolveDocumentType(
  mimeType: string | null | undefined,
  fileName: string
): ProjectDocumentType {
  const ext = extractExtension(fileName);
  if (mimeType && MIME_TO_TYPE[mimeType]) {
    const fromMime = MIME_TO_TYPE[mimeType];
    if (ext) {
      const fromExt = EXTENSION_TO_TYPE[ext];
      if (fromExt && fromExt !== fromMime) {
        throw new DomainValidationError('Тип файла не совпадает с расширением');
      }
    }
    return fromMime;
  }
  if (ext && EXTENSION_TO_TYPE[ext]) {
    return EXTENSION_TO_TYPE[ext];
  }
  throw new DomainValidationError(
    'Поддерживаются PDF и изображения JPEG, PNG или WebP'
  );
}

/** Trusted file extension for managed storage filename. */
export function trustedExtensionForType(
  type: ProjectDocumentType,
  fileName: string
): string {
  const ext = extractExtension(fileName);
  if (type === 'pdf') {
    if (ext !== 'pdf') {
      throw new DomainValidationError('Ожидается PDF-файл');
    }
    return 'pdf';
  }
  if (type === 'image') {
    if (!ext || !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      throw new DomainValidationError('Неподдерживаемый формат изображения');
    }
    return ext === 'jpeg' ? 'jpg' : ext;
  }
  throw new DomainValidationError('Неподдерживаемый тип документа');
}

/** Rejects imports above configured size when metadata is available. */
export function validateDocumentSize(sizeBytes: number | null | undefined): void {
  if (sizeBytes == null) return;
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    throw new DomainValidationError('Не удалось определить размер файла');
  }
  if (sizeBytes > MAX_DOCUMENT_BYTES) {
    throw new DomainValidationError('Файл слишком большой (максимум 50 МБ)');
  }
}
