/**
 * Сегодня — future quick access to active knitting projects.
 */

import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { colors } from '@/theme/tokens';

export default function TodayScreen() {
  return (
    <Screen>
      <EmptyState
        icon={<Ionicons name="today-outline" size={48} color={colors.primaryMuted} />}
        title="Пока нет активных проектов"
        description="Здесь появятся проекты, над которыми вы сейчас вяжете. Создайте проект во вкладке «Проекты», чтобы начать."
      />
    </Screen>
  );
}
