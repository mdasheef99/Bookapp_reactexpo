import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { authService } from '@/features/auth/services/authService';
import { profileService } from '@/features/auth/services/profileService';

const DEV_TEST_PHONE = '1234567890';
const DEV_TEST_OTP = '123456';

export default function VerifyOtpScreen() {
    const { phone } = useLocalSearchParams();
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const isDevTestPhone = phone === DEV_TEST_PHONE;

    // Input sanitization: only allow numeric digits
    const handleOtpChange = (text: string) => {
        const sanitized = text.replace(/[^0-9]/g, '');
        setOtp(sanitized);
    };

    const handleVerifyOtp = async () => {
        if (otp.length !== 6) {
            Alert.alert('Error', 'Please enter a valid 6-digit OTP');
            return;
        }

        setLoading(true);
        try {
            const verificationResult = await authService.verifyOtp(phone as string, otp);
            const userId = verificationResult.user?.id ?? verificationResult.session?.user?.id;

            if (!userId) {
                throw new Error('Unable to determine the authenticated user after OTP verification. Please try again.');
            }

            const existingProfile = await profileService.getProfile(userId);
            router.replace(existingProfile ? '/(tabs)/library' : '/(auth)/setup-profile');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to verify OTP. Please try again.';
            Alert.alert('Error', message);
        } finally {
            setLoading(false);
        }
    };

    const isButtonEnabled = otp.length === 6 && !loading;

    return (
        <ScreenBackground>
            {/* Main Content */}
            <View style={styles.contentContainer}>
                {/* Back Button */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                >
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>

                <GlassCard style={{ width: '100%', maxWidth: 400, alignSelf: 'center' }} padding={32} borderRadius={32}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.title}>Enter OTP</Text>
                            <Text style={styles.subtitle}>
                                We've sent a 6-digit code to{'\n'}
                                <Text style={styles.phoneNumber}>+91 {phone}</Text>
                            </Text>
                            {isDevTestPhone ? <Text style={styles.devHint} testID="dev-otp-helper">Dev test code: {DEV_TEST_OTP}</Text> : null}
                        </View>

                        {/* OTP Input Section */}
                        <View style={styles.inputSection}>
                            <Input
                                label="Verification Code"
                                value={otp}
                                onChangeText={handleOtpChange}
                                placeholder="• • • • • •"
                                keyboardType="number-pad"
                                maxLength={6}
                                testID="verify-otp-input"
                                accessibilityLabel="OTP input"
                                accessibilityHint="Enter the 6 digit verification code"
                            />

                            {/* Progress indicator */}
                            {otp.length > 0 && (
                                <View style={styles.progressContainer}>
                                    <View style={styles.progressBar}>
                                        <View style={[
                                            styles.progressFill,
                                            {
                                                width: `${(otp.length / 6) * 100}%`,
                                                backgroundColor: otp.length === 6 ? '#84cc16' : '#facc15'
                                            }
                                        ]} />
                                    </View>
                                    <Text style={styles.progressText}>
                                        {otp.length}/6 digits
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Verify Button */}
                        <Button
                            title={loading ? 'Verifying...' : 'Verify OTP'}
                            onPress={handleVerifyOtp}
                            variant="primary"
                            size="lg"
                            disabled={!isButtonEnabled}
                            loading={loading}
                            testID="verify-otp-button"
                            accessibilityLabel="Verify one-time password"
                        />

                        {/* Resend */}
                        <Button
                            title="Resend OTP"
                            onPress={() => {}}
                            variant="ghost"
                            size="sm"
                            accessibilityLabel="Resend OTP code"
                        />
                    </GlassCard>
            </View>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({

    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingTop: 60,
    },
    backButton: {
        marginBottom: 24,
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#84cc16',
    },

    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#666666',
        lineHeight: 22,
    },
    devHint: {
        marginTop: 12,
        fontSize: 14,
        fontWeight: '700',
        color: '#84cc16',
    },
    phoneNumber: {
        fontWeight: '700',
        color: '#1A1A1A',
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
        backgroundColor: '#F8F8F8',
        borderRadius: 16,
        height: 60,
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
        fontSize: 24,
        fontWeight: '700',
        color: '#1A1A1A',
        textAlign: 'center',
        letterSpacing: 8,
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
        color: '#facc15',
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
    resendButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    resendText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#84cc16',
    },
});
