/**
 * Ещё — settings entry points (backup) and app information.
 */

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing, typography } from '@/theme/tokens';

export default function MoreScreen() {
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen scroll>
      <Text style={styles.title}>Ещё</Text>

      <Card style={styles.card}>
        <View style={styles.row}>
          <Ionicons
            name="cloud-download-outline"
            size={24}
            color={colors.primary}
          />
          <View style={styles.rowText}>
            <Text style={styles.cardTitle}>Резервная копия</Text>
            <Text style={styles.cardHint}>
              Сохраните проекты, счётчики, пряжу, дневник и локальные документы.
            </Text>
          </View>
        </View>
        <Button
          title="Открыть"
          variant="secondary"
          onPress={() => router.push('/backup')}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>О приложении</Text>
        <Text style={styles.cardHint}>Моя вязалка · версия {version}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.md,
  },
  card: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  cardHint: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
