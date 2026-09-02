/**
 * Backup / restore screen — create archive and replace-restore from .knitbackup.
 */

import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import type { BackupPreview } from '@/backup/types';
import { useDatabase } from '@/providers/DatabaseProvider';
import { BackupService } from '@/services/BackupService';
import { formatDateTimeRu } from '@/utils/numeric';
import { colors, spacing, typography } from '@/theme/tokens';

function PreviewCard({ preview }: { preview: BackupPreview }) {
  return (
    <Card style={styles.previewCard}>
      <Text style={styles.previewTitle}>Содержимое копии</Text>
      <Text style={styles.previewLine}>
        Дата: {formatDateTimeRu(preview.createdAt)}
      </Text>
      <Text style={styles.previewLine}>Проектов: {preview.projectCount}</Text>
      <Text style={styles.previewLine}>Пряжи: {preview.yarnCount}</Text>
      <Text style={styles.previewLine}>
        Записей дневника: {preview.diaryCount}
      </Text>
      <Text style={styles.previewLine}>Документов: {preview.documentCount}</Text>
      <Text style={styles.previewLine}>
        Файлов в архиве: {preview.filesPresent}
        {preview.filesMissing > 0
          ? ` (отсутствует: ${preview.filesMissing})`
          : ''}
      </Text>
      {preview.warnings.length > 0 ? (
        <Text style={styles.warning}>
          Предупреждения: {preview.warnings.length}
        </Text>
      ) : null}
    </Card>
  );
}

export default function BackupScreen() {
  const { db, notifyDataReset } = useDatabase();
  const [busy, setBusy] = useState<'create' | 'pick' | 'restore' | null>(null);
  const [pending, setPending] = useState<{
    preview: BackupPreview;
    archiveBytes: Uint8Array;
  } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const service = db ? new BackupService(db) : null;

  const handleCreate = async () => {
    if (!service || busy) return;
    setBusy('create');
    setStatus('Создаём резервную копию…');
    setPending(null);
    try {
      const result = await service.createBackup();
      setStatus(null);
      await service.shareBackup(result.cacheUri);
      service.cleanupTempBackups();
      Alert.alert(
        'Готово',
        result.manifest.files_missing > 0
          ? `Копия создана. Некоторые файлы документов отсутствовали (${result.manifest.files_missing}).`
          : 'Резервная копия создана.'
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Не удалось создать копию';
      setStatus(null);
      Alert.alert('Ошибка', message);
    } finally {
      setBusy(null);
    }
  };

  const handlePick = async () => {
    if (!service || busy) return;
    setBusy('pick');
    setStatus(null);
    try {
      const picked = await service.pickAndPreview();
      setPending(picked);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Не удалось открыть копию';
      if (message !== 'Выбор файла отменён') {
        Alert.alert('Ошибка', message);
      }
      setPending(null);
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = () => {
    if (!service || !pending || busy) return;
    Alert.alert(
      'Восстановить из копии?',
      'Текущие проекты и данные будут заменены данными из резервной копии.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Восстановить',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy('restore');
              setStatus('Восстанавливаем данные…');
              try {
                const result = service.restoreFromArchive(pending.archiveBytes);
                notifyDataReset();
                setPending(null);
                setStatus(null);
                const warnText =
                  result.warnings.length > 0
                    ? `\n\nПредупреждения: ${result.warnings.slice(0, 3).join('; ')}`
                    : '';
                Alert.alert(
                  'Восстановление завершено',
                  `Данные заменены.${warnText}`,
                  [
                    {
                      text: 'OK',
                      onPress: () => router.replace('/(tabs)'),
                    },
                  ]
                );
              } catch (err) {
                const message =
                  err instanceof Error
                    ? err.message
                    : 'Не удалось восстановить';
                setStatus(null);
                Alert.alert('Ошибка восстановления', message);
              } finally {
                setBusy(null);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Резервная копия</Text>
        <Text style={styles.hint}>
          Копия хранит проекты, счётчики, пряжу, дневник и локальные документы.
        </Text>

        <Button
          title="Создать резервную копию"
          onPress={() => void handleCreate()}
          disabled={busy != null}
        />
        <Button
          title="Восстановить из копии"
          variant="secondary"
          onPress={() => void handlePick()}
          disabled={busy != null}
        />

        {busy ? (
          <View style={styles.busy} accessibilityLabel={status ?? 'Выполняется'}>
            <ActivityIndicator size="large" color={colors.primary} />
            {status ? <Text style={styles.busyText}>{status}</Text> : null}
          </View>
        ) : null}

        {pending ? (
          <View style={styles.pending}>
            <PreviewCard preview={pending.preview} />
            <Text style={styles.replaceWarning}>
              Восстановление заменит текущие данные приложения данными из
              резервной копии.
            </Text>
            <Button
              title="Восстановить"
              onPress={handleRestore}
              disabled={busy != null}
            />
            <Button
              title="Отмена"
              variant="ghost"
              onPress={() => setPending(null)}
              disabled={busy != null}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  hint: {
    ...typography.body,
    color: colors.textSecondary,
  },
  busy: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  busyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  pending: {
    gap: spacing.md,
  },
  previewCard: {
    gap: spacing.xs,
  },
  previewTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  previewLine: {
    ...typography.body,
    color: colors.text,
  },
  warning: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  replaceWarning: {
    ...typography.body,
    color: colors.danger,
    fontWeight: '600',
  },
});
