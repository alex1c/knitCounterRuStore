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
import type { KnittingSessionRepository } from '@/repositories/KnittingSessionRepository';
import { KnittingActivityGate } from '@/monetization/KnittingActivityGate';

let bootstrapped = false;

/** Idempotent session/analytics/ads startup for the current process. */
export async function bootstrapMonetization(
  settingsRepository: SettingsRepository,
  knittingSessionRepository: KnittingSessionRepository
): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  bindMonetizationSettings(settingsRepository);
  KnittingActivityGate.bindPersistedTimerCheck(() =>
    knittingSessionRepository.hasAnyActiveSession()
  );
  initAnalytics();
  Analytics.appOpen();

  try {
    const sessions = await incrementAppSessionCount();
    await InterstitialAdService.bootstrap(sessions);
  } catch {
    // Ads/analytics must never block app use
  }
}
