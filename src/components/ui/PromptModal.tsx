/**
 * Cross-platform text prompt modal (Alert.prompt is iOS-only).
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type PromptModalProps = {
  visible: boolean;
  title: string;
  message?: string;
  defaultValue?: string;
  keyboardType?: 'default' | 'numeric';
  onCancel: () => void;
  onSubmit: (value: string) => void;
};

export function PromptModal({
  visible,
  title,
  message,
  defaultValue = '',
  keyboardType = 'default',
  onCancel,
  onSubmit,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (visible) {
      queueMicrotask(() => setValue(defaultValue));
    }
  }, [visible, defaultValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            keyboardType={keyboardType}
            autoFocus
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.actions}>
            <Button title="Отмена" variant="ghost" onPress={onCancel} />
            <Button title="OK" onPress={() => onSubmit(value)} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
