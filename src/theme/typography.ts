export const Typography = {
  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },

  // Font weights
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },

  // Line heights
  lineHeight: {
    tight: 1.25,
    snugged: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  // Letter spacing
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },

  // Font families (React Native platform-specific)
  fontFamily: {
    sans: 'System',
    serif: 'Georgia',
    mono: 'Courier',
  },
} as const;

export type FontSizeKeys = keyof typeof Typography.fontSize;
export type FontWeightKeys = keyof typeof Typography.fontWeight;
export type LineHeightKeys = keyof typeof Typography.lineHeight;
export type LetterSpacingKeys = keyof typeof Typography.letterSpacing;