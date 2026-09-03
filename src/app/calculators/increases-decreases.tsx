/**
 * Calculator — increase/decrease distribution.
 */

import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';

import {
  CalculatorLayout,
  CalculatorPrimaryResult,
} from '@/components/calculators/CalculatorLayout';
import { FormField } from '@/components/ui/FormField';
import { distributeIncreasesDecreases } from '@/domain/calculators';
import { parseRequiredNumber, useCalculatorRunner } from '@/hooks/useCalculatorRunner';
import { Analytics } from '@/services/AnalyticsService';

export default function IncreasesDecreasesCalculator() {
  const [current, setCurrent] = useState('80');
  const [target, setTarget] = useState('92');
  const { result, explanation, error, run, clear } = useCalculatorRunner<
    ReturnType<typeof distributeIncreasesDecreases>['value']
  >('increases_decreases');

  useEffect(() => {
    Analytics.calculatorOpened('increases_decreases');
  }, []);

  useEffect(() => clear(), [clear, current, target]);

  return (
    <CalculatorLayout
      title="Прибавки и убавки"
      description="Равномерное распределение изменений по ряду."
      onCalculate={() =>
        run(() =>
          distributeIncreasesDecreases({
            currentStitches: parseRequiredNumber(current, 'текущие петли'),
            targetStitches: parseRequiredNumber(target, 'нужные петли'),
          })
        )
      }
      onClear={() => {
        clear();
        setCurrent('80');
        setTarget('92');
      }}
      error={error}
      explanation={explanation}
      result={
        result ? (
          <>
            <CalculatorPrimaryResult text={result.instruction} />
            {result.warning ? <Text>{result.warning}</Text> : null}
          </>
        ) : null
      }
    >
      <FormField label="Сейчас петель" value={current} onChangeText={setCurrent} keyboardType="numeric" />
      <FormField label="Нужно петель" value={target} onChangeText={setTarget} keyboardType="numeric" />
    </CalculatorLayout>
  );
}
