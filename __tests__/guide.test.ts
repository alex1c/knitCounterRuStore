/**
 * Lightweight tests for the offline user-guide registry.
 */

import {
  GUIDE_SECTION_IDS,
  GUIDE_SECTIONS,
  getGuideSection,
} from '@/guide/sections';

const EXPECTED_SECTION_IDS = [
  'quick-start',
  'projects',
  'counter',
  'row-actions',
  'linked-counters',
  'timer',
  'yarn',
  'calculators',
  'documents',
  'diary-stats',
  'backup',
  'tips',
  'faq',
] as const;

describe('offline user guide registry', () => {
  it('exposes the expected ordered section ids', () => {
    expect(GUIDE_SECTION_IDS).toEqual([...EXPECTED_SECTION_IDS]);
  });

  it('has unique section ids', () => {
    const unique = new Set(GUIDE_SECTION_IDS);
    expect(unique.size).toBe(GUIDE_SECTION_IDS.length);
  });

  it('resolves every registered section by id', () => {
    for (const id of EXPECTED_SECTION_IDS) {
      const section = getGuideSection(id);
      expect(section).toBeDefined();
      expect(section?.id).toBe(id);
      expect(section?.title.length).toBeGreaterThan(0);
      expect(section?.blocks.length).toBeGreaterThan(0);
    }
  });

  it('keeps GUIDE_SECTIONS aligned with GUIDE_SECTION_IDS', () => {
    expect(GUIDE_SECTIONS.map((section) => section.id)).toEqual(
      GUIDE_SECTION_IDS
    );
  });

  it('returns undefined for unknown section ids', () => {
    expect(getGuideSection('missing-section')).toBeUndefined();
  });
});
