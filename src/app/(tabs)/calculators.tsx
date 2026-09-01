/**
 * Расчёты — future knitting calculators.
 */

import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { colors } from '@/theme/tokens';

export default function CalculatorsScreen() {
  return (
    <Screen>
      <EmptyState
        icon={<Ionicons name="calculator-outline" size={48} color={colors.primaryMuted} />}
        title="Вязальные расчёты"
        description="Калькуляторы плотности, пряжи и размеров появятся здесь. Пока можно пользоваться основными вкладками приложения."
      />
    </Screen>
  );
}
