/**
 * Project summary card for Today and Projects list.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { getCraftTypeLabel, getProjectStatusLabel } from '@/domain/labels';
import type { Counter, KnittingProject, ProjectPart } from '@/domain/types';
import { colors, spacing, typography } from '@/theme/tokens';
import { formatCounterProgress } from '@/utils/counterDisplay';

type ProjectCardProps = {
  project: KnittingProject;
  primaryCounter?: Counter | null;
  activePart?: ProjectPart | null;
  onPress: () => void;
  actionLabel?: string;
  onAction?: () => void;
};

export function ProjectCard({
  project,
  primaryCounter,
  activePart,
  onPress,
  actionLabel,
  onAction,
}: ProjectCardProps) {
  const progress = primaryCounter ? formatCounterProgress(primaryCounter) : null;
  const rowValue = primaryCounter?.currentValue;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Проект ${project.name}`}
      onPress={onPress}
    >
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={2}>
            {project.name}
          </Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {getProjectStatusLabel(project.status)}
            </Text>
          </View>
        </View>

        <Text style={styles.meta}>
          {getCraftTypeLabel(project.craftType)}
          {project.projectType ? ` · ${project.projectType}` : ''}
        </Text>

        {activePart ? (
          <Text style={styles.part}>Часть: {activePart.name}</Text>
        ) : null}

        {rowValue != null ? (
          <Text style={styles.counter}>
            {primaryCounter?.name ?? 'Ряд'}: {rowValue}
            {progress ? ` (${progress})` : ''}
          </Text>
        ) : null}

        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={(e) => {
              e.stopPropagation?.();
              onAction();
            }}
            style={styles.action}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    ...typography.subtitle,
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  part: {
    ...typography.caption,
    color: colors.textMuted,
  },
  counter: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  action: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  actionText: {
    ...typography.button,
    color: '#FFFFFF',
  },
});
