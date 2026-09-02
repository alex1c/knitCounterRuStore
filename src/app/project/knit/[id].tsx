/**
 * Active knitting screen — counter, rules, linked patterns, timer.
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

import { RowRuleBanner } from '@/components/knitting/RowRuleBanner';
import { KnittingDocumentPickerModal } from '@/components/knitting/KnittingDocumentPickerModal';
import type { Counter, KnittingSession, ProjectDocument } from '@/domain/types';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useDatabase } from '@/providers/DatabaseProvider';
import {
  formatDuration,
} from '@/repositories/KnittingSessionRepository';
import { colors, spacing, typography } from '@/theme/tokens';
import {
  formatCounterProgress,
  formatLinkedRepeatProgress,
  formatRepeatProgress,
  isLinkedCounter,
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
  const { counterRepository, projectService, knittingSessionRepository } =
    useDatabase();

  const [activeCounterId, setActiveCounterId] = useState<string | null>(null);
  const [displayCounter, setDisplayCounter] = useState<Counter | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeSession, setActiveSession] = useState<KnittingSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [docPickerVisible, setDocPickerVisible] = useState(false);

  const counters = detail?.counters;
  const parts = detail?.parts;
  const project = detail?.project;
  const rules = useMemo(() => detail?.rules ?? [], [detail?.rules]);
  const documents = useMemo(
    () => detail?.documents ?? [],
    [detail?.documents]
  );

  const countableCounters = useMemo(
    () => (counters ?? []).filter((c) => !isLinkedCounter(c)),
    [counters]
  );

  const linkedCounters = useMemo(
    () => (counters ?? []).filter((c) => isLinkedCounter(c)),
    [counters]
  );

  const resolvedCounterId = useMemo(() => {
    if (activeCounterId) return activeCounterId;
    const initial = counters?.find((c) => c.id === initialCounterId);
    if (initialCounterId && initial && !isLinkedCounter(initial)) {
      return initialCounterId;
    }
    const primary = countableCounters.find((c) => c.isPrimary);
    return primary?.id ?? countableCounters[0]?.id ?? null;
  }, [activeCounterId, initialCounterId, counters, countableCounters]);

  const displayFromRepo = useMemo(() => {
    if (!resolvedCounterId || !counters) return null;
    return counters.find((counter) => counter.id === resolvedCounterId) ?? null;
  }, [resolvedCounterId, counters]);

  useEffect(() => {
    if (displayFromRepo) {
      queueMicrotask(() => setDisplayCounter(displayFromRepo));
    }
  }, [displayFromRepo]);

  useEffect(() => {
    if (!id || !knittingSessionRepository) return;
    const session = knittingSessionRepository.getActiveSession(id);
    queueMicrotask(() => {
      setActiveSession(session);
      setElapsed(session ? knittingSessionRepository.getElapsedSeconds(session) : 0);
    });
  }, [id, knittingSessionRepository, detail?.totalKnittingSeconds]);

  useEffect(() => {
    if (!activeSession?.isActive || !knittingSessionRepository) return;
    const tick = setInterval(() => {
      setElapsed(knittingSessionRepository.getElapsedSeconds(activeSession));
    }, 1000);
    return () => clearInterval(tick);
  }, [activeSession, knittingSessionRepository]);

  useEffect(() => {
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, []);

  const activePart = useMemo(() => {
    if (!displayCounter?.projectPartId || !parts) return null;
    return parts.find((p) => p.id === displayCounter.projectPartId) ?? null;
  }, [displayCounter, parts]);

  const counterRules = useMemo(
    () => rules.filter((r) => r.counterId === resolvedCounterId),
    [rules, resolvedCounterId]
  );

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
        reload();
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

  const handleTimerToggle = () => {
    if (!knittingSessionRepository || !id) return;
    if (activeSession?.isActive) {
      const stopped = knittingSessionRepository.stopSession(activeSession.id);
      setActiveSession(null);
      setElapsed(stopped.durationSeconds ?? 0);
      reload();
    } else {
      const started = knittingSessionRepository.startSession(
        id,
        displayCounter?.projectPartId ?? undefined
      );
      setActiveSession(started);
      setElapsed(0);
    }
  };

  const openScheme = () => {
    if (documents.length === 0 || !id) return;
    if (documents.length === 1) {
      router.push(`/project/documents/${documents[0].id}?projectId=${id}`);
      return;
    }
    setDocPickerVisible(true);
  };

  const openDocumentFromPicker = (doc: ProjectDocument) => {
    setDocPickerVisible(false);
    if (!id) return;
    router.push(`/project/documents/${doc.id}?projectId=${id}`);
  };

  if (!project || !displayCounter) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Text style={styles.loading}>Загрузка…</Text>
      </View>
    );
  }

  const progress = formatCounterProgress(displayCounter);
  const repeat = formatRepeatProgress(displayCounter);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
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
        {documents.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Схема"
            onPress={openScheme}
            style={styles.schemeBtn}
          >
            <Ionicons name="document-text-outline" size={22} color={colors.textSecondary} />
            <Text style={styles.schemeText}>Схема</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel={activeSession?.isActive ? 'Остановить таймер' : 'Начать таймер'}
          onPress={handleTimerToggle}
          style={styles.timerBtn}
        >
          <Ionicons
            name={activeSession?.isActive ? 'pause-circle-outline' : 'timer-outline'}
            size={26}
            color={colors.textSecondary}
          />
          <Text style={styles.timerText}>
            {activeSession?.isActive ? formatDuration(elapsed) : 'Таймер'}
          </Text>
        </Pressable>
      </View>

      {countableCounters.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {countableCounters.map((c) => {
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

      <RowRuleBanner
        rules={counterRules}
        currentRow={displayCounter.currentValue}
      />

      <View style={styles.counterArea}>
        <Text style={styles.counterLabel}>{displayCounter.name}</Text>
        <Text
          style={styles.counterValue}
          accessibilityLabel={`${displayCounter.name} ${displayCounter.currentValue}`}
        >
          {displayCounter.currentValue}
        </Text>
        {progress ? <Text style={styles.progress}>{progress}</Text> : null}
        {repeat ? <Text style={styles.repeat}>Узор: {repeat}</Text> : null}
        {linkedCounters.map((linked) => {
          const line = formatLinkedRepeatProgress(displayCounter, linked);
          return line ? (
            <Text key={linked.id} style={styles.linked}>
              {line}
            </Text>
          ) : null;
        })}
      </View>

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

      <KnittingDocumentPickerModal
        visible={docPickerVisible}
        documents={documents}
        onSelect={openDocumentFromPicker}
        onClose={() => setDocPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
  backBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  headerText: { flex: 1 },
  schemeBtn: { alignItems: 'center', minWidth: 44, minHeight: 44, justifyContent: 'center' },
  schemeText: { ...typography.caption, color: colors.textMuted },
  projectName: { ...typography.subtitle, color: colors.text },
  partName: { ...typography.caption, color: colors.textMuted },
  timerBtn: { alignItems: 'center', minWidth: 56, minHeight: 44 },
  timerText: { ...typography.caption, color: colors.textMuted },
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
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextOn: { color: colors.primary, fontWeight: '600' },
  counterArea: {
    alignItems: 'center',
    paddingVertical: spacing.md,
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
  progress: { ...typography.subtitle, color: colors.primary, marginTop: spacing.sm },
  repeat: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  linked: { ...typography.body, color: colors.primary, marginTop: spacing.xs },
  incrementZone: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  incrementPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  incrementBusy: { opacity: 0.7 },
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
  secondaryLabel: { ...typography.caption, color: colors.textSecondary },
});
