/**
 * Calculators hub — card list of knitting calculators.
 */

import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { CALCULATOR_ROUTES } from '@/domain/calculators';
import { colors, spacing, typography } from '@/theme/tokens';

export default function CalculatorsScreen() {
  return (
    <Screen scroll>
      <Text style={styles.title}>Расчёты</Text>
      <Text style={styles.subtitle}>
        Практичные калькуляторы для плотности, размеров и пряжи.
      </Text>
      <View style={styles.list}>
        {CALCULATOR_ROUTES.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => router.push(item.href)}
          >
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  list: { gap: spacing.sm },
  card: { minHeight: 56, justifyContent: 'center' },
  cardTitle: { ...typography.body, fontWeight: '600', color: colors.text },
});
