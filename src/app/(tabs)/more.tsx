/**
 * Ещё — future settings, backup, and app information.
 */

import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { colors } from '@/theme/tokens';

export default function MoreScreen() {
  return (
    <Screen>
      <EmptyState
        icon={
          <Ionicons
            name="settings-outline"
            size={48}
            color={colors.primaryMuted}
          />
        }
        title="Настройки и информация"
        description="Здесь появятся настройки приложения, резервное копирование и сведения о версии."
      />
    </Screen>
  );
}
