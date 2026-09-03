/**
 * Unit tests for monetization config + interstitial eligibility helpers.
 */

import {
  BANNER_PLACEMENTS,
  FORBIDDEN_DEMO_AD_UNIT_IDS,
  INTERSTITIAL_AD_UNIT_ID,
  INTERSTITIAL_POLICY,
  resolveBannerUnitId,
  resolveInterstitialUnitId,
} from '@/monetization/config';
import { isMonetizationSettingsKey } from '@/monetization/MonetizationSettings';
import { __testBuckets } from '@/services/AnalyticsService';
import { KnittingActivityGate } from '@/monetization/KnittingActivityGate';

describe('monetization production IDs', () => {
  it('maps banner placements to production units', () => {
    expect(resolveBannerUnitId('projects')).toBe('R-M-19973799-1');
    expect(resolveBannerUnitId('yarn')).toBe('R-M-19973799-2');
    expect(resolveBannerUnitId('calculators')).toBe('R-M-19973799-3');
    expect(resolveInterstitialUnitId()).toBe('R-M-19973799-4');
  });

  it('does not use known demo unit IDs', () => {
    const all = [
      ...Object.values(BANNER_PLACEMENTS),
      INTERSTITIAL_AD_UNIT_ID,
    ];
    for (const id of all) {
      expect(FORBIDDEN_DEMO_AD_UNIT_IDS).not.toContain(id);
    }
  });

  it('uses the initial interstitial policy values', () => {
    expect(INTERSTITIAL_POLICY.minAppSessions).toBe(3);
    expect(INTERSTITIAL_POLICY.maxPerSession).toBe(1);
    expect(INTERSTITIAL_POLICY.cooldownMs).toBe(6 * 60 * 60 * 1000);
    expect(INTERSTITIAL_POLICY.calculatorTriggerCount).toBe(3);
  });
});

describe('monetization settings keys', () => {
  it('detects monetization.* keys for backup filtering', () => {
    expect(isMonetizationSettingsKey('monetization.app_session_count')).toBe(
      true
    );
    expect(isMonetizationSettingsKey('activeProjectId')).toBe(false);
  });
});

describe('analytics buckets', () => {
  it('maps duration and rows without raw values escaping', () => {
    expect(__testBuckets.durationBucket(60)).toBe('under_10m');
    expect(__testBuckets.durationBucket(15 * 60)).toBe('10_30m');
    expect(__testBuckets.durationBucket(45 * 60)).toBe('30_60m');
    expect(__testBuckets.durationBucket(90 * 60)).toBe('60m_plus');
    expect(__testBuckets.rowsBucket(5)).toBe('1_10');
    expect(__testBuckets.rowsBucket(20)).toBe('11_30');
    expect(__testBuckets.rowsBucket(50)).toBe('31_100');
    expect(__testBuckets.rowsBucket(200)).toBe('100_plus');
  });
});

describe('active knitting interstitial gate', () => {
  afterEach(() => {
    KnittingActivityGate.setOnKnitScreen(false);
    KnittingActivityGate.setActiveTimer(null);
    KnittingActivityGate.bindPersistedTimerCheck(() => false);
  });

  it('blocks from persisted session state even away from knit route', () => {
    KnittingActivityGate.bindPersistedTimerCheck(() => true);
    expect(KnittingActivityGate.isBlocked()).toBe(true);
  });

  it('fails closed when persisted session state cannot be read', () => {
    KnittingActivityGate.bindPersistedTimerCheck(() => {
      throw new Error('db unavailable');
    });
    expect(KnittingActivityGate.isBlocked()).toBe(true);
  });
});
