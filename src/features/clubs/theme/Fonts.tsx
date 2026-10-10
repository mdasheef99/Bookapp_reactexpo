import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { colors } from './tokens';
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Newsreader_700Bold,
} from '@expo-google-fonts/newsreader';

interface ClubsFontProviderProps {
    children: React.ReactNode;
}

export function ClubsFontProvider({ children }: ClubsFontProviderProps) {
    const [loaded, error] = useFonts({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
        Newsreader_400Regular,
        Newsreader_400Regular_Italic,
        Newsreader_500Medium,
        Newsreader_600SemiBold,
        Newsreader_700Bold,
    });

    if (!loaded && !error) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
                <ActivityIndicator accessibilityLabel="Loading Clubs" color={colors.accent} />
            </View>
        );
    }
    return <>{children}</>;
}
