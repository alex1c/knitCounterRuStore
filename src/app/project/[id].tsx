/**
 * Project details — parts, counters, navigation to knitting mode.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PromptModal } from '@/components/ui/PromptModal';
import { Screen } from '@/components/ui/Screen';
import {
  getCraftTypeLabel,
  getProjectStatusLabel,
} from '@/domain/labels';
import {
  formatNextRuleHint,
  getNextRuleOccurrence,
} from '@/domain/rowRuleEngine';
import type { Counter, ProjectPart, RowRule } from '@/domain/types';
import { parseSkeinQuantityInput } from '@/domain/yarnValidation';
import { useProjectDetail, type ProjectYarnDetail } from '@/hooks/useProjectDetail';
import { useDatabase } from '@/providers/DatabaseProvider';
import { formatDuration } from '@/repositories/KnittingSessionRepository';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import {
  formatCounterProgress,
  formatLinkedRepeatProgress,
  formatRepeatProgress,
  isLinkedCounter,
} from '@/utils/counterDisplay';
import { formatYarnColorLine, formatYarnTitle } from '@/utils/yarnDisplay';
import { formatSkeinQuantity, milliskeinsToSkeins } from '@/utils/yarnQuantity';

type PromptState = {
  title: string;
  defaultValue: string;
  keyboardType?: 'default' | 'numeric';
  onSubmit: (value: string) => void;
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, loading, reload } = useProjectDetail(id);
  const { projectPartRepository, counterRepository, projectRepository, rowRuleRepository, projectYarnRepository, yarnRepository, yarnUsageService } =
    useDatabase();
  const [newPartName, setNewPartName] = useState('');
  const [newCounterName, setNewCounterName] = useState('');
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [attachVisible, setAttachVisible] = useState(false);

  const showPrompt = (state: PromptState) => setPrompt(state);
  const closePrompt = () => setPrompt(null);

  if (loading || !detail) {
    return (
      <Screen>
        <Text style={styles.loading}>Загрузка…</Text>
      </Screen>
    );
  }

  const { project, parts, counters, rules, projectYarns, totalKnittingSeconds, activeRuleCount } = detail;
  const primaryCounter = counters.find((c) => c.isPrimary) ?? counters[0];

  const primaryRules = rules.filter(
    (r) => r.counterId === primaryCounter?.id && r.isActive
  );
  const nextRule =
    primaryCounter && primaryRules.length > 0
      ? getNextRuleOccurrence(primaryRules, primaryCounter.currentValue)
      : null;

  const handleDeleteProject = () => {
    Alert.alert(
      'Удалить проект?',
      'Проект, все счётчики и история изменений будут удалены безвозвратно.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            projectRepository?.deleteProject(project.id);
            router.replace('/(tabs)/projects');
          },
        },
      ]
    );
  };

  const handleAddPart = () => {
    const name = newPartName.trim();
    if (!name || !projectPartRepository) return;
    projectPartRepository.createPart({
      projectId: project.id,
      name,
      position: parts.length,
    });
    setNewPartName('');
    reload();
  };

  const handleRenamePart = (part: ProjectPart) => {
    showPrompt({
      title: 'Переименовать часть',
      defaultValue: part.name,
      onSubmit: (text) => {
        closePrompt();
        if (!text.trim() || !projectPartRepository) return;
        projectPartRepository.updatePart(part.id, { name: text.trim() });
        reload();
      },
    });
  };

  const handleDeletePart = (part: ProjectPart) => {
    Alert.alert(
      'Удалить часть?',
      'Счётчики этой части останутся в проекте.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            projectPartRepository?.deletePart(part.id);
            reload();
          },
        },
      ]
    );
  };

  const handleAddCounter = () => {
    const name = newCounterName.trim();
    if (!name || !counterRepository) return;
    counterRepository.createCounter({
      projectId: project.id,
      name,
      position: counters.length,
    });
    setNewCounterName('');
    reload();
  };

  const handleEditCounter = (counter: Counter) => {
    showPrompt({
      title: 'Название счётчика',
      defaultValue: counter.name,
      onSubmit: (name) => {
        closePrompt();
        if (!name.trim() || !counterRepository) return;
        counterRepository.updateCounter(counter.id, { name: name.trim() });
        reload();
      },
    });
  };

  const handleCounterTarget = (counter: Counter) => {
    showPrompt({
      title: 'Целевое значение',
      defaultValue: counter.targetValue?.toString() ?? '',
      keyboardType: 'numeric',
      onSubmit: (text) => {
        closePrompt();
        if (!counterRepository) return;
        const trimmed = text.trim();
        counterRepository.updateCounter(counter.id, {
          targetValue: trimmed === '' ? null : Number(trimmed),
        });
        reload();
      },
    });
  };

  const handleCounterRepeat = (counter: Counter) => {
    showPrompt({
      title: 'Длина повтора узора',
      defaultValue: counter.repeatLength?.toString() ?? '',
      keyboardType: 'numeric',
      onSubmit: (text) => {
        closePrompt();
        if (!counterRepository) return;
        const trimmed = text.trim();
        counterRepository.updateCounter(counter.id, {
          repeatLength: trimmed === '' ? null : Number(trimmed),
        });
        reload();
      },
    });
  };

  const handleLinkCounter = (counter: Counter) => {
    if (!primaryCounter || counter.id === primaryCounter.id || isLinkedCounter(counter)) {
      return;
    }
    showPrompt({
      title: 'Связать с основным счётчиком',
      defaultValue: counter.repeatLength?.toString() ?? '12',
      keyboardType: 'numeric',
      onSubmit: (text) => {
        closePrompt();
        if (!counterRepository) return;
        const n = Number(text.trim());
        if (!Number.isInteger(n) || n <= 0) return;
        counterRepository.updateCounter(counter.id, {
          parentCounterId: primaryCounter.id,
          linkType: 'follow_main',
          repeatLength: n,
        });
        reload();
      },
    });
  };

  const handleUnlinkCounter = (counter: Counter) => {
    if (!counterRepository) return;
    counterRepository.updateCounter(counter.id, {
      parentCounterId: null,
      linkType: null,
    });
    reload();
  };

  const handleToggleRule = (rule: RowRule) => {
    rowRuleRepository?.updateRule(rule.id, { isActive: !rule.isActive });
    reload();
  };

  const handleDeleteRule = (rule: RowRule) => {
    Alert.alert('Удалить действие?', rule.instruction, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          rowRuleRepository?.deleteRule(rule.id);
          reload();
        },
      },
    ]);
  };

  const availableYarns =
    yarnRepository?.listYarns().filter(
      (y) => !projectYarns.some((link) => link.yarnId === y.id)
    ) ?? [];

  const handleAttachYarn = (yarnId: string) => {
    if (!projectYarnRepository) return;
    try {
      projectYarnRepository.attachYarn(project.id, yarnId);
      setAttachVisible(false);
      reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось добавить';
      Alert.alert('Ошибка', message);
    }
  };

  const handleDetachYarn = (link: ProjectYarnDetail) => {
    Alert.alert(
      'Убрать пряжу из проекта?',
      formatYarnTitle(link.yarn),
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Убрать',
          style: 'destructive',
          onPress: () => {
            projectYarnRepository?.detachYarn(link.id);
            reload();
          },
        },
      ]
    );
  };

  const handleRecordUsage = (link: ProjectYarnDetail) => {
    showPrompt({
      title: 'Добавить расход',
      defaultValue: '0,3',
      keyboardType: 'numeric',
      onSubmit: (text) => {
        closePrompt();
        if (!yarnUsageService) return;
        try {
          const amount = parseSkeinQuantityInput(text);
          yarnUsageService.recordUsage(link.id, amount);
          reload();
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Не удалось списать';
          Alert.alert('Ошибка', message);
        }
      },
    });
  };

  const handleCorrectUsage = (link: ProjectYarnDetail) => {
    showPrompt({
      title: 'Использовано, мотков',
      defaultValue: String(milliskeinsToSkeins(link.usedQuantityMilliskeins)),
      keyboardType: 'numeric',
      onSubmit: (text) => {
        closePrompt();
        if (!yarnUsageService) return;
        try {
          const newUsed = parseSkeinQuantityInput(text);
          yarnUsageService.adjustUsedQuantity(link.id, newUsed);
          reload();
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Не удалось изменить';
          Alert.alert('Ошибка', message);
        }
      },
    });
  };

  const handleSetPlannedQuantity = (link: ProjectYarnDetail) => {
    const defaultValue =
      link.plannedQuantityMilliskeins != null
        ? String(milliskeinsToSkeins(link.plannedQuantityMilliskeins))
        : '';
    showPrompt({
      title: 'Планируется использовать, мотков',
      defaultValue,
      keyboardType: 'numeric',
      onSubmit: (text) => {
        closePrompt();
        if (!projectYarnRepository) return;
        try {
          const trimmed = text.trim();
          const planned =
            trimmed === '' ? null : parseSkeinQuantityInput(trimmed);
          projectYarnRepository.setPlannedQuantityMilliskeins(link.id, planned);
          reload();
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Не удалось сохранить';
          Alert.alert('Ошибка', message);
        }
      },
    });
  };

  const handleDeleteCounter = (counter: Counter) => {
    const eventCount = counterRepository?.countEventsByCounter(counter.id) ?? 0;
    const message =
      eventCount > 0
        ? `У счётчика «${counter.name}» есть история (${eventCount} записей). Удалить?`
        : `Удалить счётчик «${counter.name}»?`;

    Alert.alert('Удалить счётчик?', message, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          counterRepository?.deleteCounter(counter.id);
          reload();
        },
      },
    ]);
  };

  const openKnit = (counterId?: string) => {
    const params = counterId ? `?counterId=${counterId}` : '';
    router.push(`/project/knit/${project.id}${params}`);
  };

  return (
    <Screen scroll>
      <PromptModal
        visible={prompt !== null}
        title={prompt?.title ?? ''}
        defaultValue={prompt?.defaultValue}
        keyboardType={prompt?.keyboardType}
        onCancel={closePrompt}
        onSubmit={(v) => prompt?.onSubmit(v)}
      />

      <Modal visible={attachVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Выберите пряжу</Text>
            <ScrollView style={styles.modalList}>
              {availableYarns.map((yarn) => (
                <Pressable
                  key={yarn.id}
                  style={styles.modalItem}
                  onPress={() => handleAttachYarn(yarn.id)}
                >
                  <Text style={styles.modalItemTitle}>{formatYarnTitle(yarn)}</Text>
                  {formatYarnColorLine(yarn) ? (
                    <Text style={styles.counterMeta}>{formatYarnColorLine(yarn)}</Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
            <Button title="Отмена" variant="ghost" onPress={() => setAttachVisible(false)} />
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.title}>{project.name}</Text>
        <Text style={styles.meta}>
          {getProjectStatusLabel(project.status)} · {getCraftTypeLabel(project.craftType)}
          {project.projectType ? ` · ${project.projectType}` : ''}
        </Text>
        {project.notes ? (
          <Text style={styles.notes}>{project.notes}</Text>
        ) : null}
      </View>

      <Button
        title="Продолжить вязание"
        onPress={() => openKnit(primaryCounter?.id)}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Действия по рядам</Text>
        <Text style={styles.sectionMeta}>
          Активных: {activeRuleCount}
          {nextRule ? ` · ${formatNextRuleHint(nextRule)}` : ''}
        </Text>
        {rules.map((rule) => {
          const counterName =
            counters.find((c) => c.id === rule.counterId)?.name ?? '';
          return (
            <Card key={rule.id} style={styles.ruleCard}>
              <View style={styles.ruleHeader}>
                <Text style={[styles.ruleText, !rule.isActive && styles.ruleInactive]}>
                  {rule.instruction}
                </Text>
                <View style={styles.rowActions}>
                  <Pressable
                    accessibilityLabel={rule.isActive ? 'Отключить' : 'Включить'}
                    onPress={() => handleToggleRule(rule)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={rule.isActive ? 'eye-outline' : 'eye-off-outline'}
                      size={22}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Редактировать"
                    onPress={() =>
                      router.push(
                        `/project/rules/form?projectId=${project.id}&ruleId=${rule.id}`
                      )
                    }
                    hitSlop={8}
                  >
                    <Ionicons name="pencil-outline" size={22} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Удалить"
                    onPress={() => handleDeleteRule(rule)}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={22} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.counterMeta}>
                {counterName}
                {!rule.isActive ? ' · выключено' : ''}
              </Text>
            </Card>
          );
        })}
        <Button
          title="Добавить действие"
          variant="secondary"
          onPress={() =>
            router.push(
              `/project/rules/form?projectId=${project.id}&counterId=${primaryCounter?.id ?? ''}`
            )
          }
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Время вязания</Text>
        <Card>
          <Text style={styles.timerTotal}>
            Всего: {formatDuration(totalKnittingSeconds)}
          </Text>
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Пряжа</Text>
        {projectYarns.map((link) => {
          const colorLine = formatYarnColorLine(link.yarn);
          return (
            <Card key={link.id} style={styles.yarnCard}>
              <Pressable onPress={() => router.push(`/yarn/${link.yarnId}`)}>
                <Text style={styles.yarnTitle}>{formatYarnTitle(link.yarn)}</Text>
                {colorLine ? (
                  <Text style={styles.counterMeta}>{colorLine}</Text>
                ) : null}
                <Text style={styles.yarnUsed}>
                  Использовано: {formatSkeinQuantity(link.usedQuantityMilliskeins)}
                </Text>
                {link.plannedQuantityMilliskeins != null ? (
                  <Text style={styles.counterMeta}>
                    Планируется: {formatSkeinQuantity(link.plannedQuantityMilliskeins)}
                  </Text>
                ) : null}
                <Text style={styles.counterMeta}>
                  На складе: {formatSkeinQuantity(link.yarn.quantityMilliskeins)}
                </Text>
              </Pressable>
              <View style={styles.yarnActions}>
                <Button
                  title="Расход"
                  variant="ghost"
                  onPress={() => handleRecordUsage(link)}
                />
                <Button
                  title="Исправить"
                  variant="ghost"
                  onPress={() => handleCorrectUsage(link)}
                />
                <Button
                  title="План"
                  variant="ghost"
                  onPress={() => handleSetPlannedQuantity(link)}
                />
                <Button
                  title="Хватит?"
                  variant="ghost"
                  onPress={() =>
                    router.push(
                      `/calculators/yarn-enough?projectId=${project.id}&linkId=${link.id}`
                    )
                  }
                />
                <Button
                  title="Убрать"
                  variant="ghost"
                  onPress={() => handleDetachYarn(link)}
                />
              </View>
            </Card>
          );
        })}
        <Button
          title="Добавить пряжу"
          variant="secondary"
          onPress={() => {
            if (availableYarns.length === 0) {
              Alert.alert(
                'Нет пряжи',
                'Сначала добавьте пряжу в разделе «Пряжа».',
                [
                  { text: 'Отмена', style: 'cancel' },
                  {
                    text: 'Добавить',
                    onPress: () => router.push('/yarn/form'),
                  },
                ]
              );
              return;
            }
            setAttachVisible(true);
          }}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Части</Text>
        {parts.map((part) => (
          <Card key={part.id} style={styles.rowCard}>
            <Text style={styles.rowTitle}>{part.name}</Text>
            <View style={styles.rowActions}>
              <Pressable
                accessibilityLabel="Переименовать"
                onPress={() => handleRenamePart(part)}
                hitSlop={8}
              >
                <Ionicons name="pencil-outline" size={22} color={colors.primary} />
              </Pressable>
              <Pressable
                accessibilityLabel="Удалить часть"
                onPress={() => handleDeletePart(part)}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={22} color={colors.danger} />
              </Pressable>
            </View>
          </Card>
        ))}
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Новая часть"
            placeholderTextColor={colors.textMuted}
            value={newPartName}
            onChangeText={setNewPartName}
          />
          <Button title="Добавить" variant="secondary" onPress={handleAddPart} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Счётчики</Text>
        {counters.map((counter) => {
          const progress = formatCounterProgress(counter);
          const repeat = formatRepeatProgress(counter);
          const linkedLine =
            primaryCounter && isLinkedCounter(counter)
              ? formatLinkedRepeatProgress(primaryCounter, counter)
              : null;
          const partName = parts.find((p) => p.id === counter.projectPartId)?.name;
          return (
            <Card key={counter.id} style={styles.counterCard}>
              <Pressable onPress={() => !isLinkedCounter(counter) && openKnit(counter.id)}>
                <Text style={styles.counterName}>
                  {counter.name}
                  {counter.isPrimary ? ' · основной' : ''}
                  {isLinkedCounter(counter) ? ' · связан' : ''}
                </Text>
                <Text style={styles.counterValue}>
                  {isLinkedCounter(counter) && primaryCounter
                    ? formatLinkedRepeatProgress(primaryCounter, counter)?.split(' ').slice(1).join(' ') ??
                      '—'
                    : counter.currentValue}
                  {!isLinkedCounter(counter) && progress ? ` / ${counter.targetValue}` : ''}
                </Text>
                {repeat && !isLinkedCounter(counter) ? (
                  <Text style={styles.counterMeta}>Узор: {repeat}</Text>
                ) : null}
                {linkedLine ? (
                  <Text style={styles.counterMeta}>{linkedLine}</Text>
                ) : null}
                {partName ? (
                  <Text style={styles.counterMeta}>Часть: {partName}</Text>
                ) : null}
              </Pressable>
              <View style={styles.counterActions}>
                <Button
                  title="Цель"
                  variant="ghost"
                  onPress={() => handleCounterTarget(counter)}
                />
                <Button
                  title="Повтор"
                  variant="ghost"
                  onPress={() => handleCounterRepeat(counter)}
                />
                {!counter.isPrimary && !isLinkedCounter(counter) ? (
                  <Button
                    title="Связать"
                    variant="ghost"
                    onPress={() => handleLinkCounter(counter)}
                  />
                ) : null}
                {isLinkedCounter(counter) ? (
                  <Button
                    title="Отвязать"
                    variant="ghost"
                    onPress={() => handleUnlinkCounter(counter)}
                  />
                ) : null}
                <Button
                  title="Имя"
                  variant="ghost"
                  onPress={() => handleEditCounter(counter)}
                />
                <Pressable
                  accessibilityLabel="Удалить счётчик"
                  onPress={() => handleDeleteCounter(counter)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={22} color={colors.danger} />
                </Pressable>
              </View>
            </Card>
          );
        })}
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Новый счётчик"
            placeholderTextColor={colors.textMuted}
            value={newCounterName}
            onChangeText={setNewCounterName}
          />
          <Button title="Добавить" variant="secondary" onPress={handleAddCounter} />
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title="Редактировать проект"
          variant="secondary"
          onPress={() => router.push(`/project/form?id=${project.id}`)}
        />
        <Button title="Удалить проект" variant="danger" onPress={handleDeleteProject} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { ...typography.body, color: colors.textSecondary },
  header: { gap: spacing.xs, marginBottom: spacing.md },
  title: { ...typography.title, color: colors.text },
  meta: { ...typography.body, color: colors.textSecondary },
  notes: { ...typography.caption, color: colors.textMuted },
  section: { gap: spacing.sm, marginTop: spacing.lg },
  sectionTitle: { ...typography.subtitle, color: colors.text },
  sectionMeta: { ...typography.caption, color: colors.textMuted },
  ruleCard: { gap: spacing.xs },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ruleText: { ...typography.body, color: colors.text, flex: 1 },
  ruleInactive: { color: colors.textMuted, textDecorationLine: 'line-through' },
  timerTotal: { ...typography.subtitle, color: colors.text },
  yarnCard: { gap: spacing.sm },
  yarnTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  yarnUsed: { ...typography.body, color: colors.primary, fontWeight: '600' },
  yarnActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: '70%',
    gap: spacing.md,
  },
  modalTitle: { ...typography.subtitle, color: colors.text },
  modalList: { maxHeight: 320 },
  modalItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemTitle: { ...typography.body, color: colors.text },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: { ...typography.body, color: colors.text, flex: 1 },
  rowActions: { flexDirection: 'row', gap: spacing.md },
  counterCard: { gap: spacing.sm },
  counterName: { ...typography.body, fontWeight: '600', color: colors.text },
  counterValue: { ...typography.subtitle, color: colors.primary },
  counterMeta: { ...typography.caption, color: colors.textMuted },
  counterActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  addInput: {
    flex: 1,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  footer: { gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.xl },
});
