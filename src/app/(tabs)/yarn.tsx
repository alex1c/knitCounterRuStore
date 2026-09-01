/**
 * Пряжа — future yarn inventory.
 */

import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { colors } from '@/theme/tokens';

export default function YarnScreen() {
  return (
    <Screen>
      <EmptyState
        icon={<Ionicons name="ellipse-outline" size={48} color={colors.primaryMuted} />}
        title="Запасы пряжи"
        description="Здесь будет каталог вашей пряжи: состав, цвет, остатки и привязка к проектам."
      />
    </Screen>
  );
}
