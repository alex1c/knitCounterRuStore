/**
 * Project document service — import, safe delete, and project cleanup.
 */

import type { DocumentPickerAsset } from 'expo-document-picker';

import type { ProjectDocumentType } from '@/domain/codes';
import {
  resolveDocumentType,
  titleFromFileName,
  trustedExtensionForType,
  validateDocumentSize,
} from '@/domain/documentValidation';
import { StorageError } from '@/domain/errors';
import type { ProjectDocument } from '@/domain/types';
import type { SqlDatabase } from '@/db/types';
import { ProjectDocumentRepository } from '@/repositories/ProjectDocumentRepository';
import { ProjectRepository } from '@/repositories/ProjectRepository';
import {
  copyToManagedStorage,
  deleteManagedDocumentFile,
  deleteManagedProjectDirectory,
  managedFileExists,
} from '@/storage/DocumentFileStorage';
import { createId } from '@/utils/id';

export type ImportDocumentInput = {
  projectId: string;
  asset: DocumentPickerAsset;
  title?: string;
};

export class ProjectDocumentService {
  private readonly documents: ProjectDocumentRepository;
  private readonly projects: ProjectRepository;

  constructor(db: SqlDatabase) {
    this.documents = new ProjectDocumentRepository(db);
    this.projects = new ProjectRepository(db);
  }

  listForProject(projectId: string): ProjectDocument[] {
    return this.documents.listForProject(projectId);
  }

  getForProject(documentId: string, projectId: string): ProjectDocument | null {
    return this.documents.getByIdForProject(documentId, projectId);
  }

  /** Imports a picked file into managed storage and persists metadata. */
  importDocument(input: ImportDocumentInput): ProjectDocument {
    const project = this.projects.getProjectById(input.projectId);
    if (!project) {
      throw new StorageError(`Project not found: ${input.projectId}`);
    }

    const asset = input.asset;
    const sourceName = asset.name ?? 'document';
    validateDocumentSize(asset.size ?? null);
    const docType = resolveDocumentType(asset.mimeType ?? null, sourceName);
    const extension = trustedExtensionForType(docType, sourceName);
    const title = input.title?.trim() || titleFromFileName(sourceName);
    const documentId = createId();

    let managedUri: string | null = null;
    try {
      managedUri = copyToManagedStorage({
        projectId: input.projectId,
        documentId,
        sourceUri: asset.uri,
        extension,
      });

      return this.documents.create({
        id: documentId,
        projectId: input.projectId,
        type: docType,
        title,
        originalName: sourceName,
        fileUri: managedUri,
        mimeType: asset.mimeType ?? null,
      });
    } catch (err) {
      if (managedUri) {
        deleteManagedDocumentFile(managedUri, input.projectId);
      }
      if (err instanceof StorageError) throw err;
      throw new StorageError('Не удалось импортировать документ', err);
    }
  }

  rename(documentId: string, projectId: string, title: string): ProjectDocument {
    const doc = this.documents.getByIdForProject(documentId, projectId);
    if (!doc) {
      throw new StorageError('Документ не найден');
    }
    return this.documents.rename(documentId, title);
  }

  /**
   * Deletes DB record first, then managed file.
   * External picker URIs are never deleted.
   */
  deleteDocument(documentId: string, projectId: string): void {
    const doc = this.documents.getByIdForProject(documentId, projectId);
    if (!doc) {
      throw new StorageError('Документ не найден');
    }
    this.documents.deleteRecord(documentId);
    deleteManagedDocumentFile(doc.fileUri, projectId);
  }

  /** Returns whether the managed file exists for a document record. */
  isFileAvailable(document: ProjectDocument): boolean {
    return managedFileExists(document.fileUri);
  }

  /** Cleans managed files for all documents in a project (DB rows cascade separately). */
  cleanupProjectFiles(projectId: string): void {
    const docs = this.documents.listForProject(projectId);
    for (const doc of docs) {
      deleteManagedDocumentFile(doc.fileUri, projectId);
    }
    deleteManagedProjectDirectory(projectId);
  }

  documentTypeLabel(type: ProjectDocumentType): string {
    if (type === 'pdf') return 'PDF';
    if (type === 'image') return 'Изображение';
    return 'Файл';
  }
}
