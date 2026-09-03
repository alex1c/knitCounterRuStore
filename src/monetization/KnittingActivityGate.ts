/**
 * In-memory knitting activity flags for interstitial gating.
 * Timer/session active => never show interstitial.
 */

let activeTimerProjectId: string | null = null;
let onKnitScreen = false;
let hasPersistedActiveTimer: (() => boolean) | null = null;

export const KnittingActivityGate = {
  setOnKnitScreen(value: boolean): void {
    onKnitScreen = value;
  },

  setActiveTimer(projectId: string | null): void {
    activeTimerProjectId = projectId;
  },

  bindPersistedTimerCheck(check: () => boolean): void {
    hasPersistedActiveTimer = check;
  },

  /** True when interstitial must not interrupt knitting. */
  isBlocked(): boolean {
    if (activeTimerProjectId != null || onKnitScreen) return true;
    try {
      return hasPersistedActiveTimer?.() ?? false;
    } catch {
      // Fail closed: an unreadable session state must not permit an interruption.
      return true;
    }
  },

  hasActiveTimer(): boolean {
    return activeTimerProjectId != null;
  },
};
