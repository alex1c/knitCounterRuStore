/**
 * Calculator — yarn substitution by length.
 */

import React, { useState } from 'react';
import { Text } from 'react-native';

import {
  CalculatorLayout,
  CalculatorPrimaryResult,
} from '@/components/calculators/CalculatorLayout';
import { ReserveField } from '@/components/calculators/ReserveField';
import { YarnPickerModal } from '@/components/calculators/YarnPickerModal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { calculateYarnSubstitution } from '@/domain/calculators';
import { formatSkeinPurchase } from '@/domain/calculators/rounding';
import type { Yarn } from '@/domain/types';
import {
  parseOptionalNumber,
  parseRequiredNumber,
  useCalculatorRunner,
} from '@/hooks/useCalculatorRunner';
import { useDatabase } from '@/providers/DatabaseProvider';
import { formatMoneyMinor } from '@/utils/yarnQuantity';

export default function YarnSubstitutionCalculator() {
  const { yarnRepository } = useDatabase();
  const [origSkeins, setOrigSkeins] = useState('8');
  const [origMeters, setOrigMeters] = useState('120');
  const [replMeters, setReplMeters] = useState('175');
  const [replWeight, setReplWeight] = useState('');
  const [reserve, setReserve] = useState('10');
  const [price, setPrice] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const { result, explanation, error, run, clear } = useCalculatorRunner<
    ReturnType<typeof calculateYarnSubstitution>['value']
  >();

  const pickYarn = (yarn: Yarn) => {
    if (yarn.lengthPerSkeinM) setReplMeters(String(yarn.lengthPerSkeinM));
    if (yarn.weightPerSkeinG) setReplWeight(String(yarn.weightPerSkeinG));
    if (yarn.purchasePriceMinor != null) {
      setPrice(String(yarn.purchasePriceMinor / 100).replace('.', ','));
    }
  };

  return (
    <>
      <CalculatorLayout
        title="Замена пряжи"
        description="Сколько мотков новой пряжи нужно по метражу."
        onCalculate={() =>
          run(() =>
            calculateYarnSubstitution({
              originalSkeinCount: parseRequiredNumber(origSkeins, 'мотки'),
              originalMetersPerSkein: parseRequiredNumber(origMeters, 'метраж'),
              replacementMetersPerSkein: parseRequiredNumber(replMeters, 'метраж новой пряжи'),
              replacementWeightPerSkeinG: parseOptionalNumber(replWeight),
              reservePercent: parseRequiredNumber(reserve, 'запас'),
              replacementPricePerSkeinMinor:
                price.trim() === ''
                  ? undefined
                  : Math.round(parseRequiredNumber(price, 'цену') * 100),
            })
          )
        }
        onClear={() => {
          clear();
          setOrigSkeins('8');
          setOrigMeters('120');
          setReplMeters('175');
          setReplWeight('');
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
        <FormField label="Мотков по описанию" value={origSkeins} onChangeText={setOrigSkeins} keyboardType="numeric" />
        <FormField label="Метров в мотке (оригинал)" value={origMeters} onChangeText={setOrigMeters} keyboardType="numeric" />
        <Button title="Выбрать новую пряжу из склада" variant="secondary" onPress={() => setPickerVisible(true)} />
        <FormField label="Метров в мотке (замена)" value={replMeters} onChangeText={setReplMeters} keyboardType="numeric" />
        <FormField label="Вес мотка, г (необязательно)" value={replWeight} onChangeText={setReplWeight} keyboardType="numeric" />
        <ReserveField value={reserve} onChange={setReserve} />
        <FormField label="Цена за моток, ₽" value={price} onChangeText={setPrice} keyboardType="numeric" />
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
