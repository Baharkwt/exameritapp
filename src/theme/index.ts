import { useColorScheme } from 'react-native';

const light = {
  bg: '#F5F6FB',
  surface: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E6E9F2',
  primary: '#5046E5',
  primaryText: '#FFFFFF',
  primarySoft: '#ECEBFF',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  dangerFg: '#991B1B',
  success: '#16A34A',
  successBg: '#DCFCE7',
  successFg: '#166534',
  warning: '#D97706',
  warningBg: '#FEF3C7',
  warningFg: '#92400E',
  info: '#0284C7',
  infoBg: '#DBEAFE',
  infoFg: '#1E40AF',
  marked: '#7C3AED',
  markedBg: '#F3E8FF',
  live: '#DC2626',
  liveBg: '#FEE2E2',
  star: '#F59E0B',
  inputBg: '#FFFFFF',
  skeleton: '#E6E9F2',
  hero: '#2B2A8F',
  heroSoft: 'rgba(255,255,255,0.14)',
  heroText: '#FFFFFF',
  heroMuted: 'rgba(255,255,255,0.72)',
  shadow: '#1E1B4B',
};

const dark: typeof light = {
  bg: '#0A0D14',
  surface: '#141A26',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  border: '#263042',
  primary: '#818CF8',
  primaryText: '#0B0F17',
  primarySoft: '#1E2250',
  danger: '#F87171',
  dangerBg: '#2A1412',
  dangerFg: '#FCA5A5',
  success: '#4ADE80',
  successBg: '#10281A',
  successFg: '#86EFAC',
  warning: '#FBBF24',
  warningBg: '#2E2410',
  warningFg: '#FCD34D',
  info: '#38BDF8',
  infoBg: '#10243A',
  infoFg: '#93C5FD',
  marked: '#A78BFA',
  markedBg: '#241A3D',
  live: '#F87171',
  liveBg: '#2A1412',
  star: '#FBBF24',
  inputBg: '#151C28',
  skeleton: '#263042',
  hero: '#3730A3',
  heroSoft: 'rgba(255,255,255,0.12)',
  heroText: '#FFFFFF',
  heroMuted: 'rgba(255,255,255,0.7)',
  shadow: '#000000',
};

export type AppColors = typeof light;

export function useColors(): AppColors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const radius = { sm: 10, md: 14, lg: 18, xl: 26, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;

/** Minimum comfortable touch target (iOS 44pt / Android 48dp). */
export const TOUCH = 44;

/** Soft, theme-aware elevation. Use on cards instead of hard borders. */
export function elevation(c: AppColors, level: 1 | 2 | 3 = 1) {
  const o = { 1: 0.06, 2: 0.1, 3: 0.16 }[level];
  return {
    shadowColor: c.shadow,
    shadowOpacity: o,
    shadowRadius: level * 8,
    shadowOffset: { width: 0, height: level * 3 },
    elevation: level * 2,
  } as const;
}
