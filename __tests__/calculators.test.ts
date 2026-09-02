/**
 * Unit tests for Phase 5 knitting calculator engines.
 */

import {
  calculateFinishedSize,
  calculateGauge,
  calculateRowsForHeight,
  calculateStitchesForWidth,
  calculateYarnRequirement,
  calculateYarnSubstitution,
  checkYarnAvailability,
  distributeIncreasesDecreases,
} from '@/domain/calculators';
import { adjustForPatternRepeat } from '@/domain/calculators/repeatAdjust';
import { ceilSkeins } from '@/domain/calculators/rounding';
import { MILLISKEINS_PER_SKEIN, calcTotalLengthM, calcTotalWeightG, parsePriceToMinor } from '@/utils/yarnQuantity';
import { finalizeNumber, parseFlexibleNumber } from '@/utils/numeric';

describe('calculators — stitches for width', () => {
  test('20 st / 10 cm × 48 cm → 96', () => {
    const { value } = calculateStitchesForWidth({
      gaugeStitches: 20,
      gaugeWidthCm: 10,
      desiredWidthCm: 48,
    });
    expect(value.theoreticalBodyStitches).toBe(96);
    expect(value.recommendedBodyStitches).toBe(96);
    expect(value.totalStitches).toBe(96);
  });

  test('22 / 10, target 50 → 110', () => {
    const { value } = calculateStitchesForWidth({
      gaugeStitches: 22,
      gaugeWidthCm: 10,
      desiredWidthCm: 50,
    });
    expect(value.theoreticalBodyStitches).toBe(110);
  });

  test('11 / 5, target 50 → 110', () => {
    const { value } = calculateStitchesForWidth({
      gaugeStitches: 11,
      gaugeWidthCm: 5,
      desiredWidthCm: 50,
    });
    expect(value.theoreticalBodyStitches).toBe(110);
  });

  test('edge stitches added after body count', () => {
    const { value } = calculateStitchesForWidth({
      gaugeStitches: 20,
      gaugeWidthCm: 10,
      desiredWidthCm: 48,
      edgeStitches: 2,
    });
    expect(value.recommendedBodyStitches).toBe(96);
    expect(value.totalStitches).toBe(98);
  });

  test('keeps fractional theoretical result and rounds only recommendation', () => {
    const { value } = calculateStitchesForWidth({
      gaugeStitches: 21,
      gaugeWidthCm: 10,
      desiredWidthCm: 47,
    });
    expect(value.theoreticalBodyStitches).toBeCloseTo(98.7, 10);
    expect(value.recommendedBodyStitches).toBe(99);
  });
});

describe('calculators — rows for height', () => {
  test('28 / 10, target 35 → 98', () => {
    const { value } = calculateRowsForHeight({
      gaugeRows: 28,
      gaugeHeightCm: 10,
      desiredHeightCm: 35,
    });
    expect(value.theoreticalRows).toBe(98);
    expect(value.recommendedRows).toBe(98);
  });
});

describe('calculators — finished size', () => {
  test('96 stitches at 20 / 10 cm → 48 cm', () => {
    const { value } = calculateFinishedSize({
      stitchCount: 96,
      gaugeStitches: 20,
      gaugeWidthCm: 10,
    });
    expect(value.widthCm).toBe(48);
    expect(value.heightCm).toBeNull();
  });

  test('98 rows at 28 / 10 cm → 35 cm', () => {
    const { value } = calculateFinishedSize({
      stitchCount: 96,
      rowCount: 98,
      gaugeStitches: 20,
      gaugeRows: 28,
      gaugeWidthCm: 10,
      gaugeHeightCm: 10,
    });
    expect(value.heightCm).toBe(35);
  });
});

describe('calculators — gauge', () => {
  test('24 stitches over 12 cm → 20 / 10 cm', () => {
    const { value } = calculateGauge({
      sampleWidthCm: 12,
      sampleHeightCm: 10,
      stitchesCounted: 24,
      rowsCounted: 28,
    });
    expect(value.stitchesPer10Cm).toBe(20);
  });

  test('33 rows over 12 cm → 27.5 / 10 cm', () => {
    const { value } = calculateGauge({
      sampleWidthCm: 10,
      sampleHeightCm: 12,
      stitchesCounted: 20,
      rowsCounted: 33,
    });
    expect(value.rowsPer10Cm).toBe(27.5);
  });
});

describe('calculators — yarn requirement', () => {
  test('450 g + 10%, 100 g skein → 5 skeins', () => {
    const { value } = calculateYarnRequirement({
      mode: 'grams',
      requiredGrams: 450,
      weightPerSkeinG: 100,
      reservePercent: 10,
    });
    expect(value.withReserveGrams).toBeCloseTo(495, 5);
    expect(value.skeinsToBuy).toBe(5);
  });

  test('900 m + 10%, 200 m/skein → 5 skeins', () => {
    const { value } = calculateYarnRequirement({
      mode: 'meters',
      requiredMeters: 900,
      metersPerSkein: 200,
      reservePercent: 10,
    });
    expect(value.withReserveMeters).toBeCloseTo(990, 5);
    expect(value.skeinsToBuy).toBe(5);
  });

  test('boundary purchase rounding', () => {
    expect(ceilSkeins(800 / 200)).toBe(4);
    expect(ceilSkeins(801 / 200)).toBe(5);
    expect(ceilSkeins(4.000000000000001)).toBe(4);
    expect(ceilSkeins(0)).toBe(0);
  });

  test('row count requires complete row gauge metadata', () => {
    expect(() => calculateFinishedSize({
      stitchCount: 96, rowCount: 98, gaugeStitches: 20, gaugeWidthCm: 10,
    })).toThrow('Для расчёта высоты');
  });

  test('zero requirement buys zero skeins', () => {
    const { value } = calculateYarnRequirement({
      mode: 'grams', requiredGrams: 0, weightPerSkeinG: 100, reservePercent: 10,
    });
    expect(value.skeinsToBuy).toBe(0);
  });

  test('money uses minor units without float drift', () => {
    const priceMinor = 35050;
    const { value } = calculateYarnRequirement({
      mode: 'grams',
      requiredGrams: 450,
      weightPerSkeinG: 100,
      reservePercent: 10,
      pricePerSkeinMinor: priceMinor,
    });
    expect(value.skeinsToBuy).toBe(5);
    expect(value.totalCostMinor).toBe(175250);
  });
});

describe('calculators — yarn substitution', () => {
  test('8×120 m → 175 m/skein without reserve → 6 skeins', () => {
    const { value } = calculateYarnSubstitution({
      originalSkeinCount: 8,
      originalMetersPerSkein: 120,
      replacementMetersPerSkein: 175,
      reservePercent: 0,
    });
    expect(value.requiredMeters).toBe(960);
    expect(value.skeinsToBuy).toBe(6);
  });

  test('8×120 m → 175 m/skein with 10% reserve → 7 skeins', () => {
    const { value } = calculateYarnSubstitution({
      originalSkeinCount: 8,
      originalMetersPerSkein: 120,
      replacementMetersPerSkein: 175,
      reservePercent: 10,
    });
    expect(value.withReserveMeters).toBe(1056);
    expect(value.skeinsToBuy).toBe(7);
  });
});

describe('calculators — pattern repeat', () => {
  test('raw 95, multiple 6 + 2 → candidates 92 and 98', () => {
    const { candidates, recommendedCount } = adjustForPatternRepeat({
      rawBodyCount: 95,
      repeatSize: 6,
      fixedOffset: 2,
    });
    const counts = candidates.map((c) => c.count).sort((a, b) => a - b);
    expect(counts).toContain(92);
    expect(counts).toContain(98);
    expect(recommendedCount).toBe(98);
  });

  test('exact valid result stays unchanged', () => {
    const { recommendedCount } = adjustForPatternRepeat({
      rawBodyCount: 98,
      repeatSize: 6,
      fixedOffset: 2,
    });
    expect(recommendedCount).toBe(98);
  });

  test('repeat 1 with fixed 0 returns raw', () => {
    const { recommendedCount } = adjustForPatternRepeat({
      rawBodyCount: 95,
      repeatSize: 1,
      fixedOffset: 0,
    });
    expect(recommendedCount).toBe(95);
  });

  test('accepts direct total meters and preserves exact purchase boundary', () => {
    const { value } = calculateYarnSubstitution({
      totalRequiredMeters: 800,
      replacementMetersPerSkein: 200,
      reservePercent: 0,
    });
    expect(value.skeinsToBuy).toBe(4);
  });

  test.each([
    { repeatSize: 0, fixedOffset: 0 },
    { repeatSize: 6, fixedOffset: -1 },
    { repeatSize: 6, fixedOffset: 6 },
  ])('rejects non-canonical repeat %#', ({ repeatSize, fixedOffset }) => {
    expect(() => adjustForPatternRepeat({ rawBodyCount: 95, repeatSize, fixedOffset })).toThrow();
  });

  test('repeat candidates bracket a fractional target and edges are added later', () => {
    const { value } = calculateStitchesForWidth({
      gaugeStitches: 21, gaugeWidthCm: 10, desiredWidthCm: 47,
      repeatSize: 6, repeatFixed: 2, edgeStitches: 2,
    });
    expect(value.repeatCandidates?.map((candidate) => candidate.count)).toEqual([98, 104]);
    expect(value.recommendedBodyStitches).toBe(98);
    expect(value.totalStitches).toBe(100);
  });

  test('repeat applies to body before edge stitches', () => {
    const { value } = calculateStitchesForWidth({
      gaugeStitches: 20,
      gaugeWidthCm: 10,
      desiredWidthCm: 47.5,
      edgeStitches: 2,
      repeatSize: 6,
      repeatFixed: 2,
    });
    expect(value.recommendedBodyStitches).toBe(98);
    expect(value.totalStitches).toBe(100);
  });
});

describe('calculators — increase/decrease distribution', () => {
  test('80 → 92 gives 12 actions with even spacing', () => {
    const { value } = distributeIncreasesDecreases({
      currentStitches: 80,
      targetStitches: 92,
    });
    expect(value.actionCount).toBe(12);
    expect(value.isIncrease).toBe(true);
    const totalActions = value.segments.reduce((sum, s) => sum + s.count, 0);
    expect(totalActions).toBe(12);
    const intervals = value.segments.map((s) => s.interval);
    expect(Math.max(...intervals) - Math.min(...intervals)).toBeLessThanOrEqual(1);
    expect(value.segments).toEqual([
      { interval: 7, count: 8 },
      { interval: 6, count: 4 },
    ]);
    expect(value.segments.reduce((sum, segment) => sum + segment.interval * segment.count, 0)).toBe(80);
  });

  test('92 → 80 decreases', () => {
    const { value } = distributeIncreasesDecreases({
      currentStitches: 92,
      targetStitches: 80,
    });
    expect(value.actionCount).toBe(12);
    expect(value.isIncrease).toBe(false);
    expect(value.segments).toEqual([
      { interval: 8, count: 8 },
      { interval: 7, count: 4 },
    ]);
    expect(value.segments.reduce((sum, segment) => sum + segment.interval * segment.count, 0)).toBe(92);
    expect(92 - value.actionCount).toBe(80);
    expect(value.instruction).toContain('2 петель вместе');
  });

  test('100 → 110', () => {
    const { value } = distributeIncreasesDecreases({
      currentStitches: 100,
      targetStitches: 110,
    });
    expect(value.actionCount).toBe(10);
  });

  test('100 → 90', () => {
    const { value } = distributeIncreasesDecreases({
      currentStitches: 100,
      targetStitches: 90,
    });
    expect(value.actionCount).toBe(10);
  });

  test('equal counts need no changes', () => {
    const { value } = distributeIncreasesDecreases({
      currentStitches: 80,
      targetStitches: 80,
    });
    expect(value.actionCount).toBe(0);
    expect(value.instruction).toBe('Изменения не нужны');
  });

  test('single action', () => {
    const { value } = distributeIncreasesDecreases({
      currentStitches: 10,
      targetStitches: 11,
    });
    expect(value.actionCount).toBe(1);
    expect(value.segments).toEqual([{ interval: 10, count: 1 }]);
    expect(value.instruction).toContain('в центре ряда');
  });

  test('large difference warns about single-row distribution', () => {
    const { value } = distributeIncreasesDecreases({
      currentStitches: 10,
      targetStitches: 40,
    });
    expect(value.warning).not.toBeNull();
    expect(value.actionCount).toBe(30);
    expect(value.segments).toEqual([]);
  });

  test('impossible ordinary single-row decreases warn instead of emitting instructions', () => {
    const { value } = distributeIncreasesDecreases({ currentStitches: 10, targetStitches: 4 });
    expect(value.warning).not.toBeNull();
    expect(value.segments).toEqual([]);
  });
});

describe('calculators — enough yarn', () => {
  test('5.0 skeins stock vs 4.3 need → enough', () => {
    const { value } = checkYarnAvailability({
      stockMilliskeins: 5 * MILLISKEINS_PER_SKEIN,
      requiredMilliskeins: Math.round(4.3 * MILLISKEINS_PER_SKEIN),
    });
    expect(value.enough).toBe(true);
    expect(value.differenceMilliskeins).toBe(700);
  });

  test('3.0 stock vs 4.3 need → shortage 1.3 skeins', () => {
    const { value } = checkYarnAvailability({
      stockMilliskeins: 3 * MILLISKEINS_PER_SKEIN,
      requiredMilliskeins: Math.round(4.3 * MILLISKEINS_PER_SKEIN),
    });
    expect(value.enough).toBe(false);
    expect(value.differenceMilliskeins).toBe(-1300);
  });

  test('grams mode when weight metadata exists', () => {
    const { value } = checkYarnAvailability({
      stockMilliskeins: 5 * MILLISKEINS_PER_SKEIN,
      requiredGrams: 400,
      weightPerSkeinG: 100,
      reservePercent: 0,
    });
    expect(value.requiredMilliskeins).toBe(4000);
    expect(value.enough).toBe(true);
  });

  test('meters mode when length metadata exists', () => {
    const { value } = checkYarnAvailability({
      stockMilliskeins: 5 * MILLISKEINS_PER_SKEIN,
      requiredMeters: 800,
      lengthPerSkeinM: 200,
      reservePercent: 0,
    });
    expect(value.requiredMilliskeins).toBe(4000);
    expect(value.enough).toBe(true);
  });

  test('missing weight metadata for grams throws', () => {
    expect(() =>
      checkYarnAvailability({
        stockMilliskeins: 5000,
        requiredGrams: 400,
      })
    ).toThrow('Укажите вес мотка');
  });

  test.each([100, 300, 1001, 4999, 5000])('compares integer milliskeins exactly: %i', (need) => {
    const { value } = checkYarnAvailability({ stockMilliskeins: 5000, requiredMilliskeins: need });
    expect(value.differenceMilliskeins).toBe(5000 - need);
    expect(value.enough).toBe(true);
  });

  test('rejects fractional milliskeins and multiple requirement modes', () => {
    expect(() => checkYarnAvailability({ stockMilliskeins: 5000.1, requiredMilliskeins: 1000 })).toThrow();
    expect(() => checkYarnAvailability({ stockMilliskeins: 5000, requiredMilliskeins: 1000, requiredGrams: 100 })).toThrow();
  });

  test('derives availability metadata from integer milliskeins deliberately', () => {
    expect(calcTotalWeightG(4300, 100)).toBe(430);
    expect(calcTotalLengthM(4300, 240)).toBe(1032);
    expect(calcTotalWeightG(4300, null)).toBeNull();
    expect(calcTotalLengthM(4300, null)).toBeNull();
  });
});

describe('calculator numeric parser boundaries', () => {
  test.each(['10', '10,5', '10.5', '0,3'])('accepts %s', (input) => {
    expect(finalizeNumber(input)).not.toBeNull();
  });

  test.each(['10,5.2', '1,,2', 'abc', '--2', ',', '.', '   '])('rejects or empties %s', (input) => {
    if (input.trim() === '') expect(finalizeNumber(input)).toBeNull();
    else expect(() => finalizeNumber(input)).toThrow();
  });

  test('editable parser does not misclassify malformed mixed separators as incomplete', () => {
    expect(() => parseFlexibleNumber('10,5.2')).toThrow();
  });

  test('price parser converts decimal comma directly to integer minor units', () => {
    expect(parsePriceToMinor('350,50')).toBe(35050);
  });
});
