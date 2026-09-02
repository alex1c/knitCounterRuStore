/**
 * ZIP entry path safety — reject traversal and absolute paths.
 *
 * All archive paths must be relative, use forward slashes, and stay under
 * an allowed root (manifest/data at root, or files/...).
 */

/** Normalizes separators and rejects empty / absolute / traversal paths. */
export function sanitizeZipEntryPath(rawPath: string): string | null {
  if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
    return null;
  }

  let path = rawPath.replace(/\\/g, '/').trim();

  // Reject absolute / drive / UNC / scheme paths
  if (
    path.startsWith('/') ||
    path.startsWith('//') ||
    /^[a-zA-Z]:/.test(path) ||
    path.includes('://')
  ) {
    return null;
  }

  // Strip leading ./ segments
  while (path.startsWith('./')) {
    path = path.slice(2);
  }

  const parts = path.split('/');
  const safe: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') {
      continue;
    }
    if (part === '..') {
      return null;
    }
    // Reject Windows device-ish names and control characters
    if (/[\0-\x1f<>:"|?*]/.test(part)) {
      return null;
    }
    safe.push(part);
  }

  if (safe.length === 0) {
    return null;
  }

  return safe.join('/');
}

/** True when path is allowed in a Knit Counter backup archive. */
export function isAllowedBackupEntryPath(path: string): boolean {
  const safe = sanitizeZipEntryPath(path);
  if (!safe) {
    return false;
  }
  if (safe === 'manifest.json' || safe === 'data.json') {
    return true;
  }
  if (safe.startsWith('files/projects/')) {
    // files/projects/<projectId>/documents/<file>
    const rest = safe.slice('files/projects/'.length);
    const segments = rest.split('/');
    if (segments.length !== 3) {
      return false;
    }
    const [projectId, documents, fileName] = segments;
    if (!projectId || documents !== 'documents' || !fileName) {
      return false;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
      return false;
    }
    if (!/^[a-zA-Z0-9_-]+\.[a-z0-9]+$/i.test(fileName)) {
      return false;
    }
    return true;
  }
  return false;
}

/** Asserts every ZIP entry path is safe; throws DomainValidationError-like Error. */
export function assertSafeZipEntries(paths: string[]): void {
  for (const raw of paths) {
    const safe = sanitizeZipEntryPath(raw);
    if (!safe || !isAllowedBackupEntryPath(safe)) {
      throw new Error(`Небезопасный путь в архиве: ${raw}`);
    }
  }
}

/** Builds archive-relative path for a managed document file. */
export function archiveDocumentPath(
  projectId: string,
  fileName: string
): string {
  return `files/projects/${projectId}/documents/${fileName}`;
}
