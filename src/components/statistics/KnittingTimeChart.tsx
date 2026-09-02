/**
 * Simple bar chart for daily knitting minutes — no external chart library.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DailyKnittingMinutes } from '@/domain/types';
import { formatChartBarLabel } from '@/services/ProjectStatisticsService';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type Props = {
  data: DailyKnittingMinutes[];
};

export function KnittingTimeChart({ data }: Props) {
  const maxMinutes = Math.max(1, ...data.map((d) => d.minutes));

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.title}>Время вязания по дням</Text>
      <View style={styles.bars}>
        {data.map((day) => {
          const heightPct = day.minutes / maxMinutes;
          const barHeight = Math.max(day.minutes > 0 ? 8 : 2, heightPct * 96);
          return (
            <View key={day.dateKey} style={styles.barCol}>
              <Text style={styles.minutes} accessibilityElementsHidden>
                {day.minutes > 0 ? day.minutes : ''}
              </Text>
              <View
                style={styles.barTrack}
                accessibilityLabel={formatChartBarLabel(day.dateKey, day.minutes)}
              >
                <View style={[styles.barFill, { height: barHeight }]} />
              </View>
              <Text style={styles.dayLabel}>{day.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.xs,
    minHeight: 140,
    paddingTop: spacing.sm,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  minutes: {
    ...typography.caption,
    color: colors.textMuted,
    minHeight: 16,
  },
  barTrack: {
    width: '100%',
    maxWidth: 36,
    height: 100,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    minHeight: 2,
  },
  dayLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
