import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/hooks/useAuth';

export default function SetupProfileScreen() {
    const [name, setName] = useState('');
    const [city, setCity] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const { user } = useAuth();

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

    const generateReferralCode = (name: string) => {
        const cleanName = name.replace(/\s/g, '').toUpperCase();
        const randomNum = Math.floor(Math.random() * 9999);
        return `${cleanName.substring(0, 4)}${randomNum}`;
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
            const myReferralCode = generateReferralCode(name);

            // Create user profile
            const { error: profileError } = await supabase
                .from('user_profiles')
                .insert({
                    user_id: user.id,
                    display_name: name,
                    city,
                    referral_code: myReferralCode,
                    referred_by_code: referralCode || null,
                });

            if (profileError) throw profileError;

            // Handle referral if provided
            if (referralCode) {
                const { data: referrer, error: referrerError } = await supabase
                    .from('user_profiles')
                    .select('user_id')
                    .eq('referral_code', referralCode)
                    .single();

                if (!referrerError && referrer) {
                    await supabase.from('referrals').insert({
                        referrer_id: referrer.user_id,
                        referred_id: user.id,
                        referral_code: referralCode,
                    });
                }
            }

            // Award signup bonus (via SECURITY DEFINER function — credit_events INSERT is locked down)
            await supabase.rpc('grant_signup_bonus', { p_user_id: user.id });

            router.replace('/(tabs)/library');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const isButtonEnabled = name.trim() !== '' && city.trim() !== '' && !loading;

    return (
        <View style={styles.container}>
            {/* Whimsical gradient background */}
            <LinearGradient
                colors={['#d9f99d', '#fef08a', '#bae6fd']}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Decorative book elements */}
            <View style={[styles.bookDecor, styles.bookDecor1]} />
            <View style={[styles.bookDecor, styles.bookDecor2]} />
            <View style={[styles.bookDecor, styles.bookDecor3]} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Card with Glassmorphism */}
                <View style={styles.cardContainer}>
                    {/* Glassmorphism gradient overlay */}
                    <LinearGradient
                        colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)']}
                        style={styles.glassOverlay}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                    />

                    <View style={styles.card}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.emoji}>👋</Text>
                            <Text style={styles.title}>Welcome!</Text>
                            <Text style={styles.subtitle}>
                                Let's set up your profile to get started
                            </Text>
                        </View>

                        {/* Form Inputs */}
                        <View style={styles.formSection}>
                            {/* Name Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Display Name *</Text>
                                <View style={[
                                    styles.inputRow,
                                    focusedField === 'name' && styles.inputRowFocused
                                ]}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="What should we call you?"
                                        placeholderTextColor="#A0A0A0"
                                        value={name}
                                        onChangeText={handleNameChange}
                                        onFocus={() => setFocusedField('name')}
                                        onBlur={() => setFocusedField(null)}
                                    />
                                </View>
                            </View>

                            {/* City Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>City *</Text>
                                <View style={[
                                    styles.inputRow,
                                    focusedField === 'city' && styles.inputRowFocused
                                ]}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Which city are you in?"
                                        placeholderTextColor="#A0A0A0"
                                        value={city}
                                        onChangeText={handleCityChange}
                                        onFocus={() => setFocusedField('city')}
                                        onBlur={() => setFocusedField(null)}
                                    />
                                </View>
                            </View>

                            {/* Referral Code Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Referral Code (Optional)</Text>
                                <View style={[
                                    styles.inputRow,
                                    focusedField === 'referral' && styles.inputRowFocused
                                ]}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter code if you have one"
                                        placeholderTextColor="#A0A0A0"
                                        value={referralCode}
                                        onChangeText={handleReferralChange}
                                        onFocus={() => setFocusedField('referral')}
                                        onBlur={() => setFocusedField(null)}
                                        autoCapitalize="characters"
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Get Started Button */}
                        <TouchableOpacity
                            onPress={handleCompleteProfile}
                            disabled={!isButtonEnabled}
                            activeOpacity={0.85}
                            style={[styles.buttonWrapper, !isButtonEnabled && styles.buttonDisabled]}
                        >
                            <LinearGradient
                                colors={
                                    isButtonEnabled
                                        ? ['#84cc16', '#eab308']
                                        : ['#E0E0E0', '#CCCCCC']
                                }
                                style={styles.button}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={[
                                    styles.buttonText,
                                    { color: isButtonEnabled ? '#FFFFFF' : '#A0A0A0' }
                                ]}>
                                    {loading ? 'Setting up...' : 'Get Started 🚀'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Bonus Info */}
                        <View style={styles.bonusBox}>
                            <Text style={styles.bonusText}>
                                💫 Get <Text style={styles.bonusHighlight}>+1 credit</Text> just for joining!
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    bookDecor: {
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 8,
        transform: [{ rotate: '-15deg' }],
    },
    bookDecor1: {
        width: 120,
        height: 160,
        top: 60,
        left: -40,
        opacity: 0.6,
    },
    bookDecor2: {
        width: 100,
        height: 140,
        bottom: 100,
        right: -30,
        opacity: 0.5,
    },
    bookDecor3: {
        width: 80,
        height: 110,
        top: '45%',
        right: 20,
        opacity: 0.4,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 40,
    },
    cardContainer: {
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
        borderRadius: 32,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.2,
        shadowRadius: 35,
        elevation: 15,
    },
    glassOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 32,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.6)',
    },
    card: {
        padding: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    emoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#666666',
        textAlign: 'center',
    },
    formSection: {
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 12,
        letterSpacing: 0.3,
    },
    inputRow: {
        backgroundColor: '#F8F8F8',
        borderRadius: 16,
        height: 56,
        paddingHorizontal: 16,
        borderWidth: 2,
        borderColor: '#E8E8E8',
        justifyContent: 'center',
    },
    inputRowFocused: {
        backgroundColor: '#FFFFFF',
        borderColor: '#84cc16',
        shadowColor: '#84cc16',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    input: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1A1A1A',
    },
    buttonWrapper: {
        marginBottom: 16,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    button: {
        height: 60,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#84cc16',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    buttonText: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    bonusBox: {
        backgroundColor: 'rgba(145, 197, 94, 0.15)',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    bonusText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666666',
        textAlign: 'center',
    },
    bonusHighlight: {
        fontWeight: '700',
        color: '#84cc16',
    },
});
