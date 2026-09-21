export const colors = {
    bg: '#FAF8F5',
    surface: '#FFFFFF',
    surfaceSubtle: '#F2EFE9',
    textPrimary: '#111418',
    textSecondary: '#3F4750',
    textMuted: '#5C6470',
    border: '#E7E2D9',
    divider: '#E7E2D9',
    accent: '#7A1C28',
    accentStrong: '#62141F',
    accentSubtle: '#F7E8E9',
    success: '#1E7A3C',
    warning: '#9A6200',
    danger: '#BA1A1A',
    disabled: '#A8A29E',
} as const;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 40,
} as const;

export const radii = {
    small: 4,
    medium: 8,
    large: 12,
} as const;

export const screenInset = 20;

export const touchTarget = 44;

export const bookCovers = {
    small: { w: 44, h: 66 },
    medium: { w: 64, h: 96 },
    large: { w: 88, h: 132 },
    xlarge: { w: 120, h: 180 },
} as const;

export const avatars = {
    xs: 28,
    sm: 32,
    md: 40,
    lg: 56,
} as const;

export const fontFamilies = {
    newsreader: 'Newsreader_400Regular',
    inter: 'Inter_400Regular',
} as const;
