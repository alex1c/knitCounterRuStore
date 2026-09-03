/**
 * Project statistics — knitting time, sessions, row progress, yarn usage, chart.
 */

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { KnittingTimeChart } from '@/components/statistics/KnittingTimeChart';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useProjectStatistics } from '@/hooks/useProjectStatistics';
import { formatSessionDurationLabel } from '@/services/ProjectActivityService';
import {
  formatProjectAgeDays,
  formatChartBarLabel,
} from '@/services/ProjectStatisticsService';
import { InterstitialAdService } from '@/services/InterstitialAdService';
import { colors, spacing, typography } from '@/theme/tokens';
import { formatSkeinQuantity } from '@/utils/yarnQuantity';

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow} accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function ProjectStatisticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { statistics, reload } = useProjectStatistics(id);

  useFocusEffect(
    useCallback(() => {
      reload();
      return () => {
        void InterstitialAdService.onStatisticsLeave();
      };
    }, [reload])
  );

  if (!statistics.hasData) {
    return (
      <Screen scroll banner="projects">
        <EmptyState
          title="Статистика появится после первых занятий вязанием"
          description="Начните вязать или добавьте заметку — здесь появятся время, ряды и прогресс."
        />
      </Screen>
    );
  }

  const totalLabel = formatSessionDurationLabel(statistics.totalKnittingSeconds);
  const averageLabel =
    statistics.averageSessionSeconds != null
      ? formatSessionDurationLabel(statistics.averageSessionSeconds)
      : '—';

  return (
    <Screen scroll banner="projects">
      <Card style={styles.card}>
        <StatRow label="Всего времени" value={totalLabel} />
        {statistics.activeSessionElapsedSeconds != null ? (
          <StatRow
            label="Сейчас вяжете"
            value={formatSessionDurationLabel(
              statistics.activeSessionElapsedSeconds
            )}
          />
        ) : null}
        <StatRow
          label="Занятий"
          value={String(statistics.completedSessionCount)}
        />
        <StatRow label="Среднее занятие" value={averageLabel} />
        {statistics.currentPrimaryRow != null ? (
          <StatRow
            label="Текущий ряд"
            value={String(statistics.currentPrimaryRow)}
          />
        ) : null}
        {statistics.maxRowReached != null ? (
          <StatRow
            label="Максимально достигнуто"
            value={String(statistics.maxRowReached)}
          />
        ) : null}
        <StatRow
          label="Возраст проекта"
          value={formatProjectAgeDays(statistics.projectAgeDays)}
        />
      </Card>

      <KnittingTimeChart data={statistics.dailyMinutes} />

      {statistics.yarns.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Пряжа</Text>
          {statistics.yarns.map((yarn) => {
            const used = formatSkeinQuantity(yarn.usedMilliskeins);
            const planned =
              yarn.plannedMilliskeins != null
                ? formatSkeinQuantity(yarn.plannedMilliskeins)
                : null;
            const detail = planned
              ? `Использовано ${used} из плановых ${planned}`
              : `Использовано ${used}`;

            return (
              <Card key={yarn.yarnId} style={styles.yarnCard}>
                <Text style={styles.yarnName}>{yarn.yarnName}</Text>
                <Text style={styles.yarnDetail}>{detail}</Text>
              </Card>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.footerNote} accessibilityElementsHidden>
        {statistics.dailyMinutes.map((d) =>
          formatChartBarLabel(d.dateKey, d.minutes)
        ).join('; ')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  statLabel: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  statValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  yarnCard: {
    gap: spacing.xs,
  },
  yarnName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  yarnDetail: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  footerNote: {
    height: 0,
    overflow: 'hidden',
  },
});
