import { View, Text, Alert, StyleSheet } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { Input } from '@/components/ui/Input';
import { authService } from '@/features/auth/services/authService';
import { useTheme } from '@/hooks/useTheme';

export default function LoginScreen() {
    const { colors } = useTheme();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);

    // Input sanitization: only allow numeric digits
    const handlePhoneChange = (text: string) => {
        const sanitized = text.replace(/[^0-9]/g, '');
        setPhone(sanitized);
    };

    const handleSendOtp = async (intent?: 'store_owner') => {
        if (phone.length !== 10) {
            Alert.alert('Error', 'Please enter a valid 10-digit phone number');
            return;
        }

        setLoading(true);
        try {
            await authService.signInWithOtp(phone);
            router.push({
                pathname: '/(auth)/verify-otp',
                params: intent ? { phone, intent } : { phone },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to send OTP. Please try again.';
            Alert.alert('Error', message);
        } finally {
            setLoading(false);
        }
    };

    const isButtonEnabled = phone.length === 10 && !loading;

    return (
        <ScreenBackground>
            {/* Main Content Card with Glassmorphism */}
            <View style={styles.contentContainer}>
                <GlassCard style={{ width: '85%', maxWidth: 360 }} padding={32} borderRadius={32}>
                        {/* Logo Icon */}
                        <View style={styles.logoContainer}>
                            <LinearGradient
                                colors={['#84cc16', '#bef264']} // Keeping the brand lime green for logo
                                style={styles.logoBox}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name="book" size={40} color="#FFFFFF" accessibilityLabel="BookTalks logo" />
                            </LinearGradient>
                        </View>

                        {/* Title */}
                        <Text style={[styles.title, { color: colors.textPrimary }]}>BookTalks</Text>

                        {/* Tagline */}
                        <Text style={[styles.tagline, { color: colors.accent }]}>Where Books Keep Moving Forward</Text>

                        {/* Input Section */}
                        <View style={styles.inputSection}>
                            <Input
                                label="Mobile Number"
                                value={phone}
                                onChangeText={handlePhoneChange}
                                placeholder="98765"
                                keyboardType="number-pad"
                                maxLength={10}
                                testID="login-phone-input"
                                accessibilityLabel="Mobile number input"
                                accessibilityHint="Enter your 10 digit Indian mobile number"
                                leftElement={
                                    <View style={styles.countryCodeBox}>
                                        <Text style={styles.countryCode}>+91</Text>
                                        <View style={styles.countryDivider} />
                                    </View>
                                }
                            />

                            {/* Progress indicator */}
                            {phone.length > 0 && (
                                <View style={styles.progressContainer}>
                                    <View style={styles.progressBar}>
                                        <View style={[
                                            styles.progressFill,
                                            {
                                                width: `${(phone.length / 10) * 100}%`,
                                                backgroundColor: phone.length === 10 ? colors.accent : colors.accentLight
                                            }
                                        ]} />
                                    </View>
                                    <Text style={styles.progressText}>
                                        {phone.length}/10 digits
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Continue Button */}
                        <Button
                            title="Continue"
                            onPress={() => handleSendOtp()}
                            variant="primary"
                            size="lg"
                            disabled={!isButtonEnabled}
                            loading={loading}
                            testID="login-continue-button"
                            accessibilityLabel="Continue to OTP verification"
                        />
                        <Button
                            title="Apply as a bookstore"
                            onPress={() => handleSendOtp('store_owner')}
                            variant="secondary"
                            size="md"
                            disabled={!isButtonEnabled}
                            loading={loading}
                            accessibilityLabel="Apply as a bookstore"
                            style={styles.storeOwnerButton}
                        />

                        {/* Footer */}
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                By continuing, you agree to our{' '}
                                <Text style={styles.footerLink}>Terms of Service</Text>
                                {' '}&{' '}
                                <Text style={styles.footerLink}>Privacy Policy</Text>
                            </Text>
                        </View>
                </GlassCard>
            </View>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },

    logoContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    logoBox: {
        width: 80,
        height: 80,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#91C55E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },

    title: {
        fontSize: 42,
        fontWeight: '700',
        textAlign: 'center',
        color: '#1A1A1A',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    tagline: {
        fontSize: 15,
        fontWeight: '500',
        textAlign: 'center',
        color: '#91C55E',
        marginBottom: 40,
        letterSpacing: 0.3,
    },
    inputSection: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 12,
        letterSpacing: 0.3,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        borderRadius: 16,
        height: 60,
        paddingHorizontal: 16,
        borderWidth: 2,
        borderColor: '#E8E8E8',
    },
    inputRowFocused: {
        backgroundColor: '#FFFFFF',
        borderColor: '#91C55E',
        shadowColor: '#91C55E',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    countryCodeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 12,
        minWidth: 60,
    },
    countryCode: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    countryDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#D0D0D0',
        marginLeft: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        color: '#1A1A1A',
        letterSpacing: 1,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 12,
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: '#F0F0F0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#E8C948',
    },
    buttonWrapper: {
        marginBottom: 24,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    button: {
        height: 60,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#91C55E',
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
    buttonArrow: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    loadingContainer: {
        flexDirection: 'row',
        gap: 6,
    },
    loadingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FFFFFF',
    },
    loadingDot2: {
        opacity: 0.6,
    },
    loadingDot3: {
        opacity: 0.3,
    },
    footer: {
        alignItems: 'center',
    },
    storeOwnerButton: {
        marginTop: 12,
    },
    footerText: {
        fontSize: 12,
        color: '#D0D0D0', // Light text for dark background
        textAlign: 'center',
        lineHeight: 18,
    },
    footerLink: {
        color: '#bef264', // Bright accent
        fontWeight: '600',
    },
});
