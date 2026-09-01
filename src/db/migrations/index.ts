/**
 * Ordered migration registry.
 * Never edit published migrations — add new numbered files instead.
 */

import { migration001Initial } from './001_initial';
import { migration002CounterPartIntegrity } from './002_counter_part_integrity';
import { migration003RowRulesAndTimer } from './003_row_rules_and_timer';
import type { Migration } from '../types';

export const MIGRATIONS: readonly Migration[] = [
  migration001Initial,
  migration002CounterPartIntegrity,
  migration003RowRulesAndTimer,
];

export const CURRENT_SCHEMA_VERSION = 3;
