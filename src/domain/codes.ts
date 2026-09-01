/**
 * Persisted enum-like codes — English strings in DB, localized in UI later.
 */

export const CRAFT_TYPES = ['knitting', 'crochet'] as const;
export type CraftType = (typeof CRAFT_TYPES)[number];

export const PROJECT_STATUSES = [
  'planned',
  'active',
  'paused',
  'completed',
  'archived',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const COUNTER_EVENT_TYPES = [
  'increment',
  'decrement',
  'set',
  'reset',
] as const;
export type CounterEventType = (typeof COUNTER_EVENT_TYPES)[number];
