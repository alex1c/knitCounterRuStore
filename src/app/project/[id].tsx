/**
 * Project details — parts, counters, navigation to knitting mode.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PromptModal } from '@/components/ui/PromptModal';
import { Screen } from '@/components/ui/Screen';
import {
  getCraftTypeLabel,
  getProjectStatusLabel,
} from '@/domain/labels';
import type { Counter, ProjectPart } from '@/domain/types';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useDatabase } from '@/providers/DatabaseProvider';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import { formatCounterProgress, formatRepeatProgress } from '@/utils/counterDisplay';

type PromptState = {
  title: string;
  defaultValue: string;
  keyboardType?: 'default' | 'numeric';
  onSubmit: (value: string) => void;
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, loading, reload } = useProjectDetail(id);
  const { projectPartRepository, counterRepository, projectRepository } =
    useDatabase();
  const [newPartName, setNewPartName] = useState('');
  const [newCounterName, setNewCounterName] = useState('');
  const [prompt, setPrompt] = useState<PromptState | null>(null);

  const showPrompt = (state: PromptState) => setPrompt(state);
  const closePrompt = () => setPrompt(null);

  if (loading || !detail) {
    return (
      <Screen>
        <Text style={styles.loading}>Загрузка…</Text>
      </Screen>
    );
  }

  const { project, parts, counters } = detail;
  const primaryCounter = counters.find((c) => c.isPrimary) ?? counters[0];

  const handleDeleteProject = () => {
    Alert.alert(
      'Удалить проект?',
      'Проект, все счётчики и история изменений будут удалены безвозвратно.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            projectRepository?.deleteProject(project.id);
            router.replace('/(tabs)/projects');
          },
        },
      ]
    );
  };

  const handleAddPart = () => {
    const name = newPartName.trim();
    if (!name || !projectPartRepository) return;
    projectPartRepository.createPart({
      projectId: project.id,
      name,
      position: parts.length,
    });
    setNewPartName('');
    reload();
  };

  const handleRenamePart = (part: ProjectPart) => {
    showPrompt({
      title: 'Переименовать часть',
      defaultValue: part.name,
      onSubmit: (text) => {
        closePrompt();
        if (!text.trim() || !projectPartRepository) return;
        projectPartRepository.updatePart(part.id, { name: text.trim() });
        reload();
      },
    });
  };

  const handleDeletePart = (part: ProjectPart) => {
    Alert.alert(
      'Удалить часть?',
      'Счётчики этой части останутся в проекте.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            projectPartRepository?.deletePart(part.id);
            reload();
          },
        },
      ]
    );
  };

  const handleAddCounter = () => {
    const name = newCounterName.trim();
    if (!name || !counterRepository) return;
    counterRepository.createCounter({
      projectId: project.id,
      name,
      position: counters.length,
    });
    setNewCounterName('');
    reload();
  };

  const handleEditCounter = (counter: Counter) => {
    showPrompt({
      title: 'Название счётчика',
      defaultValue: counter.name,
      onSubmit: (name) => {
        closePrompt();
        if (!name.trim() || !counterRepository) return;
        counterRepository.updateCounter(counter.id, { name: name.trim() });
        reload();
      },
    });
  };

  const handleCounterTarget = (counter: Counter) => {
    showPrompt({
      title: 'Целевое значение',
      defaultValue: counter.targetValue?.toString() ?? '',
      keyboardType: 'numeric',
      onSubmit: (text) => {
        closePrompt();
        if (!counterRepository) return;
        const trimmed = text.trim();
        counterRepository.updateCounter(counter.id, {
          targetValue: trimmed === '' ? null : Number(trimmed),
        });
        reload();
      },
    });
  };

  const handleCounterRepeat = (counter: Counter) => {
    showPrompt({
      title: 'Длина повтора узора',
      defaultValue: counter.repeatLength?.toString() ?? '',
      keyboardType: 'numeric',
      onSubmit: (text) => {
        closePrompt();
        if (!counterRepository) return;
        const trimmed = text.trim();
        counterRepository.updateCounter(counter.id, {
          repeatLength: trimmed === '' ? null : Number(trimmed),
        });
        reload();
      },
    });
  };

  const handleDeleteCounter = (counter: Counter) => {
    const eventCount = counterRepository?.countEventsByCounter(counter.id) ?? 0;
    const message =
      eventCount > 0
        ? `У счётчика «${counter.name}» есть история (${eventCount} записей). Удалить?`
        : `Удалить счётчик «${counter.name}»?`;

    Alert.alert('Удалить счётчик?', message, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          counterRepository?.deleteCounter(counter.id);
          reload();
        },
      },
    ]);
  };

  const openKnit = (counterId?: string) => {
    const params = counterId ? `?counterId=${counterId}` : '';
    router.push(`/project/knit/${project.id}${params}`);
  };

  return (
    <Screen scroll>
      <PromptModal
        visible={prompt !== null}
        title={prompt?.title ?? ''}
        defaultValue={prompt?.defaultValue}
        keyboardType={prompt?.keyboardType}
        onCancel={closePrompt}
        onSubmit={(v) => prompt?.onSubmit(v)}
      />

      <View style={styles.header}>
        <Text style={styles.title}>{project.name}</Text>
        <Text style={styles.meta}>
          {getProjectStatusLabel(project.status)} · {getCraftTypeLabel(project.craftType)}
          {project.projectType ? ` · ${project.projectType}` : ''}
        </Text>
        {project.notes ? (
          <Text style={styles.notes}>{project.notes}</Text>
        ) : null}
      </View>

      <Button
        title="Продолжить вязание"
        onPress={() => openKnit(primaryCounter?.id)}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Части</Text>
        {parts.map((part) => (
          <Card key={part.id} style={styles.rowCard}>
            <Text style={styles.rowTitle}>{part.name}</Text>
            <View style={styles.rowActions}>
              <Pressable
                accessibilityLabel="Переименовать"
                onPress={() => handleRenamePart(part)}
                hitSlop={8}
              >
                <Ionicons name="pencil-outline" size={22} color={colors.primary} />
              </Pressable>
              <Pressable
                accessibilityLabel="Удалить часть"
                onPress={() => handleDeletePart(part)}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={22} color={colors.danger} />
              </Pressable>
            </View>
          </Card>
        ))}
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Новая часть"
            placeholderTextColor={colors.textMuted}
            value={newPartName}
            onChangeText={setNewPartName}
          />
          <Button title="Добавить" variant="secondary" onPress={handleAddPart} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Счётчики</Text>
        {counters.map((counter) => {
          const progress = formatCounterProgress(counter);
          const repeat = formatRepeatProgress(counter);
          const partName = parts.find((p) => p.id === counter.projectPartId)?.name;
          return (
            <Card key={counter.id} style={styles.counterCard}>
              <Pressable onPress={() => openKnit(counter.id)}>
                <Text style={styles.counterName}>
                  {counter.name}
                  {counter.isPrimary ? ' · основной' : ''}
                </Text>
                <Text style={styles.counterValue}>
                  {counter.currentValue}
                  {progress ? ` / ${counter.targetValue}` : ''}
                </Text>
                {repeat ? (
                  <Text style={styles.counterMeta}>Узор: {repeat}</Text>
                ) : null}
                {partName ? (
                  <Text style={styles.counterMeta}>Часть: {partName}</Text>
                ) : null}
              </Pressable>
              <View style={styles.counterActions}>
                <Button
                  title="Цель"
                  variant="ghost"
                  onPress={() => handleCounterTarget(counter)}
                />
                <Button
                  title="Повтор"
                  variant="ghost"
                  onPress={() => handleCounterRepeat(counter)}
                />
                <Button
                  title="Имя"
                  variant="ghost"
                  onPress={() => handleEditCounter(counter)}
                />
                <Pressable
                  accessibilityLabel="Удалить счётчик"
                  onPress={() => handleDeleteCounter(counter)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={22} color={colors.danger} />
                </Pressable>
              </View>
            </Card>
          );
        })}
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Новый счётчик"
            placeholderTextColor={colors.textMuted}
            value={newCounterName}
            onChangeText={setNewCounterName}
          />
          <Button title="Добавить" variant="secondary" onPress={handleAddCounter} />
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title="Редактировать проект"
          variant="secondary"
          onPress={() => router.push(`/project/form?id=${project.id}`)}
        />
        <Button title="Удалить проект" variant="danger" onPress={handleDeleteProject} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { ...typography.body, color: colors.textSecondary },
  header: { gap: spacing.xs, marginBottom: spacing.md },
  title: { ...typography.title, color: colors.text },
  meta: { ...typography.body, color: colors.textSecondary },
  notes: { ...typography.caption, color: colors.textMuted },
  section: { gap: spacing.sm, marginTop: spacing.lg },
  sectionTitle: { ...typography.subtitle, color: colors.text },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: { ...typography.body, color: colors.text, flex: 1 },
  rowActions: { flexDirection: 'row', gap: spacing.md },
  counterCard: { gap: spacing.sm },
  counterName: { ...typography.body, fontWeight: '600', color: colors.text },
  counterValue: { ...typography.subtitle, color: colors.primary },
  counterMeta: { ...typography.caption, color: colors.textMuted },
  counterActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  addInput: {
    flex: 1,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  footer: { gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.xl },
});
