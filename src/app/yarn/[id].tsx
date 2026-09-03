/**
 * Yarn detail screen — stock, usage, and actions.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import type { KnittingProject, ProjectYarn, Yarn } from '@/domain/types';
import { useDatabase } from '@/providers/DatabaseProvider';
import { colors, spacing, typography } from '@/theme/tokens';
import {
  formatYarnColorLine,
  formatYarnInventoryValue,
  formatYarnPriceLine,
  formatYarnQuantitySummary,
  formatYarnTitle,
} from '@/utils/yarnDisplay';
import { formatSkeinQuantity } from '@/utils/yarnQuantity';

type UsageRow = ProjectYarn & { project: KnittingProject | null };

export default function YarnDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { yarnRepository, projectYarnRepository, projectRepository } =
    useDatabase();
  const [yarn, setYarn] = useState<Yarn | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);

  const reload = useCallback(() => {
    if (!id || !yarnRepository || !projectYarnRepository || !projectRepository) {
      return;
    }
    const loaded = yarnRepository.getYarnById(id);
    setYarn(loaded);
    if (loaded) {
      const links = projectYarnRepository.listLinksByYarn(loaded.id);
      setUsage(
        links.map((link) => ({
          ...link,
          project: projectRepository.getProjectById(link.projectId),
        }))
      );
    }
  }, [id, yarnRepository, projectYarnRepository, projectRepository]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const handleDelete = () => {
    if (!yarn || !yarnRepository) return;
    Alert.alert(
      'Удалить пряжу?',
      'Запись будет удалена из склада безвозвратно.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            try {
              yarnRepository.deleteYarn(yarn.id);
              router.back();
            } catch (err) {
              const message =
                err instanceof Error ? err.message : 'Не удалось удалить';
              Alert.alert('Ошибка', message);
            }
          },
        },
      ]
    );
  };

  if (!yarn) {
    return (
      <Screen banner="yarn">
        <Text style={styles.loading}>Загрузка…</Text>
      </Screen>
    );
  }

  const colorLine = formatYarnColorLine(yarn);
  const priceLine = formatYarnPriceLine(yarn);
  const inventoryValue = formatYarnInventoryValue(yarn);

  return (
    <Screen scroll banner="yarn">
      <View style={styles.header}>
        <Text style={styles.title}>{formatYarnTitle(yarn)}</Text>
        <Pressable
          accessibilityLabel="Редактировать"
          onPress={() => router.push(`/yarn/form?id=${yarn.id}`)}
          hitSlop={12}
        >
          <Ionicons name="pencil-outline" size={24} color={colors.primary} />
        </Pressable>
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Пряжа</Text>
        {yarn.brand ? (
          <Text style={styles.row}>Бренд: {yarn.brand}</Text>
        ) : null}
        {colorLine ? (
          <Text style={styles.rowHighlight}>{colorLine}</Text>
        ) : null}
        {yarn.composition ? (
          <Text style={styles.row}>{yarn.composition}</Text>
        ) : null}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Моток</Text>
        {yarn.weightPerSkeinG != null ? (
          <Text style={styles.row}>{yarn.weightPerSkeinG} г</Text>
        ) : null}
        {yarn.lengthPerSkeinM != null ? (
          <Text style={styles.row}>{yarn.lengthPerSkeinM} м</Text>
        ) : null}
        {yarn.weightPerSkeinG == null && yarn.lengthPerSkeinM == null ? (
          <Text style={styles.muted}>Не указано</Text>
        ) : null}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>В наличии</Text>
        <Text style={styles.quantityBig}>
          {formatYarnQuantitySummary(yarn)}
        </Text>
      </Card>

      {usage.length > 0 ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Использование</Text>
          {usage.map((row) => (
            <Pressable
              key={row.id}
              onPress={() => router.push(`/project/${row.projectId}`)}
              style={styles.usageRow}
            >
              <Text style={styles.row}>
                {row.project?.name ?? 'Проект'}
              </Text>
              <Text style={styles.usageMeta}>
                Использовано:{' '}
                {formatSkeinQuantity(row.usedQuantityMilliskeins)}
              </Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {priceLine || inventoryValue ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Стоимость</Text>
          {priceLine ? <Text style={styles.row}>{priceLine}</Text> : null}
          {inventoryValue ? (
            <Text style={styles.row}>На складе: {inventoryValue}</Text>
          ) : null}
        </Card>
      ) : null}

      {yarn.notes ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Заметка</Text>
          <Text style={styles.row}>{yarn.notes}</Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button
          title="Редактировать"
          variant="secondary"
          onPress={() => router.push(`/yarn/form?id=${yarn.id}`)}
        />
        <Button title="Удалить" variant="danger" onPress={handleDelete} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { ...typography.body, color: colors.textSecondary },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: { ...typography.title, color: colors.text, flex: 1 },
  section: { gap: spacing.xs, marginBottom: spacing.md },
  sectionTitle: { ...typography.subtitle, color: colors.text },
  row: { ...typography.body, color: colors.textSecondary },
  rowHighlight: { ...typography.body, color: colors.text, fontWeight: '600' },
  quantityBig: {
    ...typography.subtitle,
    color: colors.primary,
    fontWeight: '700',
  },
  muted: { ...typography.caption, color: colors.textMuted },
  usageRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  usageMeta: { ...typography.caption, color: colors.textMuted },
  actions: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
});
