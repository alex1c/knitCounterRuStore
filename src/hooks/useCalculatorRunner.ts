/**
 * Hook to run calculator with validation error handling.
 */

import { useCallback, useState } from 'react';

import { CalculatorValidationError } from '@/domain/calculators/validation';
import { Analytics } from '@/services/AnalyticsService';
import { InterstitialAdService } from '@/services/InterstitialAdService';
import { finalizeNumber } from '@/utils/numeric';

export function useCalculatorRunner<T>(calculatorType?: string) {
  const [result, setResult] = useState<T | null>(null);
  const [explanation, setExplanation] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback((fn: () => { value: T; explanation: string[] }) => {
    try {
      setError(null);
      const out = fn();
      setResult(out.value);
      setExplanation(out.explanation);
      // Monetization/analytics after result is already applied — never delay UI
      if (calculatorType) {
        Analytics.calculatorCalculated(calculatorType);
      }
      void InterstitialAdService.onSuccessfulCalculation();
    } catch (err) {
      setResult(null);
      setExplanation([]);
      if (err instanceof CalculatorValidationError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Не удалось рассчитать');
      }
    }
  }, [calculatorType]);

  const clear = useCallback(() => {
    setResult(null);
    setExplanation([]);
    setError(null);
  }, []);

  return { result, explanation, error, run, clear };
}

/** Parses required numeric field from form string. */
export function parseRequiredNumber(input: string, label: string): number {
  const value = finalizeNumber(input);
  if (value == null) {
    throw new CalculatorValidationError(`Укажите ${label}`);
  }
  return value;
}

/** Parses optional numeric field; empty → undefined. */
export function parseOptionalNumber(input: string): number | undefined {
  if (input.trim() === '') return undefined;
  const value = finalizeNumber(input);
  if (value == null) {
    throw new CalculatorValidationError('Некорректное число');
  }
  return value;
}

/** Parses optional non-negative integer; empty → 0. */
export function parseOptionalInt(input: string, fallback = 0): number {
  if (input.trim() === '') return fallback;
  const value = finalizeNumber(input);
  if (value == null || !Number.isInteger(value) || value < 0) {
    throw new CalculatorValidationError('Укажите целое число ≥ 0');
  }
  return value;
}
