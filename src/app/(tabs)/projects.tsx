/**
 * Проекты — project list with create and open.
 */

import { router } from 'expo-router';
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { ProjectCard } from '@/components/project/ProjectCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useProjectList } from '@/hooks/useProjectList';
import { colors, spacing, typography } from '@/theme/tokens';

export default function ProjectsScreen() {
  const { items, loading } = useProjectList();

  if (loading) {
    return (
      <Screen banner="projects">
        <Text style={styles.loading}>Загрузка…</Text>
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen banner="projects">
        <EmptyState
          title="Пока нет проектов"
          description="Создайте первый проект — счётчик рядов всегда будет под рукой."
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
    <Screen banner="projects" contentStyle={styles.screenContent}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.project.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Button
            title="Создать проект"
            onPress={() => router.push('/project/form')}
            style={styles.createBtn}
          />
        }
        renderItem={({ item }) => (
          <ProjectCard
            project={item.project}
            primaryCounter={item.primaryCounter}
            onPress={() => router.push(`/project/${item.project.id}`)}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    flex: 1,
  },
  list: {
    padding: spacing.md,
    gap: spacing.md,
  },
  createBtn: {
    marginBottom: spacing.md,
  },
  loading: {
    ...typography.body,
    color: colors.textSecondary,
  },
  cta: {
    marginTop: spacing.lg,
  },
});
