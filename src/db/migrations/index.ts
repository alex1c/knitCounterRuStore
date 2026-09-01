/**
 * Ordered migration registry.
 * Never edit published migrations — add new numbered files instead.
 */

import { migration001Initial } from './001_initial';
import type { Migration } from '../types';

export const MIGRATIONS: readonly Migration[] = [migration001Initial];

export const CURRENT_SCHEMA_VERSION = 1;
