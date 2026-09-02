/**
 * Document viewer — PDF or image with missing-file handling.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { LocalPdfViewer } from '@/components/documents/LocalPdfViewer';
import { useDatabase } from '@/providers/DatabaseProvider';
import { colors, spacing, typography } from '@/theme/tokens';

export default function ProjectDocumentViewerScreen() {
  const { documentId, projectId } = useLocalSearchParams<{
    documentId: string;
    projectId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { projectDocumentService } = useDatabase();
  const [missingFile, setMissingFile] = useState(false);

  const document = useMemo(() => {
    if (!documentId || !projectId || !projectDocumentService) return null;
    return projectDocumentService.getForProject(documentId, projectId);
  }, [documentId, projectId, projectDocumentService]);

  const fileExists = document
    ? projectDocumentService?.isFileAvailable(document) ?? false
    : false;

  const handleDeleteRecord = () => {
    if (!document || !projectId || !projectDocumentService) return;
    projectDocumentService.deleteDocument(document.id, projectId);
    router.back();
  };

  if (!projectId || !documentId) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Документ не найден</Text>
        <Button title="Назад" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  if (!document) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Документ не найден</Text>
        <Button title="Назад" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  if (!fileExists || missingFile) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.toolbar}>
          <Pressable accessibilityLabel="Назад" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.toolbarTitle} numberOfLines={1}>
            {document.title}
          </Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.message}>Файл не найден</Text>
          <Button title="Удалить запись" variant="danger" onPress={handleDeleteRecord} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.toolbar}>
        <Pressable accessibilityLabel="Закрыть просмотр" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.toolbarTitle} numberOfLines={1}>
          {document.title}
        </Text>
      </View>

      {document.type === 'pdf' ? (
        <LocalPdfViewer fileUri={document.fileUri} onLoadError={() => setMissingFile(true)} />
      ) : (
        <ScrollView contentContainerStyle={styles.imageScroll}>
          <Image
            source={{ uri: document.fileUri }}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel={document.title}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  toolbarTitle: {
    flex: 1,
    ...typography.subtitle,
    color: colors.text,
  },
  viewer: { flex: 1, backgroundColor: colors.surface },
  imageScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.sm,
  },
  image: {
    width: '100%',
    minHeight: 320,
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
