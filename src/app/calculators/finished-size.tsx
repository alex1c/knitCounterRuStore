/**
 * Calculator — finished size from stitches/rows.
 */

import React, { useState } from 'react';
import { Text } from 'react-native';

import {
  CalculatorLayout,
  CalculatorPrimaryResult,
} from '@/components/calculators/CalculatorLayout';
import { FormField } from '@/components/ui/FormField';
import { calculateFinishedSize } from '@/domain/calculators';
import { formatCm } from '@/domain/calculators/rounding';
import {
  parseOptionalNumber,
  parseRequiredNumber,
  useCalculatorRunner,
} from '@/hooks/useCalculatorRunner';

export default function FinishedSizeCalculator() {
  const [stitches, setStitches] = useState('96');
  const [rows, setRows] = useState('');
  const [gaugeStitches, setGaugeStitches] = useState('20');
  const [gaugeRows, setGaugeRows] = useState('28');
  const [gaugeWidth, setGaugeWidth] = useState('10');
  const [gaugeHeight, setGaugeHeight] = useState('10');
  const { result, explanation, error, run, clear } = useCalculatorRunner<
    ReturnType<typeof calculateFinishedSize>['value']
  >();

  return (
    <CalculatorLayout
      title="Размер по петлям"
      description="Какой получится размер при заданном количестве петель и рядов."
      onCalculate={() =>
        run(() =>
          calculateFinishedSize({
            stitchCount: parseRequiredNumber(stitches, 'петли'),
            rowCount: parseOptionalNumber(rows),
            gaugeStitches: parseRequiredNumber(gaugeStitches, 'петли в образце'),
            gaugeRows: parseOptionalNumber(gaugeRows),
            gaugeWidthCm: parseRequiredNumber(gaugeWidth, 'ширину образца'),
            gaugeHeightCm: parseOptionalNumber(gaugeHeight),
          })
        )
      }
      onClear={() => {
        clear();
        setStitches('96');
        setRows('');
        setGaugeStitches('20');
        setGaugeRows('28');
        setGaugeWidth('10');
        setGaugeHeight('10');
      }}
      error={error}
      explanation={explanation}
      result={
        result ? (
          <>
            <CalculatorPrimaryResult text={formatCm(result.widthCm)} />
            {result.heightCm != null ? (
              <Text>Высота: {formatCm(result.heightCm)}</Text>
            ) : null}
          </>
        ) : null
      }
    >
      <FormField label="Петель" value={stitches} onChangeText={setStitches} keyboardType="numeric" />
      <FormField label="Рядов (необязательно)" value={rows} onChangeText={setRows} keyboardType="numeric" />
      <FormField label="Петель в образце" value={gaugeStitches} onChangeText={setGaugeStitches} keyboardType="numeric" />
      <FormField label="Рядов в образце" value={gaugeRows} onChangeText={setGaugeRows} keyboardType="numeric" />
      <FormField label="Ширина образца, см" value={gaugeWidth} onChangeText={setGaugeWidth} keyboardType="numeric" />
      <FormField label="Высота образца, см" value={gaugeHeight} onChangeText={setGaugeHeight} keyboardType="numeric" />
    </CalculatorLayout>
  );
}
