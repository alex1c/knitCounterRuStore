/**
 * Single row in the project activity timeline.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ActivityKind, ActivityTimelineItem } from '@/domain/types';
import { colors, spacing, typography } from '@/theme/tokens';
import { formatLocalTime } from '@/utils/localDates';

type Props = {
  item: ActivityTimelineItem;
  onEdit?: () => void;
  onDelete?: () => void;
};

function iconForKind(kind: ActivityKind): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'note':
      return 'create-outline';
    case 'milestone':
      return 'flag-outline';
    case 'session':
      return 'timer-outline';
    case 'counter_summary':
      return 'analytics-outline';
    case 'yarn_attached':
      return 'ellipse-outline';
    case 'document_added':
      return 'document-text-outline';
    case 'active_session':
      return 'play-circle-outline';
    default:
      return 'ellipse-outline';
  }
}

export function ActivityTimelineRow({ item, onEdit, onDelete }: Props) {
  const time = formatLocalTime(item.occurredAt);

  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Ionicons name={iconForKind(item.kind)} size={20} color={colors.primary} />
      </View>
      <View style={styles.body}>
        <Text style={styles.primary}>{item.primaryText}</Text>
        {item.secondaryText ? (
          <Text style={styles.secondary}>{item.secondaryText}</Text>
        ) : null}
        {time ? <Text style={styles.time}>{time}</Text> : null}
        {onEdit || onDelete ? (
          <View style={styles.actions}>
            {onEdit ? (
              <Text
                accessibilityRole="button"
                accessibilityLabel="Редактировать заметку"
                onPress={onEdit}
                style={styles.action}
              >
                Изменить
              </Text>
            ) : null}
            {onDelete ? (
              <Text
                accessibilityRole="button"
                accessibilityLabel="Удалить заметку"
                onPress={onDelete}
                style={[styles.action, styles.danger]}
              >
                Удалить
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  iconWrap: {
    width: 32,
    alignItems: 'center',
    paddingTop: 2,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  primary: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  secondary: {
    ...typography.body,
    color: colors.textSecondary,
  },
  time: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  action: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    minHeight: 44,
    textAlignVertical: 'center',
  },
  danger: {
    color: colors.danger,
  },
});
