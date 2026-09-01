/**
 * Inline row-rule due/next display for knitting screen.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import {
  formatNextRuleHint,
  getDueRowRules,
  getNextRuleOccurrence,
} from '@/domain/rowRuleEngine';
import type { RowRule } from '@/domain/types';
import { colors, spacing, typography } from '@/theme/tokens';

type Props = {
  rules: RowRule[];
  currentRow: number;
};

export function RowRuleBanner({ rules, currentRow }: Props) {
  const activeRules = rules.filter((r) => r.isActive);
  const due = getDueRowRules(activeRules, currentRow);
  const next = getNextRuleOccurrence(activeRules, currentRow);

  if (due.length === 0 && !next) {
    return null;
  }

  if (due.length > 0) {
    return (
      <Card style={styles.dueCard}>
        <Text style={styles.dueTitle}>
          {due.length === 1 ? 'Сейчас' : 'На этом ряду'}
        </Text>
        {due.map(({ rule }) => (
          <Text key={rule.id} style={styles.dueText}>
            {due.length > 1 ? `• ${rule.instruction}` : rule.instruction}
          </Text>
        ))}
      </Card>
    );
  }

  if (next) {
    return (
      <View style={styles.nextWrap}>
        <Text style={styles.nextText}>{formatNextRuleHint(next)}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  dueCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryMuted,
  },
  dueTitle: {
    ...typography.subtitle,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  dueText: {
    ...typography.body,
    color: colors.text,
  },
  nextWrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
  },
  nextText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
