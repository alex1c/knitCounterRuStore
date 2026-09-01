/**
 * Ordered migration registry.
 * Never edit published migrations — add new numbered files instead.
 */

import { migration001Initial } from './001_initial';
import { migration002CounterPartIntegrity } from './002_counter_part_integrity';
import type { Migration } from '../types';

export const MIGRATIONS: readonly Migration[] = [
  migration001Initial,
  migration002CounterPartIntegrity,
];

export const CURRENT_SCHEMA_VERSION = 2;
