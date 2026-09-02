/**
 * Calculator — knitting gauge density.
 */

import React, { useState } from 'react';
import { Text } from 'react-native';

import {
  CalculatorLayout,
  CalculatorPrimaryResult,
} from '@/components/calculators/CalculatorLayout';
import { FormField } from '@/components/ui/FormField';
import { calculateGauge } from '@/domain/calculators';
import { formatGaugePer10 } from '@/domain/calculators/rounding';
import { parseRequiredNumber, useCalculatorRunner } from '@/hooks/useCalculatorRunner';

export default function GaugeCalculator() {
  const [width, setWidth] = useState('12');
  const [height, setHeight] = useState('12');
  const [stitches, setStitches] = useState('24');
  const [rows, setRows] = useState('33');
  const { result, explanation, error, run, clear } = useCalculatorRunner<
    ReturnType<typeof calculateGauge>['value']
  >();

  return (
    <CalculatorLayout
      title="Плотность вязания"
      description="Переводит размер образца в плотность на 10 см."
      onCalculate={() =>
        run(() =>
          calculateGauge({
            sampleWidthCm: parseRequiredNumber(width, 'ширину'),
            sampleHeightCm: parseRequiredNumber(height, 'высоту'),
            stitchesCounted: parseRequiredNumber(stitches, 'петли'),
            rowsCounted: parseRequiredNumber(rows, 'ряды'),
          })
        )
      }
      onClear={() => {
        clear();
        setWidth('12');
        setHeight('12');
        setStitches('24');
        setRows('33');
      }}
      error={error}
      explanation={explanation}
      result={
        result ? (
          <>
            <CalculatorPrimaryResult
              text={formatGaugePer10(result.stitchesPer10Cm, 'петель')}
            />
            <Text>{formatGaugePer10(result.rowsPer10Cm, 'рядов')}</Text>
            <Text style={{ opacity: 0.7 }}>
              {result.stitchesPerCm.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} п/см ·{' '}
              {result.rowsPerCm.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} р/см
            </Text>
          </>
        ) : null
      }
    >
      <FormField label="Ширина образца, см" value={width} onChangeText={setWidth} keyboardType="numeric" />
      <FormField label="Высота образца, см" value={height} onChangeText={setHeight} keyboardType="numeric" />
      <FormField label="Петель в образце" value={stitches} onChangeText={setStitches} keyboardType="numeric" />
      <FormField label="Рядов в образце" value={rows} onChangeText={setRows} keyboardType="numeric" />
    </CalculatorLayout>
  );
}
