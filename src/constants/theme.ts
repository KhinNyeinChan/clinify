/**
 * Clinify medical UI tokens.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Palette = {
  primary: '#2e7d32',
  primaryPressed: '#1B5E20',
  secondary: '#a3dca5',
  accent: '#a3dca5',
  deleteIcon: '#e60000',
  deleteIconBg: '#fde7e9',
  background: '#FFFFFF',
  surface: '#F8F9FA',
  text: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  error: '#DC2626',
  errorBg: '#FEE2E2',
  errorText: '#991B1B',
  success: '#166534',
  successBg: '#DCFCE7',
  white: '#FFFFFF',
} as const;

export const Colors = {
  light: {
    text: Palette.text,
    background: Palette.surface,
    backgroundElement: Palette.background,
    backgroundSelected: Palette.accent,
    textSecondary: Palette.textSecondary,
    primary: Palette.primary,
    secondary: Palette.secondary,
    accent: Palette.secondary,
    border: Palette.border,
  },
  dark: {
    text: '#F9FAFB',
    background: '#111827',
    backgroundElement: '#1F2937',
    backgroundSelected: '#1B3D1E',
    textSecondary: '#9CA3AF',
    primary: Palette.primary,
    secondary: Palette.secondary,
    accent: '#1B3D1E',
    border: '#374151',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 12,
  md: 16,
  lg: 20,
  pill: 999,
} as const;

export const CardShadow = Platform.select({
  android: {
    boxShadow: '0px 8px 16px rgba(31, 41, 55, 0.06)',
    elevation: 3,
  },
  default: {
    boxShadow: '0px 8px 16px rgba(31, 41, 55, 0.06)',
  },
});

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
