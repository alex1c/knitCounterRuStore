/**
 * Active knitting screen — large counter, +1 tap zone, decrement, undo.
 */

import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Counter } from '@/domain/types';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useDatabase } from '@/providers/DatabaseProvider';
import { colors, spacing, typography } from '@/theme/tokens';
import {
  formatCounterProgress,
  formatRepeatProgress,
} from '@/utils/counterDisplay';
import { enqueueCounterMutation } from '@/utils/counterQueue';
import { hapticIncrementSuccess } from '@/utils/haptics';

const KEEP_AWAKE_TAG = 'knitting-mode';

export default function KnittingScreen() {
  const { id, counterId: initialCounterId } = useLocalSearchParams<{
    id: string;
    counterId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { detail, reload } = useProjectDetail(id);
  const { counterRepository, projectService } = useDatabase();

  const [activeCounterId, setActiveCounterId] = useState<string | null>(null);
  const [displayCounter, setDisplayCounter] = useState<Counter | null>(null);
  const [busy, setBusy] = useState(false);

  const counters = detail?.counters;
  const parts = detail?.parts;
  const project = detail?.project;

  const resolvedCounterId = useMemo(() => {
    if (activeCounterId) return activeCounterId;
    if (initialCounterId) return initialCounterId;
    const list = counters ?? [];
    const primary = list.find((c) => c.isPrimary);
    return primary?.id ?? list[0]?.id ?? null;
  }, [activeCounterId, initialCounterId, counters]);

  const displayFromRepo = useMemo(() => {
    if (!resolvedCounterId || !counterRepository) return null;
    return counterRepository.getCounterById(resolvedCounterId);
  }, [resolvedCounterId, counterRepository, detail?.counters]);

  useEffect(() => {
    if (displayFromRepo) {
      queueMicrotask(() => setDisplayCounter(displayFromRepo));
    }
  }, [displayFromRepo]);

  useEffect(() => {
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, []);

  const activePart = useMemo(() => {
    if (!displayCounter?.projectPartId || !parts) return null;
    return parts.find((p) => p.id === displayCounter.projectPartId) ?? null;
  }, [displayCounter, parts]);

  const runMutation = useCallback(
    async (fn: () => void) => {
      if (!resolvedCounterId || !counterRepository) return;
      setBusy(true);
      try {
        await enqueueCounterMutation(resolvedCounterId, () => {
          fn();
          const updated = counterRepository.getCounterById(resolvedCounterId);
          if (updated) setDisplayCounter(updated);
          if (project) projectService?.touchProject(project.id);
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Не удалось изменить счётчик';
        Alert.alert('Ошибка', message);
        reload();
      } finally {
        setBusy(false);
      }
    },
    [resolvedCounterId, counterRepository, project, projectService, reload]
  );

  const handleIncrement = useCallback(() => {
    if (!counterRepository || !resolvedCounterId) return;
    void runMutation(() => {
      counterRepository.incrementCounter(resolvedCounterId);
      void hapticIncrementSuccess();
    });
  }, [counterRepository, resolvedCounterId, runMutation]);

  const handleDecrement = useCallback(() => {
    if (!counterRepository || !resolvedCounterId) return;
    void runMutation(() => {
      counterRepository.decrementCounter(resolvedCounterId);
    });
  }, [counterRepository, resolvedCounterId, runMutation]);

  const handleUndo = useCallback(() => {
    if (!counterRepository || !resolvedCounterId) return;
    void runMutation(() => {
      counterRepository.undoLastChange(resolvedCounterId);
    });
  }, [counterRepository, resolvedCounterId, runMutation]);

  if (!project || !displayCounter) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Text style={styles.loading}>Загрузка…</Text>
      </View>
    );
  }

  const progress = formatCounterProgress(displayCounter);
  const repeat = formatRepeatProgress(displayCounter);
  const otherCounters = (counters ?? []).filter((c) => c.id !== displayCounter.id);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* Compact header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityLabel="Назад"
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.projectName} numberOfLines={1}>
            {project.name}
          </Text>
          {activePart ? (
            <Text style={styles.partName} numberOfLines={1}>
              {activePart.name}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Counter selector chips */}
      {counters && counters.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {counters.map((c) => {
            const selected = c.id === displayCounter.id;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setActiveCounterId(c.id);
                  setDisplayCounter(c);
                }}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                  {c.name}: {c.currentValue}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Main counter display */}
      <View style={styles.counterArea}>
        <Text style={styles.counterLabel}>{displayCounter.name}</Text>
        <Text
          style={styles.counterValue}
          accessibilityLabel={`${displayCounter.name} ${displayCounter.currentValue}`}
        >
          {displayCounter.currentValue}
        </Text>
        {progress ? (
          <Text style={styles.progress}>{progress}</Text>
        ) : null}
        {repeat ? (
          <Text style={styles.repeat}>Узор: {repeat}</Text>
        ) : null}
      </View>

      {/* Huge +1 tap zone */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Добавить ряд"
        disabled={busy}
        onPress={handleIncrement}
        style={({ pressed }) => [
          styles.incrementZone,
          pressed && styles.incrementPressed,
          busy && styles.incrementBusy,
        ]}
      >
        <Text style={styles.incrementText}>+1</Text>
        <Text style={styles.incrementHint}>Нажмите для следующего ряда</Text>
      </Pressable>

      {/* Secondary controls */}
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Убавить ряд"
          disabled={busy || displayCounter.currentValue <= 0}
          onPress={handleDecrement}
          style={styles.secondaryBtn}
        >
          <Ionicons name="remove" size={28} color={colors.text} />
          <Text style={styles.secondaryLabel}>−1</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Отменить последнее действие"
          disabled={busy}
          onPress={handleUndo}
          style={styles.secondaryBtn}
        >
          <Ionicons name="arrow-undo-outline" size={24} color={colors.textSecondary} />
          <Text style={styles.secondaryLabel}>Отмена</Text>
        </Pressable>
      </View>

      {otherCounters.length > 0 ? (
        <Text style={styles.otherHint} numberOfLines={1}>
          Другие счётчики:{' '}
          {otherCounters.map((c) => `${c.name} ${c.currentValue}`).join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    minHeight: 48,
  },
  backBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  projectName: {
    ...typography.subtitle,
    color: colors.text,
  },
  partName: {
    ...typography.caption,
    color: colors.textMuted,
  },
  chipRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipTextOn: {
    color: colors.primary,
    fontWeight: '600',
  },
  counterArea: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  counterLabel: {
    ...typography.subtitle,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  counterValue: {
    fontSize: 96,
    fontWeight: '700',
    lineHeight: 108,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  progress: {
    ...typography.subtitle,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  repeat: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  incrementZone: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  incrementPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  incrementBusy: {
    opacity: 0.7,
  },
  incrementText: {
    fontSize: 64,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 72,
  },
  incrementHint: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
    minHeight: 56,
    gap: spacing.xs,
  },
  secondaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  otherHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
});
