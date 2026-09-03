/**
 * Project documents section on project detail — import, list, rename, delete.
 */

import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PromptModal } from '@/components/ui/PromptModal';
import type { ProjectDocument } from '@/domain/types';
import { useDatabase } from '@/providers/DatabaseProvider';
import { Analytics } from '@/services/AnalyticsService';
import { colors, spacing, typography } from '@/theme/tokens';

type Props = {
  projectId: string;
  documents: ProjectDocument[];
  onChanged: () => void;
};

export function ProjectDocumentsSection({ projectId, documents, onChanged }: Props) {
  const { projectDocumentService } = useDatabase();
  const [renameTarget, setRenameTarget] = useState<ProjectDocument | null>(null);
  const [importing, setImporting] = useState(false);

  const openDocument = useCallback(
    (doc: ProjectDocument) => {
      Analytics.documentOpened(doc.type);
      router.push(`/project/documents/${doc.id}?projectId=${projectId}`);
    },
    [projectId]
  );

  const pickDocument = useCallback(
    async (mode: 'pdf' | 'image') => {
      if (!projectDocumentService || importing) return;
      setImporting(true);
      try {
        const result = await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          type: mode === 'pdf' ? 'application/pdf' : 'image/*',
          multiple: false,
        });
        if (result.canceled || !result.assets[0]) return;
        projectDocumentService.importDocument({
          projectId,
          asset: result.assets[0],
        });
        Analytics.documentImported(mode);
        onChanged();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось добавить файл';
        Alert.alert('Ошибка', message);
      } finally {
        setImporting(false);
      }
    },
    [projectDocumentService, projectId, onChanged, importing]
  );

  const showAddMenu = () => {
    Alert.alert('Добавить', 'Выберите тип файла', [
      { text: 'PDF', onPress: () => void pickDocument('pdf') },
      { text: 'Изображение', onPress: () => void pickDocument('image') },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  const confirmDelete = (doc: ProjectDocument) => {
    Alert.alert('Удалить документ?', doc.title, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          try {
            projectDocumentService?.deleteDocument(doc.id, projectId);
            onChanged();
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Не удалось удалить';
            Alert.alert('Ошибка', message);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Документы и схемы</Text>
      {documents.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Документов пока нет</Text>
          <Text style={styles.emptyText}>
            Добавьте описание, схему или изображение, чтобы всё было под рукой во время вязания.
          </Text>
          <Button title="Добавить" variant="secondary" onPress={showAddMenu} />
        </Card>
      ) : (
        <>
          {documents.map((doc) => (
            <Card key={doc.id} style={styles.docCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Открыть документ ${doc.title}`}
                onPress={() => openDocument(doc)}
                style={styles.docRow}
              >
                <Ionicons
                  name={doc.type === 'pdf' ? 'document-text-outline' : 'image-outline'}
                  size={22}
                  color={colors.primary}
                />
                <View style={styles.docText}>
                  <Text style={styles.docTitle} numberOfLines={2}>
                    {doc.title}
                  </Text>
                  <Text style={styles.docMeta}>
                    {projectDocumentService?.documentTypeLabel(doc.type) ?? doc.type}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
              <View style={styles.docActions}>
                <Button
                  title="Переименовать"
                  variant="ghost"
                  onPress={() => setRenameTarget(doc)}
                />
                <Button
                  title="Удалить"
                  variant="ghost"
                  onPress={() => confirmDelete(doc)}
                />
              </View>
            </Card>
          ))}
          <Button
            title="Добавить"
            variant="secondary"
            onPress={showAddMenu}
            disabled={importing}
          />
        </>
      )}

      <PromptModal
        visible={renameTarget != null}
        title="Переименовать"
        defaultValue={renameTarget?.title ?? ''}
        onCancel={() => setRenameTarget(null)}
        onSubmit={(value) => {
          if (!renameTarget || !projectDocumentService) return;
          try {
            projectDocumentService.rename(renameTarget.id, projectId, value);
            setRenameTarget(null);
            onChanged();
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Не удалось переименовать';
            Alert.alert('Ошибка', message);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.subtitle, color: colors.text },
  emptyCard: { gap: spacing.sm },
  emptyTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  emptyText: { ...typography.body, color: colors.textSecondary },
  docCard: { gap: spacing.xs },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  docText: { flex: 1, gap: 2 },
  docTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  docMeta: { ...typography.caption, color: colors.textMuted },
  docActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
