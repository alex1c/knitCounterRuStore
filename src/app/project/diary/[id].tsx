/**
 * Project diary — reverse-chronological activity timeline with manual notes.
 */

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ActivityTimelineRow } from '@/components/diary/ActivityTimelineRow';
import { DiaryNoteModal } from '@/components/diary/DiaryNoteModal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import type { DiaryFilter, ProjectDiaryEntry } from '@/domain/types';
import { useProjectDiary } from '@/hooks/useProjectDiary';
import { useDatabase } from '@/providers/DatabaseProvider';
import { colors, spacing, typography } from '@/theme/tokens';

const FILTERS: { id: DiaryFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'notes', label: 'Заметки' },
  { id: 'knitting', label: 'Вязание' },
  { id: 'yarn', label: 'Пряжа' },
];

export default function ProjectDiaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectDiaryEntryRepository } = useDatabase();
  const {
    filter,
    setFilter,
    timeline,
    activeBanner,
    createNote,
    updateNote,
    deleteNote,
    reload,
  } = useProjectDiary(id);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ProjectDiaryEntry | null>(
    null
  );

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const openCreate = () => {
    setEditingEntry(null);
    setModalVisible(true);
  };

  const openEdit = (entryId: string) => {
    if (!id || !projectDiaryEntryRepository) {
      return;
    }
    const entry = projectDiaryEntryRepository.getForProject(entryId, id);
    if (entry) {
      setEditingEntry(entry);
      setModalVisible(true);
    }
  };

  const handleSubmit = (payload: {
    title: string | null;
    text: string;
    occurredAt: string;
  }) => {
    try {
      if (editingEntry) {
        updateNote(editingEntry.id, payload);
      } else {
        createNote({ ...payload, type: 'note' });
      }
      setModalVisible(false);
      setEditingEntry(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить';
      Alert.alert('Ошибка', message);
    }
  };

  const handleDelete = (entryId: string) => {
    Alert.alert('Удалить заметку?', 'Запись будет удалена безвозвратно.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => deleteNote(entryId),
      },
    ]);
  };

  const isEmpty = timeline.length === 0 && !activeBanner;

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.id}
              accessibilityRole="button"
              accessibilityLabel={`Фильтр ${f.label}`}
              accessibilityState={{ selected: filter === f.id }}
              onPress={() => setFilter(f.id)}
              style={[styles.chip, filter === f.id && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  filter === f.id && styles.chipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeBanner ? (
          <View style={styles.activeBanner}>
            <ActivityTimelineRow item={activeBanner} />
          </View>
        ) : null}

        {isEmpty ? (
          <EmptyState
            title="Дневник пока пуст"
            description="Добавьте заметку или начните вязать — здесь появится история проекта."
          />
        ) : (
          timeline.map((group) => (
            <View key={group.dateKey} style={styles.group}>
              <Text style={styles.groupTitle}>{group.label}</Text>
              {group.items.map((item) => {
                const isManual =
                  item.kind === 'note' || item.kind === 'milestone';
                const entryId = isManual
                  ? item.id.replace(/^diary:/, '')
                  : null;

                return (
                  <ActivityTimelineRow
                    key={item.id}
                    item={item}
                    onEdit={
                      entryId ? () => openEdit(entryId) : undefined
                    }
                    onDelete={
                      entryId ? () => handleDelete(entryId) : undefined
                    }
                  />
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Добавить заметку" onPress={openCreate} />
      </View>

      <DiaryNoteModal
        visible={modalVisible}
        entry={editingEntry}
        onCancel={() => {
          setModalVisible(false);
          setEditingEntry(null);
        }}
        onSubmit={handleSubmit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary,
  },
  activeBanner: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
  },
  group: {
    gap: spacing.xs,
  },
  groupTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  footer: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
});
