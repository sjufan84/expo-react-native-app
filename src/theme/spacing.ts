export const Spacing = {
  // Base spacing unit (4px)
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
  32: 128,
} as const;

export const BorderRadius = {
  none: 0,
  sm: 4,
  base: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

export const IconSizes = {
  xs: 12,
  sm: 16,
  base: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
  '3xl': 36,
  '4xl': 48,
  '5xl': 56,
} as const;

export type SpacingKeys = keyof typeof Spacing;
export type BorderRadiusKeys = keyof typeof BorderRadius;
export type IconSizeKeys = keyof typeof IconSizes;