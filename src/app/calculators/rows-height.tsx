/**
 * Calculator — rows for height.
 */

import React, { useEffect, useState } from 'react';

import {
  CalculatorLayout,
  CalculatorPrimaryResult,
} from '@/components/calculators/CalculatorLayout';
import { FormField } from '@/components/ui/FormField';
import { calculateRowsForHeight } from '@/domain/calculators';
import {
  parseOptionalNumber,
  parseRequiredNumber,
  useCalculatorRunner,
} from '@/hooks/useCalculatorRunner';
import { Analytics } from '@/services/AnalyticsService';

export default function RowsHeightCalculator() {
  const [gaugeRows, setGaugeRows] = useState('28');
  const [gaugeHeight, setGaugeHeight] = useState('10');
  const [desiredHeight, setDesiredHeight] = useState('35');
  const [rowRepeat, setRowRepeat] = useState('');
  const { result, explanation, error, run, clear } = useCalculatorRunner<
    ReturnType<typeof calculateRowsForHeight>['value']
  >('rows_height');

  useEffect(() => {
    Analytics.calculatorOpened('rows_height');
  }, []);

  useEffect(() => clear(), [clear, gaugeRows, gaugeHeight, desiredHeight, rowRepeat]);

  return (
    <CalculatorLayout
      title="Ряды по высоте"
      description="Сколько рядов нужно для заданной высоты."
      onCalculate={() =>
        run(() =>
          calculateRowsForHeight({
            gaugeRows: parseRequiredNumber(gaugeRows, 'ряды в образце'),
            gaugeHeightCm: parseRequiredNumber(gaugeHeight, 'высоту образца'),
            desiredHeightCm: parseRequiredNumber(desiredHeight, 'нужную высоту'),
            rowRepeatSize: parseOptionalNumber(rowRepeat),
          })
        )
      }
      onClear={() => {
        clear();
        setGaugeRows('28');
        setGaugeHeight('10');
        setDesiredHeight('35');
        setRowRepeat('');
      }}
      error={error}
      explanation={explanation}
      result={
        result ? (
          <CalculatorPrimaryResult text={`${result.recommendedRows} рядов`} />
        ) : null
      }
    >
      <FormField label="Рядов в образце" value={gaugeRows} onChangeText={setGaugeRows} keyboardType="numeric" />
      <FormField label="Высота образца, см" value={gaugeHeight} onChangeText={setGaugeHeight} keyboardType="numeric" />
      <FormField label="Нужная высота, см" value={desiredHeight} onChangeText={setDesiredHeight} keyboardType="numeric" />
      <FormField label="Раппорт по высоте (необязательно)" value={rowRepeat} onChangeText={setRowRepeat} keyboardType="numeric" />
    </CalculatorLayout>
  );
}
