import { StyleSheet } from 'react-native';
import { colors, fontFamilies } from './tokens';

export const typography = StyleSheet.create({
    clubTitle: {
        fontFamily: 'Newsreader_700Bold',
        fontSize: 28,
        lineHeight: 34,
        color: colors.textPrimary,
    },
    bookTitle: {
        fontFamily: 'Newsreader_600SemiBold',
        fontSize: 20,
        lineHeight: 26,
        color: colors.textPrimary,
    },
    discussionTitle: {
        fontFamily: 'Newsreader_600SemiBold',
        fontSize: 18,
        lineHeight: 24,
        color: colors.textPrimary,
    },
    sectionHeading: {
        fontFamily: 'Newsreader_600SemiBold',
        fontSize: 16,
        lineHeight: 22,
        color: colors.textPrimary,
    },
    quote: {
        fontFamily: 'Newsreader_400Regular_Italic',
        fontSize: 17,
        lineHeight: 26,
        color: colors.textSecondary,
    },
    body: {
        fontFamily: 'Inter_400Regular',
        fontSize: 16,
        lineHeight: 24,
        color: colors.textPrimary,
    },
    bodyCompact: {
        fontFamily: 'Inter_400Regular',
        fontSize: 15,
        lineHeight: 21,
        color: colors.textPrimary,
    },
    metadata: {
        fontFamily: 'Inter_400Regular',
        fontSize: 13,
        lineHeight: 18,
        color: colors.textMuted,
    },
    button: {
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        lineHeight: 22,
        color: colors.textPrimary,
    },
    tabLabel: {
        fontFamily: 'Inter_400Regular',
        fontSize: 11,
        lineHeight: 14,
        color: colors.textSecondary,
    },
    kicker: {
        fontFamily: 'Inter_500Medium',
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: colors.textMuted,
    },
    input: {
        fontFamily: 'Inter_400Regular',
        fontSize: 16,
        lineHeight: 22,
        color: colors.textPrimary,
    },
    managementRow: {
        fontFamily: 'Inter_400Regular',
        fontSize: 15,
        lineHeight: 21,
        color: colors.textPrimary,
    },
});

export type TypographyKey = keyof typeof typography;
