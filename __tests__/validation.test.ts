/**
 * Domain validation unit tests.
 */

import {
  DomainValidationError,
  validateCounterValue,
  validateCraftType,
  validateNonEmptyName,
  validateProjectStatus,
  validateRepeatLength,
} from '@/domain/validation';

describe('validation', () => {
  test('validateNonEmptyName trims and rejects empty', () => {
    expect(validateNonEmptyName('  Свитер  ', 'name')).toBe('Свитер');
    expect(() => validateNonEmptyName('  ', 'name')).toThrow(DomainValidationError);
  });

  test('validateCraftType accepts knitting and crochet', () => {
    expect(validateCraftType('knitting')).toBe('knitting');
    expect(validateCraftType('crochet')).toBe('crochet');
    expect(() => validateCraftType('weaving')).toThrow(DomainValidationError);
  });

  test('validateProjectStatus accepts valid statuses', () => {
    expect(validateProjectStatus('active')).toBe('active');
    expect(() => validateProjectStatus('deleted')).toThrow(DomainValidationError);
  });

  test('validateCounterValue rejects negative and non-integer', () => {
    validateCounterValue(0, 'value');
    validateCounterValue(10, 'value');
    expect(() => validateCounterValue(-1, 'value')).toThrow(DomainValidationError);
    expect(() => validateCounterValue(1.5, 'value')).toThrow(DomainValidationError);
  });

  test('validateRepeatLength rejects zero and negative', () => {
    validateRepeatLength(null);
    validateRepeatLength(4);
    expect(() => validateRepeatLength(0)).toThrow(DomainValidationError);
    expect(() => validateRepeatLength(-2)).toThrow(DomainValidationError);
  });
});
