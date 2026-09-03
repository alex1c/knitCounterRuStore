/**
 * Central interstitial loader + eligibility policy.
 *
 * Policy (initial release):
 * - min 3 app sessions
 * - max 1 interstitial per app session
 * - 6 hour cooldown
 * - calculator: after 3rd successful calculation (once per opportunity)
 * - blocked while knitting timer / knit screen active
 * - no startup interstitial
 */

import {
  InterstitialAd,
  InterstitialAdLoader,
  MobileAds,
} from 'yandex-mobile-ads';

import {
  INTERSTITIAL_POLICY,
  resolveInterstitialUnitId,
} from '@/monetization/config';
import { KnittingActivityGate } from '@/monetization/KnittingActivityGate';
import {
  getAppSessionCount,
  getLastInterstitialAt,
  setLastInterstitialAt,
} from '@/monetization/MonetizationSettings';
import { Analytics } from '@/services/AnalyticsService';

type TriggerReason = 'calculator' | 'statistics_leave' | 'project_milestone';

let sdkReady = false;
let loader: InterstitialAdLoader | null = null;
let readyAd: InterstitialAd | null = null;
let loading = false;
let shownThisSession = false;
/** Successful calculations in this process. */
let successfulCalculations = 0;
/**
 * When true, calculator trigger already attempted (success or fail-to-show).
 * Prevents auto-retry on calculation 4+ solely because ad was not ready at 3.
 */
let calculatorTriggerConsumed = false;
let sessionCountCached = 0;

export const InterstitialAdService = {
  /** Call after DB is ready — initializes Yandex Ads and preloads quietly. */
  async bootstrap(sessionCount: number): Promise<void> {
    sessionCountCached = sessionCount;
    try {
      await MobileAds.initialize();
      sdkReady = true;
    } catch {
      sdkReady = false;
      return;
    }
    // Defer preload so first paint is not blocked
    setTimeout(() => {
      void InterstitialAdService.preload();
    }, 2500);
  },

  getSuccessfulCalculationCount(): number {
    return successfulCalculations;
  },

  /** Records a successful calculation and maybe shows interstitial. */
  async onSuccessfulCalculation(): Promise<void> {
    successfulCalculations += 1;
    if (
      successfulCalculations === INTERSTITIAL_POLICY.calculatorTriggerCount &&
      !calculatorTriggerConsumed
    ) {
      calculatorTriggerConsumed = true;
      await InterstitialAdService.tryShow('calculator');
    }
  },

  /** Optional: leaving statistics screen. */
  async onStatisticsLeave(): Promise<void> {
    await InterstitialAdService.tryShow('statistics_leave');
  },

  /** Optional: project created or marked finished. */
  async onProjectMilestone(): Promise<void> {
    await InterstitialAdService.tryShow('project_milestone');
  },

  async tryShow(_reason: TriggerReason): Promise<boolean> {
    if (!(await InterstitialAdService.isEligible())) {
      return false;
    }
    if (!readyAd) {
      void InterstitialAdService.preload();
      return false;
    }

    const ad = readyAd;
    readyAd = null;

    return await new Promise<boolean>((resolve) => {
      let finished = false;
      const finish = (ok: boolean) => {
        if (finished) return;
        finished = true;
        resolve(ok);
      };

      ad.onAdShown = () => {
        shownThisSession = true;
        void setLastInterstitialAt(new Date().toISOString());
        Analytics.adInterstitialShown();
      };
      ad.onAdFailedToShow = () => {
        Analytics.adInterstitialFailed();
        finish(false);
        void InterstitialAdService.preload();
      };
      ad.onAdDismissed = () => {
        finish(true);
        void InterstitialAdService.preload();
      };

      try {
        ad.show();
      } catch {
        Analytics.adInterstitialFailed();
        finish(false);
      }
    });
  },

  async isEligible(): Promise<boolean> {
    try {
      if (shownThisSession) return false;
      if (KnittingActivityGate.isBlocked()) return false;

      const sessions =
        sessionCountCached > 0
          ? sessionCountCached
          : await getAppSessionCount();
      if (sessions < INTERSTITIAL_POLICY.minAppSessions) return false;

      const last = await getLastInterstitialAt();
      if (last != null) {
        const elapsed = Date.now() - last;
        if (elapsed < INTERSTITIAL_POLICY.cooldownMs) return false;
      }

      return true;
    } catch {
      // Settings may be unbound in unit tests / early boot
      return false;
    }
  },

  async preload(): Promise<void> {
    if (!sdkReady || loading || readyAd) return;
    loading = true;
    try {
      if (!loader) {
        loader = await InterstitialAdLoader.create();
      }
      if (!loader) return;
      const unitId = resolveInterstitialUnitId();
      const ad = await loader.loadAd({ adUnitId: unitId });
      if (ad) {
        readyAd = ad;
      }
    } catch {
      // Unavailable — skip quietly; no aggressive retry loop
    } finally {
      loading = false;
    }
  },

  /** Dev/test helper — does not weaken release eligibility checks. */
  __devForceEligibilityState(partial: {
    sessionCount?: number;
    shownThisSession?: boolean;
    successfulCalculations?: number;
    calculatorTriggerConsumed?: boolean;
  }): void {
    if (!__DEV__) return;
    if (partial.sessionCount != null) sessionCountCached = partial.sessionCount;
    if (partial.shownThisSession != null)
      shownThisSession = partial.shownThisSession;
    if (partial.successfulCalculations != null)
      successfulCalculations = partial.successfulCalculations;
    if (partial.calculatorTriggerConsumed != null)
      calculatorTriggerConsumed = partial.calculatorTriggerConsumed;
  },
};
