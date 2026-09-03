/**
 * In-memory knitting activity flags for interstitial gating.
 * Timer/session active => never show interstitial.
 */

let activeTimerProjectId: string | null = null;
let onKnitScreen = false;

export const KnittingActivityGate = {
  setOnKnitScreen(value: boolean): void {
    onKnitScreen = value;
  },

  setActiveTimer(projectId: string | null): void {
    activeTimerProjectId = projectId;
  },

  /** True when interstitial must not interrupt knitting. */
  isBlocked(): boolean {
    return activeTimerProjectId != null || onKnitScreen;
  },

  hasActiveTimer(): boolean {
    return activeTimerProjectId != null;
  },
};
