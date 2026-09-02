/**
 * Compact document picker for knitting mode — opens scheme without counter reset.
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ProjectDocument } from '@/domain/types';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type Props = {
  visible: boolean;
  documents: ProjectDocument[];
  onSelect: (doc: ProjectDocument) => void;
  onClose: () => void;
};

export function KnittingDocumentPickerModal({
  visible,
  documents,
  onSelect,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Схемы и документы</Text>
          {documents.map((doc) => (
            <Pressable
              key={doc.id}
              accessibilityRole="button"
              accessibilityLabel={`Открыть ${doc.title}`}
              onPress={() => onSelect(doc)}
              style={styles.item}
            >
              <Text style={styles.itemText} numberOfLines={2}>
                {doc.title}
              </Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={onClose}>
            <Text style={styles.cancel}>Отмена</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { ...typography.subtitle, color: colors.text, marginBottom: spacing.xs },
  item: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemText: { ...typography.body, color: colors.text },
  cancel: {
    ...typography.body,
    color: colors.primary,
    textAlign: 'center',
    paddingTop: spacing.md,
    fontWeight: '600',
  },
});
