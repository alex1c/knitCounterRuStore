/**
 * Privacy-safe AppMetrica wrapper.
 *
 * Never send project names, notes, diary text, yarn brands, filenames,
 * calculator numbers, URIs, or raw exception messages.
 */

import AppMetrica from '@appmetrica/react-native-analytics';
import { Platform } from 'react-native';

import {
  APPMETRICA_API_KEY,
  getAppVersion,
} from '@/monetization/config';

type SafeAttrs = Record<string, string | number | boolean>;

let activated = false;

/** Initializes AppMetrica once. Best-effort — never throws to callers. */
export function initAnalytics(): void {
  if (activated) return;
  try {
    AppMetrica.activate({
      apiKey: APPMETRICA_API_KEY,
      sessionTimeout: 120,
      logs: __DEV__,
    });
    activated = true;
  } catch {
    // Analytics must never break the app
  }
}

function report(eventName: string, attributes?: SafeAttrs): void {
  try {
    if (!activated) {
      initAnalytics();
    }
    AppMetrica.reportEvent(eventName, attributes);
  } catch {
    // swallow
  }
}

export const Analytics = {
  appOpen(): void {
    report('app_open', {
      app_version: getAppVersion(),
      platform: Platform.OS,
    });
  },

  projectCreated(): void {
    report('project_created');
  },

  projectDeleted(): void {
    report('project_deleted');
  },

  projectCompleted(): void {
    report('project_completed');
  },

  knittingSessionStarted(): void {
    report('knitting_session_started');
  },

  knittingSessionFinished(params: {
    durationSeconds: number;
    rowsDelta: number | null;
    usedRules: boolean;
  }): void {
    report('knitting_session_finished', {
      duration_bucket: durationBucket(params.durationSeconds),
      ...(params.rowsDelta != null
        ? { rows_bucket: rowsBucket(params.rowsDelta) }
        : {}),
      used_rules: params.usedRules,
    });
  },

  rowRuleCreated(ruleType: string): void {
    report('row_rule_created', { rule_type: ruleType });
  },

  yarnCreated(): void {
    report('yarn_created');
  },

  yarnAttachedToProject(): void {
    report('yarn_attached_to_project');
  },

  yarnUsageRecorded(): void {
    report('yarn_usage_recorded');
  },

  calculatorOpened(calculatorType: string): void {
    report('calculator_opened', { calculator_type: calculatorType });
  },

  calculatorCalculated(calculatorType: string): void {
    report('calculator_calculated', { calculator_type: calculatorType });
  },

  documentImported(documentType: 'pdf' | 'image' | 'other'): void {
    report('document_imported', {
      document_type: documentType === 'other' ? 'image' : documentType,
    });
  },

  documentOpened(documentType: 'pdf' | 'image' | 'other'): void {
    const type = documentType === 'pdf' ? 'pdf' : 'image';
    report('document_opened', { document_type: type });
  },

  diaryEntryCreated(entryType: string): void {
    report('diary_entry_created', { entry_type: entryType });
  },

  backupCreated(): void {
    report('backup_created');
  },

  restoreStarted(): void {
    report('restore_started');
  },

  restoreSucceeded(): void {
    report('restore_succeeded');
  },

  restoreFailed(
    category: 'invalid_backup' | 'unsupported_version' | 'file_error' | 'database_error' | 'unknown'
  ): void {
    report('restore_failed', { category });
  },

  adInterstitialShown(): void {
    report('ad_interstitial_shown');
  },

  adInterstitialFailed(): void {
    report('ad_interstitial_failed');
  },
};

function durationBucket(seconds: number): string {
  const minutes = seconds / 60;
  if (minutes < 10) return 'under_10m';
  if (minutes < 30) return '10_30m';
  if (minutes < 60) return '30_60m';
  return '60m_plus';
}

function rowsBucket(rows: number): string {
  const n = Math.abs(rows);
  if (n <= 10) return '1_10';
  if (n <= 30) return '11_30';
  if (n <= 100) return '31_100';
  return '100_plus';
}

/** Exported for unit tests. */
export const __testBuckets = { durationBucket, rowsBucket };
