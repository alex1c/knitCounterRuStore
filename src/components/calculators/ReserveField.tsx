/**
 * Reserve percentage presets for yarn calculators.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/ui/FormField';
import { colors, spacing, typography } from '@/theme/tokens';

const PRESETS = [0, 5, 10, 15];

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function ReserveField({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <FormField
        label="Запас, %"
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
      />
      <View style={styles.presets}>
        {PRESETS.map((p) => {
          const selected = value === String(p);
          return (
            <Pressable
              key={p}
              onPress={() => onChange(String(p))}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                {p}%
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextOn: { color: colors.primary, fontWeight: '600' },
});
