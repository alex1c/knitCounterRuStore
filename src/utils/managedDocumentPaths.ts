/**
 * Path safety for app-managed project document files.
 *
 * Only URIs under `projects/<projectId>/documents/` inside the managed root
 * may be deleted by cleanup helpers.
 */

/** Relative segment marker for managed project documents. */
export const MANAGED_DOCUMENTS_SEGMENT = 'projects';

/** Builds the relative managed directory path for a project. */
export function managedProjectDocumentsRelativePath(projectId: string): string {
  return `${MANAGED_DOCUMENTS_SEGMENT}/${projectId}/documents`;
}

/** Builds expected managed filename `{documentId}.{ext}`. */
export function managedDocumentFileName(
  documentId: string,
  extension: string
): string {
  const safeExt = extension.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!safeExt) {
    throw new Error('Invalid managed document extension');
  }
  return `${documentId}.${safeExt}`;
}

/** Normalizes URI for prefix checks (lowercase scheme/host on file URIs). */
export function normalizeUri(uri: string): string {
  return decodeURIComponent(uri.trim());
}

/**
 * Returns true when URI points to a managed document for the given project.
 * Rejects parent traversal and unrelated app paths.
 *
 * @param managedRootPrefix URI of the managed `projects/` directory.
 */
export function isManagedDocumentUri(
  fileUri: string,
  projectId: string,
  managedRootPrefix: string
): boolean {
  if (!fileUri || !projectId || !managedRootPrefix) return false;

  const normalized = normalizeUri(fileUri);
  const root = normalizeUri(managedRootPrefix).replace(/\/+$/, '');
  if (!normalized.startsWith(root)) return false;

  const relative = normalized.slice(root.length).replace(/^\/+/, '');
  if (relative.includes('..')) return false;

  const expectedPrefix = `${projectId}/documents/`;
  if (!relative.startsWith(expectedPrefix)) return false;

  const fileName = relative.slice(expectedPrefix.length);
  if (!fileName || fileName.includes('/')) return false;

  return /^[a-zA-Z0-9_-]+\.[a-z0-9]+$/i.test(fileName);
}

/** Rejects URIs that must never be deleted by managed cleanup. */
export function isExternalPickerUri(fileUri: string, managedRootPrefix: string): boolean {
  const normalized = normalizeUri(fileUri);
  const root = normalizeUri(managedRootPrefix).replace(/\/+$/, '');
  if (normalized.startsWith(root)) return false;
  return (
    normalized.startsWith('content://') ||
    normalized.startsWith('file:///') ||
    normalized.startsWith('ph://') ||
    normalized.startsWith('assets-library://')
  );
}
