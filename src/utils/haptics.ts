/**
 * Light haptic feedback for successful row increment.
 * Failure to vibrate must never block counting.
 */

import * as Haptics from 'expo-haptics';

/** Subtle success tap — safe to call on every +1. */
export async function hapticIncrementSuccess(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Device may not support haptics — ignore silently.
  }
}
