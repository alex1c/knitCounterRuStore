/**
 * Сегодня — quick access to active knitting projects.
 */

import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ProjectCard } from '@/components/project/ProjectCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useProjectList } from '@/hooks/useProjectList';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useDatabase } from '@/providers/DatabaseProvider';
import { ProjectStatisticsService } from '@/services/ProjectStatisticsService';
import { formatNextRuleHint, getNextRuleOccurrence } from '@/domain/rowRuleEngine';
import { colors, spacing, typography } from '@/theme/tokens';
import { formatYarnTitle } from '@/utils/yarnDisplay';
import { getActiveProjects } from '@/utils/projectSort';

function ActiveProjectCard({
  projectId,
  onContinue,
}: {
  projectId: string;
  onContinue: () => void;
}) {
  const { detail } = useProjectDetail(projectId);
  const { db } = useDatabase();
  if (!detail) return null;

  const primaryCounter =
    detail.counters.find((c) => c.isPrimary) ?? detail.counters[0] ?? null;
  const activePart = primaryCounter?.projectPartId
    ? detail.parts.find((p) => p.id === primaryCounter.projectPartId) ?? null
    : null;

  const primaryRules = detail.rules.filter(
    (r) => r.counterId === primaryCounter?.id && r.isActive
  );
  const nextRule =
    primaryCounter && primaryRules.length > 0
      ? getNextRuleOccurrence(primaryRules, primaryCounter.currentValue)
      : null;
  const ruleHint = nextRule ? formatNextRuleHint(nextRule) : null;
  const yarnHint =
    detail.projectYarns.length > 0
      ? `Пряжа: ${formatYarnTitle(detail.projectYarns[0].yarn)}`
      : null;

  let todayHint: string | null = null;
  if (db && primaryCounter) {
    const statsService = new ProjectStatisticsService(db);
    const todaySeconds = statsService.getTodayKnittingSeconds(projectId);
    if (todaySeconds >= 60) {
      todayHint = `Сегодня: ${Math.round(todaySeconds / 60)} мин · ряд ${primaryCounter.currentValue}`;
    }
  }

  const subtitle = todayHint ?? ruleHint ?? yarnHint ?? undefined;

  return (
    <ProjectCard
      project={detail.project}
      primaryCounter={primaryCounter}
      activePart={activePart}
      subtitle={subtitle}
      onPress={() => router.push(`/project/${projectId}`)}
      actionLabel="Продолжить вязание"
      onAction={onContinue}
    />
  );
}

export default function TodayScreen() {
  const { items, loading } = useProjectList();

  const activeProjects = useMemo(
    () => getActiveProjects(items.map((i) => i.project)),
    [items]
  );

  const featuredId = activeProjects[0]?.id;

  if (loading) {
    return (
      <Screen banner="projects">
        <Text style={styles.loading}>Загрузка…</Text>
      </Screen>
    );
  }

  if (activeProjects.length === 0) {
    return (
      <Screen banner="projects">
        <Text style={styles.screenTitle}>Сегодня</Text>
        <EmptyState
          title="Пока нет активного проекта"
          description="Когда вы начнёте вязать, проект появится здесь для быстрого доступа."
        />
        <View style={styles.cta}>
          <Button
            title="Создать проект"
            onPress={() => router.push('/project/form')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll banner="projects">
      <Text style={styles.screenTitle}>Сегодня</Text>
      {featuredId ? (
        <ActiveProjectCard
          projectId={featuredId}
          onContinue={() => router.push(`/project/knit/${featuredId}`)}
        />
      ) : null}

      {activeProjects.length > 1 ? (
        <View style={styles.more}>
          <Text style={styles.moreLabel}>Другие активные проекты</Text>
          {activeProjects.slice(1).map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              primaryCounter={
                items.find((i) => i.project.id === p.id)?.primaryCounter ?? null
              }
              onPress={() => router.push(`/project/${p.id}`)}
              actionLabel="Продолжить вязание"
              onAction={() => router.push(`/project/knit/${p.id}`)}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.md,
  },
  loading: {
    ...typography.body,
    color: colors.textSecondary,
  },
  cta: {
    marginTop: spacing.lg,
  },
  more: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  moreLabel: {
    ...typography.subtitle,
    color: colors.textSecondary,
  },
});
