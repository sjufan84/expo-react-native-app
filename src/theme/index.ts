import { Colors } from './colors';
import { Typography } from './typography';
import { Spacing, BorderRadius, IconSizes } from './spacing';

export const Theme = {
  colors: Colors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  iconSizes: IconSizes,
} as const;

export type ThemeType = typeof Theme;

// Utility functions for accessing theme values
export const createTextStyle = (size: keyof typeof Typography.fontSize, weight: keyof typeof Typography.fontWeight = 'normal') => ({
  fontSize: Typography.fontSize[size],
  fontWeight: Typography.fontWeight[weight],
  lineHeight: Typography.lineHeight.normal,
});

export const createSpacingStyle = (horizontal: keyof typeof Spacing, vertical: keyof typeof Spacing = horizontal) => ({
  paddingHorizontal: Spacing[horizontal],
  paddingVertical: Spacing[vertical],
});

export const createMarginStyle = (horizontal: keyof typeof Spacing, vertical: keyof typeof Spacing = horizontal) => ({
  marginHorizontal: Spacing[horizontal],
  marginVertical: Spacing[vertical],
});