/**
 * Yarn picker modal for calculators — read-only inventory access.
 */

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import type { Yarn } from '@/domain/types';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import { formatYarnColorLine, formatYarnTitle } from '@/utils/yarnDisplay';
import { formatSkeinQuantity } from '@/utils/yarnQuantity';

type Props = {
  visible: boolean;
  yarns: Yarn[];
  onSelect: (yarn: Yarn) => void;
  onClose: () => void;
};

export function YarnPickerModal({ visible, yarns, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Выбрать из моей пряжи</Text>
          <ScrollView style={styles.list}>
            {yarns.map((yarn) => (
              <Pressable
                key={yarn.id}
                style={styles.item}
                onPress={() => {
                  onSelect(yarn);
                  onClose();
                }}
              >
                <Text style={styles.itemTitle}>{formatYarnTitle(yarn)}</Text>
                {formatYarnColorLine(yarn) ? (
                  <Text style={styles.meta}>{formatYarnColorLine(yarn)}</Text>
                ) : null}
                <Text style={styles.stock}>
                  В наличии: {formatSkeinQuantity(yarn.quantityMilliskeins)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Button title="Отмена" variant="ghost" onPress={onClose} />
        </View>
      </View>
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
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: '70%',
    gap: spacing.md,
  },
  title: { ...typography.subtitle, color: colors.text },
  list: { maxHeight: 320 },
  item: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  itemTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
  stock: { ...typography.caption, color: colors.primary },
});
