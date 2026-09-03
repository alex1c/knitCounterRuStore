/**
 * Boots analytics + ads once after the local database is ready.
 */

import { Analytics, initAnalytics } from '@/services/AnalyticsService';
import { InterstitialAdService } from '@/services/InterstitialAdService';
import {
  bindMonetizationSettings,
  incrementAppSessionCount,
} from '@/monetization/MonetizationSettings';
import type { SettingsRepository } from '@/repositories/SettingsRepository';

let bootstrapped = false;

/** Idempotent session/analytics/ads startup for the current process. */
export async function bootstrapMonetization(
  settingsRepository: SettingsRepository
): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  bindMonetizationSettings(settingsRepository);
  initAnalytics();
  Analytics.appOpen();

  try {
    const sessions = await incrementAppSessionCount();
    await InterstitialAdService.bootstrap(sessions);
  } catch {
    // Ads/analytics must never block app use
  }
}
