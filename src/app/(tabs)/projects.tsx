/**
 * Проекты — future project list.
 */

import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { colors } from '@/theme/tokens';

export default function ProjectsScreen() {
  return (
    <Screen>
      <EmptyState
        icon={<Ionicons name="folder-open-outline" size={48} color={colors.primaryMuted} />}
        title="Список проектов"
        description="Здесь будут ваши вязальные проекты с счётчиками рядов, деталями и заметками. Скоро можно будет создать первый проект."
      />
    </Screen>
  );
}
