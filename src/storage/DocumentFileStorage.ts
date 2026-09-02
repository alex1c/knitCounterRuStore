/**
 * Expo FileSystem adapter for managed project document storage.
 */

import { Directory, File, Paths } from 'expo-file-system';

import {
  isManagedDocumentUri,
  managedDocumentFileName,
  managedProjectDocumentsRelativePath,
} from '@/utils/managedDocumentPaths';

/** Prefix URI for all managed project documents (under app document directory). */
export function getManagedDocumentsRootUri(): string {
  return new Directory(Paths.document, MANAGED_PROJECTS_DIR).uri;
}

const MANAGED_PROJECTS_DIR = 'projects';

export type CopyToManagedParams = {
  projectId: string;
  documentId: string;
  sourceUri: string;
  extension: string;
};

/** Ensures the managed documents directory exists for a project. */
export function ensureProjectDocumentsDirectory(projectId: string): Directory {
  const dir = new Directory(
    Paths.document,
    MANAGED_PROJECTS_DIR,
    projectId,
    'documents'
  );
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

/** Copies a picked file into managed storage and returns the managed URI. */
export function copyToManagedStorage(params: CopyToManagedParams): string {
  const dir = ensureProjectDocumentsDirectory(params.projectId);
  const fileName = managedDocumentFileName(params.documentId, params.extension);
  const destination = new File(dir, fileName);
  const source = new File(params.sourceUri);
  if (!source.exists) {
    throw new Error('Исходный файл недоступен');
  }
  source.copy(destination);
  return destination.uri;
}

/** Deletes a managed document file when URI is verified safe. */
export function deleteManagedDocumentFile(
  fileUri: string,
  projectId: string
): boolean {
  const root = getManagedDocumentsRootUri();
  if (!isManagedDocumentUri(fileUri, projectId, root)) {
    return false;
  }
  const file = new File(fileUri);
  if (file.exists) {
    file.delete();
  }
  return true;
}

/** Removes an entire managed project documents directory if present. */
export function deleteManagedProjectDirectory(projectId: string): void {
  const dir = new Directory(
    Paths.document,
    MANAGED_PROJECTS_DIR,
    projectId
  );
  if (dir.exists) {
    dir.delete();
  }
}

/** Checks whether a managed file still exists on disk. */
export function managedFileExists(fileUri: string): boolean {
  try {
    return new File(fileUri).exists;
  } catch {
    return false;
  }
}

/** Returns managed relative path for diagnostics/tests. */
export function describeManagedPath(projectId: string): string {
  return managedProjectDocumentsRelativePath(projectId);
}
