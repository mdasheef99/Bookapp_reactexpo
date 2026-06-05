import { View, Text, Alert, StyleSheet, ScrollView } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScreenBackground } from '@/components/ui/ScreenBackground';

export default function SetupProfileScreen() {
    const [name, setName] = useState('');
    const [city, setCity] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const { colors } = useTheme();

    // Input sanitization: only allow letters and spaces
    const handleNameChange = (text: string) => {
        const sanitized = text.replace(/[^a-zA-Z\s]/g, '');
        setName(sanitized);
    };

    const handleCityChange = (text: string) => {
        const sanitized = text.replace(/[^a-zA-Z\s]/g, '');
        setCity(sanitized);
    };

    // Referral code: alphanumeric only, auto-uppercase
    const handleReferralChange = (text: string) => {
        const sanitized = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        setReferralCode(sanitized);
    };

    const handleCompleteProfile = async () => {
        if (!name || !city) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        if (!user) {
            Alert.alert('Error', 'User not authenticated');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.rpc('complete_profile_setup', {
                p_display_name: name.trim(),
                p_city: city.trim(),
                p_referral_code: referralCode.trim() || null,
            });

            if (error) throw error;

            router.replace('/(tabs)/library');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create profile. Please try again.';
            Alert.alert('Error', message);
        } finally {
            setLoading(false);
        }
    };

    const isButtonEnabled = name.trim() !== '' && city.trim() !== '' && !loading;

    return (
        <ScreenBackground>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <GlassCard style={{ width: '100%', maxWidth: 400, alignSelf: 'center' }} padding={32} borderRadius={32}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Ionicons name="hand-left" size={48} color={colors.accent} accessibilityLabel="Welcome" />
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome!</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            Let's set up your profile to get started
                        </Text>
                    </View>

                    {/* Form Inputs */}
                    <View style={styles.formSection}>
                        <Input
                            label="Display Name *"
                            value={name}
                            onChangeText={handleNameChange}
                            placeholder="What should we call you?"
                            accessibilityLabel="Display name input"
                            accessibilityHint="Enter your display name, letters and spaces only"
                        />
                        <View style={{ marginTop: 16 }}>
                            <Input
                                label="City *"
                                value={city}
                                onChangeText={handleCityChange}
                                placeholder="Which city are you in?"
                                accessibilityLabel="City input"
                                accessibilityHint="Enter your city, letters and spaces only"
                            />
                        </View>
                        <View style={{ marginTop: 16 }}>
                            <Input
                                label="Referral Code (Optional)"
                                value={referralCode}
                                onChangeText={handleReferralChange}
                                placeholder="Enter code if you have one"
                                accessibilityLabel="Referral code input"
                                accessibilityHint="Enter a referral code if you have one, alphanumeric only"
                            />
                        </View>
                    </View>

                    {/* Get Started Button */}
                    <Button
                        title={loading ? 'Setting up...' : 'Get Started'}
                        onPress={handleCompleteProfile}
                        variant="primary"
                        size="lg"
                        disabled={!isButtonEnabled}
                        loading={loading}
                        accessibilityLabel="Complete profile setup"
                    />

                    {/* Bonus Info */}
                    <View style={[styles.bonusBox, { backgroundColor: colors.bgSecondary }]}>
                        <View style={styles.bonusRow}>
                            <Ionicons name="sparkles" size={16} color={colors.accent} style={{ marginRight: 6 }} accessibilityLabel="Bonus" />
                            <Text style={[styles.bonusText, { color: colors.textSecondary }]}>
                                Get <Text style={[styles.bonusHighlight, { color: colors.accent }]}>+1 credit</Text> just for joining!
                            </Text>
                        </View>
                    </View>
                </GlassCard>
            </ScrollView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({

    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    bonusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15,
        fontWeight: '500',
        textAlign: 'center',
    },
    formSection: {
        marginBottom: 24,
    },
    bonusBox: {
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 16,
    },
    bonusText: {
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
    },
    bonusHighlight: {
        fontWeight: '700',
    },
});
