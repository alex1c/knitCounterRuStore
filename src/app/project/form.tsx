/**
 * Create / edit project form screen.
 */

import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { OptionPicker } from '@/components/ui/OptionPicker';
import { Screen } from '@/components/ui/Screen';
import type { CraftType, ProjectStatus } from '@/domain/codes';
import {
  CRAFT_TYPE_LABELS,
  EDITABLE_PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_PRESETS,
} from '@/domain/labels';
import { useDatabase } from '@/providers/DatabaseProvider';
import { colors, spacing, typography } from '@/theme/tokens';

const CRAFT_OPTIONS = (['knitting', 'crochet'] as const).map((value) => ({
  value,
  label: CRAFT_TYPE_LABELS[value],
}));

const STATUS_OPTIONS = EDITABLE_PROJECT_STATUSES.map((value) => ({
  value,
  label: PROJECT_STATUS_LABELS[value],
}));

export default function ProjectFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { projectRepository, projectService } = useDatabase();

  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState<string>('Свитер');
  const [customType, setCustomType] = useState('');
  const [craftType, setCraftType] = useState<CraftType>('knitting');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit || !id || !projectRepository) return;
    const project = projectRepository.getProjectById(id);
    if (!project) return;

    queueMicrotask(() => {
      setName(project.name);
      const type = project.projectType ?? 'Свитер';
      if (PROJECT_TYPE_PRESETS.includes(type as (typeof PROJECT_TYPE_PRESETS)[number])) {
        setProjectType(type);
        setCustomType('');
      } else {
        setProjectType('Другое');
        setCustomType(type);
      }
      setCraftType(project.craftType);
      setStatus(project.status === 'archived' ? 'paused' : project.status);
      setNotes(project.notes ?? '');
    });
  }, [isEdit, id, projectRepository]);

  const resolvedType = useMemo(() => {
    if (projectType === 'Другое') {
      return customType.trim() || null;
    }
    return projectType;
  }, [projectType, customType]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Ошибка', 'Введите название проекта.');
      return;
    }
    if (!projectService || !projectRepository) return;

    setSaving(true);
    try {
      if (isEdit && id) {
        projectService.updateProject(id, {
          name: trimmedName,
          projectType: resolvedType,
          craftType,
          status,
          notes: notes.trim() || null,
        });
        router.back();
        return;
      }

      const created = projectService.createProjectWithDefaults({
        name: trimmedName,
        projectType: resolvedType,
        craftType,
        status,
        notes: notes.trim() || null,
      });
      router.replace(`/project/${created.project.id}`);
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить проект.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>
            {isEdit ? 'Редактировать проект' : 'Новый проект'}
          </Text>

          <FormField
            label="Название"
            required
            value={name}
            onChangeText={setName}
            placeholder="Например, Свитер для мамы"
            autoFocus={!isEdit}
          />

          <OptionPicker
            label="Что вяжем"
            options={PROJECT_TYPE_PRESETS.map((value) => ({ value, label: value }))}
            value={projectType}
            onChange={setProjectType}
          />

          {projectType === 'Другое' ? (
            <FormField
              label="Свой тип"
              value={customType}
              onChangeText={setCustomType}
              placeholder="Опишите изделие"
            />
          ) : null}

          <OptionPicker
            label="Техника"
            options={CRAFT_OPTIONS}
            value={craftType}
            onChange={setCraftType}
          />

          <OptionPicker
            label="Статус"
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
          />

          <FormField
            label="Заметка"
            value={notes}
            onChangeText={setNotes}
            placeholder="Необязательно"
            multiline
            style={styles.notes}
          />

          <View style={styles.actions}>
            <Button
              title={isEdit ? 'Сохранить' : 'Создать проект'}
              onPress={handleSave}
              disabled={saving}
            />
            <Button title="Отмена" variant="ghost" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  notes: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
