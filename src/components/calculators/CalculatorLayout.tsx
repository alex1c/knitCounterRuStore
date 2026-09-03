/**
 * Shared layout for calculator screens — inputs, result, explanation.
 */

import React, { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing, typography } from '@/theme/tokens';

type Props = {
  title: string;
  description: string;
  children: ReactNode;
  result?: ReactNode;
  explanation?: string[];
  onCalculate: () => void;
  onClear: () => void;
  error?: string | null;
};

export function CalculatorLayout({
  title,
  description,
  children,
  result,
  explanation,
  onCalculate,
  onClear,
  error,
}: Props) {
  return (
    <Screen banner="calculators">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <Card style={styles.inputCard}>{children}</Card>

          <View style={styles.actions}>
            <Button title="Рассчитать" onPress={onCalculate} />
            <Button title="Очистить" variant="ghost" onPress={onClear} />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {result ? (
            <Card style={styles.resultCard}>
              <Text style={styles.resultLabel}>Результат</Text>
              {result}
            </Card>
          ) : null}

          {explanation && explanation.length > 0 ? (
            <Card style={styles.explainCard}>
              <Text style={styles.explainTitle}>Как рассчитано</Text>
              {explanation.map((line) => (
                <Text key={line} style={styles.explainLine}>
                  {line}
                </Text>
              ))}
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { gap: spacing.md, paddingBottom: spacing.xl },
  title: { ...typography.title, color: colors.text },
  description: { ...typography.body, color: colors.textSecondary },
  inputCard: { gap: spacing.sm },
  actions: { gap: spacing.sm },
  error: { ...typography.body, color: colors.danger },
  resultCard: { gap: spacing.sm },
  resultLabel: { ...typography.caption, color: colors.textMuted },
  explainCard: { gap: spacing.xs },
  explainTitle: { ...typography.subtitle, color: colors.text },
  explainLine: { ...typography.caption, color: colors.textSecondary },
  primaryResult: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
});

/** Large primary result number/text. */
export function CalculatorPrimaryResult({ text }: { text: string }) {
  return <Text style={styles.primaryResult}>{text}</Text>;
}
