/**
 * Calculator — yarn requirement (grams or meters).
 */

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
import { calculateYarnRequirement } from '@/domain/calculators';
import { formatSkeinPurchase } from '@/domain/calculators/rounding';
import type { Yarn } from '@/domain/types';
import {
  parseOptionalNumber,
  parseRequiredNumber,
  useCalculatorRunner,
} from '@/hooks/useCalculatorRunner';
import { useDatabase } from '@/providers/DatabaseProvider';
import { formatMoneyMinor, parsePriceToMinor } from '@/utils/yarnQuantity';

const MODE_OPTIONS = [
  { value: 'grams', label: 'По весу (г)' },
  { value: 'meters', label: 'По длине (м)' },
] as const;

type RequirementMode = (typeof MODE_OPTIONS)[number]['value'];

export default function YarnRequiredCalculator() {
  const { yarnRepository } = useDatabase();
  const [mode, setMode] = useState<RequirementMode>('grams');
  const [required, setRequired] = useState('450');
  const [weight, setWeight] = useState('100');
  const [length, setLength] = useState('');
  const [reserve, setReserve] = useState('10');
  const [price, setPrice] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const { result, explanation, error, run, clear } = useCalculatorRunner<
    ReturnType<typeof calculateYarnRequirement>['value']
  >();

  useEffect(() => clear(), [clear, mode, required, weight, length, reserve, price]);

  const pickYarn = (yarn: Yarn) => {
    if (yarn.weightPerSkeinG) setWeight(String(yarn.weightPerSkeinG));
    if (yarn.lengthPerSkeinM) setLength(String(yarn.lengthPerSkeinM));
    if (yarn.purchasePriceMinor != null) {
      setPrice(String(yarn.purchasePriceMinor / 100).replace('.', ','));
    }
  };

  return (
    <>
      <CalculatorLayout
        title="Сколько нужно пряжи"
        description="Расчёт целых мотков с запасом по известному расходу."
        onCalculate={() =>
          run(() => {
            const reservePercent = parseRequiredNumber(reserve, 'запас');
            const priceMinor =
              price.trim() === ''
                ? undefined
                : parsePriceToMinor(price) ?? undefined;
            if (mode === 'grams') {
              return calculateYarnRequirement({
                mode: 'grams',
                requiredGrams: parseRequiredNumber(required, 'вес'),
                weightPerSkeinG: parseRequiredNumber(weight, 'вес мотка'),
                lengthPerSkeinM: parseOptionalNumber(length),
                reservePercent,
                pricePerSkeinMinor: priceMinor,
              });
            }
            return calculateYarnRequirement({
              mode: 'meters',
              requiredMeters: parseRequiredNumber(required, 'длину'),
              metersPerSkein: parseRequiredNumber(length || weight, 'метраж мотка'),
              reservePercent,
              pricePerSkeinMinor: priceMinor,
            });
          })
        }
        onClear={() => {
          clear();
          setRequired('450');
          setWeight('100');
          setLength('');
          setReserve('10');
          setPrice('');
        }}
        error={error}
        explanation={explanation}
        result={
          result ? (
            <>
              <CalculatorPrimaryResult text={formatSkeinPurchase(result.skeinsToBuy)} />
              {result.totalCostMinor != null ? (
                <Text>Стоимость: {formatMoneyMinor(result.totalCostMinor)}</Text>
              ) : null}
            </>
          ) : null
        }
      >
        <OptionPicker
          label="Режим"
          options={MODE_OPTIONS}
          value={mode}
          onChange={(value) => setMode(value)}
        />
        <Button title="Выбрать из моей пряжи" variant="secondary" onPress={() => setPickerVisible(true)} />
        <FormField
          label={mode === 'grams' ? 'Нужно, г' : 'Нужно, м'}
          value={required}
          onChangeText={setRequired}
          keyboardType="numeric"
        />
        {mode === 'grams' ? (
          <>
            <FormField label="Вес мотка, г" value={weight} onChangeText={setWeight} keyboardType="numeric" />
            <FormField label="Метраж мотка, м (необязательно)" value={length} onChangeText={setLength} keyboardType="numeric" />
          </>
        ) : (
          <FormField label="Метраж мотка, м" value={length} onChangeText={setLength} keyboardType="numeric" />
        )}
        <ReserveField value={reserve} onChange={setReserve} />
        <FormField label="Цена за моток, ₽ (необязательно)" value={price} onChangeText={setPrice} keyboardType="numeric" />
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
