/**
 * Persisted monetization counters (session count, last interstitial time).
 * Keys are stripped after backup restore so ad state is not restored from archives.
 */

import type { SettingsRepository } from '@/repositories/SettingsRepository';
import { MONETIZATION_SETTING_KEYS } from '@/monetization/config';

let settings: SettingsRepository | null = null;

/** Bind settings repository once DB is ready (called from monetization bootstrap). */
export function bindMonetizationSettings(repo: SettingsRepository): void {
  settings = repo;
}

function requireSettings(): SettingsRepository {
  if (!settings) {
    throw new Error('Monetization settings not bound');
  }
  return settings;
}

export async function getAppSessionCount(): Promise<number> {
  const raw = requireSettings().getSetting(
    MONETIZATION_SETTING_KEYS.appSessionCount
  )?.value;
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Increments once per cold app launch (not on tab/route remount). */
export async function incrementAppSessionCount(): Promise<number> {
  const next = (await getAppSessionCount()) + 1;
  requireSettings().setSetting(
    MONETIZATION_SETTING_KEYS.appSessionCount,
    String(next)
  );
  return next;
}

export async function getLastInterstitialAt(): Promise<number | null> {
  const raw = requireSettings().getSetting(
    MONETIZATION_SETTING_KEYS.lastInterstitialAt
  )?.value;
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export async function setLastInterstitialAt(iso: string): Promise<void> {
  requireSettings().setSetting(
    MONETIZATION_SETTING_KEYS.lastInterstitialAt,
    iso
  );
}

/** Setting keys that must not be restored from a user backup archive. */
export function isMonetizationSettingsKey(key: string): boolean {
  return key.startsWith('monetization.');
}
