/**
 * Calculator — enough yarn check (read-only inventory).
 */

import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';

import {
  CalculatorLayout,
  CalculatorPrimaryResult,
} from '@/components/calculators/CalculatorLayout';
import { ReserveField } from '@/components/calculators/ReserveField';
import { YarnPickerModal } from '@/components/calculators/YarnPickerModal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { OptionPicker } from '@/components/ui/OptionPicker';
import { checkYarnAvailability } from '@/domain/calculators';
import type { Yarn } from '@/domain/types';
import {
  parseRequiredNumber,
  useCalculatorRunner,
} from '@/hooks/useCalculatorRunner';
import { useDatabase } from '@/providers/DatabaseProvider';
import { formatYarnTitle } from '@/utils/yarnDisplay';
import { MILLISKEINS_PER_SKEIN } from '@/utils/yarnQuantity';
import { parseSkeinQuantityInput } from '@/domain/yarnValidation';

const UNIT_OPTIONS = [
  { value: 'skeins', label: 'Мотки' },
  { value: 'grams', label: 'Граммы' },
  { value: 'meters', label: 'Метры' },
] as const;

type UnitMode = (typeof UNIT_OPTIONS)[number]['value'];

function resolveProjectYarnSeed(
  projectId: string | undefined,
  linkId: string | undefined,
  projectYarnRepository: ReturnType<typeof useDatabase>['projectYarnRepository'],
  yarnRepository: ReturnType<typeof useDatabase>['yarnRepository']
): { yarn: Yarn | null; required: string } {
  if (!projectId || !linkId || !projectYarnRepository || !yarnRepository) {
    return { yarn: null, required: '4,3' };
  }
  const link = projectYarnRepository.getLinkById(linkId);
  if (!link || link.projectId !== projectId) return { yarn: null, required: '4,3' };
  const yarn = yarnRepository.getYarnById(link.yarnId);
  if (!yarn) return { yarn: null, required: '4,3' };
  const required =
    link.plannedQuantityMilliskeins != null
      ? String(link.plannedQuantityMilliskeins / MILLISKEINS_PER_SKEIN).replace('.', ',')
      : '4,3';
  return { yarn, required };
}

export default function YarnEnoughCalculator() {
  const { projectId, linkId } = useLocalSearchParams<{
    projectId?: string;
    linkId?: string;
  }>();
  const { yarnRepository, projectYarnRepository } = useDatabase();
  const seed = resolveProjectYarnSeed(projectId, linkId, projectYarnRepository, yarnRepository);
  const [unit, setUnit] = useState<UnitMode>('skeins');
  const [required, setRequired] = useState(seed.required);
  const [reserve, setReserve] = useState('0');
  const [selectedYarn, setSelectedYarn] = useState<Yarn | null>(seed.yarn);
  const [pickerVisible, setPickerVisible] = useState(false);
  const { result, explanation, error, run, clear } = useCalculatorRunner<
    ReturnType<typeof checkYarnAvailability>['value']
  >();

  useEffect(() => clear(), [clear, unit, required, reserve, selectedYarn]);

  const pickYarn = (yarn: Yarn) => {
    clear();
    setSelectedYarn(yarn);
  };

  const savePlanned = () => {
    if (!projectId || !linkId || !projectYarnRepository || !result || !selectedYarn) return;
    try {
      const link = projectYarnRepository.getLinkById(linkId);
      if (!link || link.projectId !== projectId || link.yarnId !== selectedYarn.id) return;
      projectYarnRepository.setPlannedQuantityMilliskeins(
        linkId,
        result.requiredMilliskeins
      );
      router.back();
    } catch {
      // ignore — optional integration
    }
  };

  return (
    <>
      <CalculatorLayout
        title="Хватит ли пряжи?"
        description="Проверка запаса на складе. Склад не изменяется."
        onCalculate={() => {
          if (!selectedYarn) {
            run(() => {
              throw new Error('Выберите пряжу из склада');
            });
            return;
          }
          run(() => {
            const reservePercent = parseRequiredNumber(reserve, 'запас');
            const base = {
              stockMilliskeins: selectedYarn.quantityMilliskeins,
              weightPerSkeinG: selectedYarn.weightPerSkeinG,
              lengthPerSkeinM: selectedYarn.lengthPerSkeinM,
              reservePercent,
            };
            if (unit === 'skeins') {
              return checkYarnAvailability({
                ...base,
                requiredMilliskeins: parseSkeinQuantityInput(required),
              });
            }
            if (unit === 'grams') {
              return checkYarnAvailability({
                ...base,
                requiredGrams: parseRequiredNumber(required, 'граммы'),
              });
            }
            return checkYarnAvailability({
              ...base,
              requiredMeters: parseRequiredNumber(required, 'метры'),
            });
          });
        }}
        onClear={() => {
          clear();
          setRequired('4,3');
          setReserve('0');
          setSelectedYarn(null);
        }}
        error={error}
        explanation={explanation}
        result={
          result ? (
            <>
              <CalculatorPrimaryResult text={result.enough ? 'Хватит' : 'Не хватит'} />
              {result.differenceGrams != null ? (
                <Text>
                  {result.enough ? 'Останется' : 'Не хватает'}: ≈{' '}
                  {Math.abs(result.differenceGrams)} г
                </Text>
              ) : null}
              {projectId && linkId && result ? (
                <Button
                  title="Сохранить как планируемое"
                  variant="secondary"
                  onPress={savePlanned}
                />
              ) : null}
            </>
          ) : null
        }
      >
        <Button title="Выбрать пряжу" variant="secondary" onPress={() => setPickerVisible(true)} />
        {selectedYarn ? (
          <Text>
            {formatYarnTitle(selectedYarn)} · в наличии{' '}
            {(selectedYarn.quantityMilliskeins / MILLISKEINS_PER_SKEIN).toLocaleString('ru-RU')} мотка
          </Text>
        ) : null}
        <OptionPicker
          label="Единица"
          options={UNIT_OPTIONS}
          value={unit}
          onChange={(value) => { clear(); setUnit(value); }}
        />
        <FormField label="Нужно" value={required} onChangeText={(value) => { clear(); setRequired(value); }} keyboardType="numeric" />
        <ReserveField value={reserve} onChange={(value) => { clear(); setReserve(value); }} />
      </CalculatorLayout>
      <YarnPickerModal
        visible={pickerVisible}
        yarns={yarnRepository?.listYarns() ?? []}
        onSelect={pickYarn}
        onClose={() => setPickerVisible(false)}
      />
    </>
  );
}
