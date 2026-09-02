/**
 * Modal form for creating or editing a manual diary note.
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import type { ProjectDiaryEntry } from '@/domain/types';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import { formatDateTimeRu } from '@/utils/numeric';

type Props = {
  visible: boolean;
  entry?: ProjectDiaryEntry | null;
  onCancel: () => void;
  onSubmit: (payload: {
    title: string | null;
    text: string;
    occurredAt: string;
  }) => void;
};

/** Parses Russian-style datetime input or falls back to ISO parse. */
function parseOccurredAtInput(input: string, fallbackIso: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return fallbackIso;
  }
  const ruMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(
    trimmed
  );
  if (ruMatch) {
    const [, d, m, y, h, min] = ruMatch;
    const date = new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(h),
      Number(min),
      0,
      0
    );
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  return fallbackIso;
}

function formatOccurredAtInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${d}.${m}.${y} ${h}:${min}`;
}

export function DiaryNoteModal({ visible, entry, onCancel, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [occurredAtInput, setOccurredAtInput] = useState('');
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const now = new Date().toISOString();
    queueMicrotask(() => {
      setTitle(entry?.title ?? '');
      setText(entry?.text ?? '');
      setOccurredAtInput(formatOccurredAtInput(entry?.occurredAt ?? now));
      setFormKey((k) => k + 1);
    });
  }, [visible, entry]);

  const handleSubmit = () => {
    const fallback = entry?.occurredAt ?? new Date().toISOString();
    onSubmit({
      title: title.trim() || null,
      text,
      occurredAt: parseOccurredAtInput(occurredAtInput, fallback),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()} key={formKey}>
          <Text style={styles.heading}>
            {entry ? 'Редактировать заметку' : 'Новая заметка'}
          </Text>
          {entry ? (
            <Text style={styles.hint}>
              Создано: {formatDateTimeRu(entry.createdAt)}
            </Text>
          ) : null}

          <Text style={styles.label}>Заголовок (необязательно)</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Кратко о прогрессе"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Текст *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={text}
            onChangeText={setText}
            placeholder="Примерила рукав — нужно ещё 8 рядов."
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>Дата и время</Text>
          <TextInput
            style={styles.input}
            value={occurredAtInput}
            onChangeText={setOccurredAtInput}
            placeholder="ДД.ММ.ГГГГ ЧЧ:ММ"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Дата и время записи"
          />

          <View style={styles.actions}>
            <Button title="Отмена" variant="ghost" onPress={onCancel} />
            <Button title="Сохранить" onPress={handleSubmit} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '90%',
  },
  heading: {
    ...typography.subtitle,
    color: colors.text,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
    minHeight: 44,
  },
  textArea: {
    minHeight: 120,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
