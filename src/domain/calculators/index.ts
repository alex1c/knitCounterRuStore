/**
 * Knitting calculator domain engines — pure functions, no UI dependencies.
 */

export * from './types';
export * from './validation';
export * from './rounding';
export * from './repeatAdjust';
export * from './stitchesForWidth';
export * from './rowsForHeight';
export * from './finishedSize';
export * from './gauge';
export * from './yarnRequirement';
export * from './yarnSubstitution';
export * from './distributeChanges';
export * from './yarnAvailability';

export const CALCULATOR_ROUTES = [
  { id: 'stitches-width', title: 'Петли по ширине', href: '/calculators/stitches-width' },
  { id: 'rows-height', title: 'Ряды по высоте', href: '/calculators/rows-height' },
  { id: 'finished-size', title: 'Размер по петлям', href: '/calculators/finished-size' },
  { id: 'gauge', title: 'Плотность вязания', href: '/calculators/gauge' },
  { id: 'yarn-required', title: 'Сколько нужно пряжи', href: '/calculators/yarn-required' },
  { id: 'yarn-substitution', title: 'Замена пряжи', href: '/calculators/yarn-substitution' },
  { id: 'increases-decreases', title: 'Прибавки и убавки', href: '/calculators/increases-decreases' },
  { id: 'yarn-enough', title: 'Хватит ли пряжи?', href: '/calculators/yarn-enough' },
] as const;
