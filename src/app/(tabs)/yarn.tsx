/**
 * Пряжа — personal yarn inventory list.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { YarnCard } from '@/components/yarn/YarnCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useYarnInventory } from '@/hooks/useYarnInventory';
import type { YarnSortMode } from '@/repositories/YarnRepository';
import { colors, radii, spacing, typography } from '@/theme/tokens';

const SORT_OPTIONS: { value: YarnSortMode; label: string }[] = [
  { value: 'name', label: 'По названию' },
  { value: 'updated', label: 'Недавно изменённые' },
];

export default function YarnScreen() {
  const { items, loading, query, setQuery, sort, setSort } = useYarnInventory();

  if (!loading && items.length === 0 && query.trim() === '') {
    return (
      <Screen banner="yarn">
        <EmptyState
          icon={
            <Ionicons name="ellipse-outline" size={48} color={colors.primaryMuted} />
          }
          title="Пряжи пока нет"
          description="Добавьте мотки, чтобы видеть остатки и использовать их в проектах."
        />
        <View style={styles.cta}>
          <Button
            title="Добавить пряжу"
            onPress={() => router.push('/yarn/form')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll banner="yarn">
      <Text style={styles.title}>Пряжа</Text>

      <TextInput
        style={styles.search}
        placeholder="Поиск по названию, цвету, партии…"
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Поиск пряжи"
      />

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => {
          const selected = sort === opt.value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setSort(opt.value)}
              style={[styles.sortChip, selected && styles.sortChipOn]}
            >
              <Text style={[styles.sortText, selected && styles.sortTextOn]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <Text style={styles.loading}>Загрузка…</Text>
      ) : items.length === 0 ? (
        <Text style={styles.emptySearch}>Ничего не найдено</Text>
      ) : (
        <View style={styles.list}>
          {items.map((yarn) => (
            <YarnCard
              key={yarn.id}
              yarn={yarn}
              onPress={() => router.push(`/yarn/${yarn.id}`)}
            />
          ))}
        </View>
      )}

      <View style={styles.fabArea}>
        <Button
          title="Добавить пряжу"
          onPress={() => router.push('/yarn/form')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginBottom: spacing.md },
  search: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  sortChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  sortChipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  sortText: { ...typography.caption, color: colors.textSecondary },
  sortTextOn: { color: colors.primary, fontWeight: '600' },
  list: { gap: spacing.sm },
  loading: { ...typography.body, color: colors.textSecondary },
  emptySearch: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  cta: { marginTop: spacing.lg },
  fabArea: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
