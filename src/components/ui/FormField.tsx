/**
 * Reusable form field with label.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors, radii, spacing, typography } from '@/theme/tokens';

type FormFieldProps = TextInputProps & {
  label: string;
  required?: boolean;
};

export function FormField({ label, required, style, ...rest }: FormFieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
});
