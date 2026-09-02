/**
 * Shared calculator result shape with human-readable explanation lines.
 */

export type CalculatorExplanation = string[];

export type CalculatorResult<T> = {
  value: T;
  explanation: CalculatorExplanation;
};

/** Repeat adjustment candidate for stitch/row counts. */
export type RepeatCandidate = {
  count: number;
  /** Resulting dimension (cm) when applicable. */
  dimensionCm: number | null;
  isClosest: boolean;
};
