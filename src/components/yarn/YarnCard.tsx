/**
 * Yarn inventory list card.
 */

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Card } from '@/components/ui/Card';
import type { Yarn } from '@/domain/types';
import { colors, spacing, typography } from '@/theme/tokens';
import {
  formatYarnColorLine,
  formatYarnQuantitySummary,
  formatYarnTitle,
} from '@/utils/yarnDisplay';

type Props = {
  yarn: Yarn;
  onPress: () => void;
};

export function YarnCard({ yarn, onPress }: Props) {
  const colorLine = formatYarnColorLine(yarn);

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={styles.card}>
        <Text style={styles.title} numberOfLines={2}>
          {formatYarnTitle(yarn)}
        </Text>
        {colorLine ? (
          <Text style={styles.colorLine} numberOfLines={2}>
            {colorLine}
          </Text>
        ) : null}
        <Text style={styles.quantity}>{formatYarnQuantitySummary(yarn)}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  title: { ...typography.subtitle, color: colors.text },
  colorLine: { ...typography.body, color: colors.textSecondary },
  quantity: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
