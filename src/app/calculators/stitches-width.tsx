/**
 * Calculator — stitches for width.
 */

import React, { useState } from 'react';
import { Text } from 'react-native';

import {
  CalculatorLayout,
  CalculatorPrimaryResult,
} from '@/components/calculators/CalculatorLayout';
import { FormField } from '@/components/ui/FormField';
import { calculateStitchesForWidth } from '@/domain/calculators';
import {
  parseOptionalInt,
  parseOptionalNumber,
  parseRequiredNumber,
  useCalculatorRunner,
} from '@/hooks/useCalculatorRunner';

export default function StitchesWidthCalculator() {
  const [gaugeStitches, setGaugeStitches] = useState('20');
  const [gaugeWidth, setGaugeWidth] = useState('10');
  const [desiredWidth, setDesiredWidth] = useState('48');
  const [edgeStitches, setEdgeStitches] = useState('0');
  const [repeatSize, setRepeatSize] = useState('');
  const [repeatFixed, setRepeatFixed] = useState('0');
  const { result, explanation, error, run, clear } = useCalculatorRunner<
    ReturnType<typeof calculateStitchesForWidth>['value']
  >();

  const handleCalculate = () => {
    run(() =>
      calculateStitchesForWidth({
        gaugeStitches: parseRequiredNumber(gaugeStitches, 'петли в образце'),
        gaugeWidthCm: parseRequiredNumber(gaugeWidth, 'ширину образца'),
        desiredWidthCm: parseRequiredNumber(desiredWidth, 'нужную ширину'),
        edgeStitches: parseOptionalInt(edgeStitches, 0),
        repeatSize: parseOptionalNumber(repeatSize),
        repeatFixed: parseOptionalInt(repeatFixed, 0),
      })
    );
  };

  const handleClear = () => {
    clear();
    setGaugeStitches('20');
    setGaugeWidth('10');
    setDesiredWidth('48');
    setEdgeStitches('0');
    setRepeatSize('');
    setRepeatFixed('0');
  };

  return (
    <CalculatorLayout
      title="Петли по ширине"
      description="Сколько петель нужно для заданной ширины по вашей плотности."
      onCalculate={handleCalculate}
      onClear={handleClear}
      error={error}
      explanation={explanation}
      result={
        result ? (
          <>
            <CalculatorPrimaryResult text={`${result.totalStitches} петель`} />
            {result.edgeStitches > 0 ? (
              <Text>
                {result.recommendedBodyStitches} + {result.edgeStitches} кромочные
              </Text>
            ) : null}
          </>
        ) : null
      }
    >
      <FormField label="Петель в образце" value={gaugeStitches} onChangeText={setGaugeStitches} keyboardType="numeric" />
      <FormField label="Ширина образца, см" value={gaugeWidth} onChangeText={setGaugeWidth} keyboardType="numeric" />
      <FormField label="Нужная ширина, см" value={desiredWidth} onChangeText={setDesiredWidth} keyboardType="numeric" />
      <FormField label="Кромочные петли" value={edgeStitches} onChangeText={setEdgeStitches} keyboardType="numeric" />
      <FormField label="Раппорт узора (необязательно)" value={repeatSize} onChangeText={setRepeatSize} keyboardType="numeric" placeholder="6" />
      <FormField label="Доп. петли к раппорту (+N)" value={repeatFixed} onChangeText={setRepeatFixed} keyboardType="numeric" placeholder="2" />
    </CalculatorLayout>
  );
}
