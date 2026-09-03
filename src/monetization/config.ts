/**
 * Production AppMetrica + Yandex Mobile Ads identifiers.
 *
 * Release builds must resolve ONLY to these IDs — never demo/test units.
 */

import Constants from 'expo-constants';

/** AppMetrica production API key. */
export const APPMETRICA_API_KEY = '88e67439-1cd0-4a11-86d4-801bb1abf30a';

/** Yandex Advertising Network application id (informational). */
export const YANDEX_APP_ID = '19973799';

/** Banner placement groups → production unit IDs. */
export const BANNER_PLACEMENTS = {
  projects: 'R-M-19973799-1',
  yarn: 'R-M-19973799-2',
  calculators: 'R-M-19973799-3',
} as const;

export type BannerPlacement = keyof typeof BANNER_PLACEMENTS;

/** Production interstitial unit. */
export const INTERSTITIAL_AD_UNIT_ID = 'R-M-19973799-4';

/** Known Yandex demo/test unit IDs — must never appear in production resolution. */
export const FORBIDDEN_DEMO_AD_UNIT_IDS = [
  'demo-banner-yandex',
  'demo-interstitial-yandex',
  'demo-rewarded-yandex',
  'demo-appopen-yandex',
] as const;

/** Interstitial eligibility policy (initial release). */
export const INTERSTITIAL_POLICY = {
  minAppSessions: 3,
  maxPerSession: 1,
  cooldownMs: 6 * 60 * 60 * 1000,
  calculatorTriggerCount: 3,
} as const;

/** Settings keys for monetization persistence (excluded from backup semantics). */
export const MONETIZATION_SETTING_KEYS = {
  appSessionCount: 'monetization.app_session_count',
  lastInterstitialAt: 'monetization.last_interstitial_at',
} as const;

/** True when running a production/release client build. */
export function isProductionClient(): boolean {
  return !__DEV__;
}

/**
 * Resolves banner unit for a placement.
 * Never falls back to demo IDs in production.
 */
export function resolveBannerUnitId(placement: BannerPlacement): string {
  const unitId = BANNER_PLACEMENTS[placement];
  assertProductionAdUnit(unitId);
  return unitId;
}

/** Resolves interstitial unit — production ID only. */
export function resolveInterstitialUnitId(): string {
  assertProductionAdUnit(INTERSTITIAL_AD_UNIT_ID);
  return INTERSTITIAL_AD_UNIT_ID;
}

function assertProductionAdUnit(unitId: string): void {
  if (
    FORBIDDEN_DEMO_AD_UNIT_IDS.includes(
      unitId as (typeof FORBIDDEN_DEMO_AD_UNIT_IDS)[number]
    )
  ) {
    throw new Error('Demo/test ad unit must not be used');
  }
  if (isProductionClient() && !unitId.startsWith('R-M-19973799-')) {
    throw new Error(`Unexpected production ad unit: ${unitId}`);
  }
}

/** App version string for analytics properties. */
export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}
