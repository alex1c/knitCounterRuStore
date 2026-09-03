/**
 * Rule editor — create/edit row actions.
 */

import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { OptionPicker } from '@/components/ui/OptionPicker';
import { Screen } from '@/components/ui/Screen';
import type { RowRuleType } from '@/domain/codes';
import { parseRowListInput } from '@/domain/rowRuleValidation';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useDatabase } from '@/providers/DatabaseProvider';
import { Analytics } from '@/services/AnalyticsService';
import { colors, spacing, typography } from '@/theme/tokens';
import { isLinkedCounter } from '@/utils/counterDisplay';

type WhenOption = 'exact' | 'every_n' | 'every_n_from' | 'list';

const WHEN_OPTIONS: { value: WhenOption; label: string }[] = [
  { value: 'exact', label: 'На конкретном ряду' },
  { value: 'every_n', label: 'Каждые N рядов' },
  { value: 'every_n_from', label: 'Каждые N рядов начиная с…' },
  { value: 'list', label: 'На выбранных рядах' },
];

const PRESETS = [
  'Убавить 1 петлю с каждой стороны',
  'Прибавить 1 петлю',
  'Сменить цвет',
  'Начать резинку',
  'Закрыть 5 петель',
];

export default function RuleFormScreen() {
  const { projectId, ruleId, counterId } = useLocalSearchParams<{
    projectId: string;
    ruleId?: string;
    counterId?: string;
  }>();
  const isEdit = Boolean(ruleId);
  const { detail } = useProjectDetail(projectId);
  const { rowRuleRepository } = useDatabase();

  const [whenType, setWhenType] = useState<WhenOption>('every_n');
  const [exactRow, setExactRow] = useState('');
  const [everyN, setEveryN] = useState('6');
  const [startRow, setStartRow] = useState('20');
  const [listRows, setListRows] = useState('30, 42, 54');
  const [instruction, setInstruction] = useState('');
  const [selectedCounterId, setSelectedCounterId] = useState(counterId ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit || !ruleId || !rowRuleRepository) return;
    const rule = rowRuleRepository.getRuleById(ruleId);
    if (!rule) return;

    queueMicrotask(() => {
      setWhenType(rule.ruleType);
      setInstruction(rule.instruction);
      setSelectedCounterId(rule.counterId);
      setExactRow(rule.exactRow?.toString() ?? '');
      setEveryN(rule.everyNRows?.toString() ?? '');
      setStartRow(rule.startRow?.toString() ?? '');
      setListRows(rule.listRows.join(', '));
    });
  }, [isEdit, ruleId, rowRuleRepository]);

  useEffect(() => {
    if (!selectedCounterId && detail?.counters.length) {
      const primary = detail.counters.find((c) => c.isPrimary) ?? detail.counters[0];
      queueMicrotask(() => setSelectedCounterId(primary.id));
    }
  }, [detail, selectedCounterId]);

  const counterOptions =
    detail?.counters
      .filter((c) => !isLinkedCounter(c))
      .map((c) => ({ value: c.id, label: c.name })) ?? [];

  const handleSave = () => {
    if (!rowRuleRepository || !projectId || !selectedCounterId) return;

    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction) {
      Alert.alert('Ошибка', 'Укажите, что нужно сделать.');
      return;
    }

    setSaving(true);
    try {
      const ruleType: RowRuleType = whenType;
      const base = {
        instruction: trimmedInstruction,
        name: trimmedInstruction.slice(0, 40),
      };

      if (isEdit && ruleId) {
        rowRuleRepository.updateRule(ruleId, {
          ...base,
          exactRow:
            whenType === 'exact' ? Number(exactRow) : null,
          everyNRows:
            whenType === 'every_n' || whenType === 'every_n_from'
              ? Number(everyN)
              : null,
          startRow: whenType === 'every_n_from' ? Number(startRow) : null,
          listRows:
            whenType === 'list' ? parseRowListInput(listRows) : undefined,
        });
      } else {
        rowRuleRepository.createRule({
          projectId,
          counterId: selectedCounterId,
          ruleType,
          ...base,
          exactRow: whenType === 'exact' ? Number(exactRow) : null,
          everyNRows:
            whenType === 'every_n' || whenType === 'every_n_from'
              ? Number(everyN)
              : null,
          startRow: whenType === 'every_n_from' ? Number(startRow) : null,
          listRows: whenType === 'list' ? parseRowListInput(listRows) : [],
        });
        // Only whenType / rule type string — never instruction text
        Analytics.rowRuleCreated(ruleType);
      }
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>
            {isEdit ? 'Редактировать действие' : 'Новое действие по рядам'}
          </Text>

          {counterOptions.length > 1 ? (
            <OptionPicker
              label="Счётчик"
              options={counterOptions}
              value={selectedCounterId}
              onChange={setSelectedCounterId}
            />
          ) : null}

          <OptionPicker
            label="Когда?"
            options={WHEN_OPTIONS}
            value={whenType}
            onChange={setWhenType}
          />

          {whenType === 'exact' ? (
            <FormField
              label="Номер ряда"
              value={exactRow}
              onChangeText={setExactRow}
              keyboardType="numeric"
            />
          ) : null}

          {whenType === 'every_n' || whenType === 'every_n_from' ? (
            <FormField
              label="Каждые N рядов"
              value={everyN}
              onChangeText={setEveryN}
              keyboardType="numeric"
            />
          ) : null}

          {whenType === 'every_n_from' ? (
            <FormField
              label="Начиная с ряда"
              value={startRow}
              onChangeText={setStartRow}
              keyboardType="numeric"
            />
          ) : null}

          {whenType === 'list' ? (
            <FormField
              label="Ряды (через запятую)"
              value={listRows}
              onChangeText={setListRows}
              placeholder="30, 42, 54"
            />
          ) : null}

          <Text style={styles.label}>Что сделать?</Text>
          <View style={styles.presets}>
            {PRESETS.map((preset) => (
              <Button
                key={preset}
                title={preset}
                variant="secondary"
                onPress={() => setInstruction(preset)}
              />
            ))}
          </View>
          <FormField
            label="Инструкция"
            required
            value={instruction}
            onChangeText={setInstruction}
            multiline
            style={styles.instruction}
          />

          <View style={styles.actions}>
            <Button title="Сохранить" onPress={handleSave} disabled={saving} />
            <Button title="Отмена" variant="ghost" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { gap: spacing.md, paddingBottom: spacing.xl },
  title: { ...typography.title, color: colors.text },
  label: { ...typography.body, fontWeight: '600', color: colors.text },
  presets: { gap: spacing.sm },
  instruction: { minHeight: 80, textAlignVertical: 'top' },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
