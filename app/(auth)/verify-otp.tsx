import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '@/features/auth/services/authService';
import { profileService } from '@/features/auth/services/profileService';

const DEV_TEST_PHONE = '1234567890';
const DEV_TEST_OTP = '123456';

export default function VerifyOtpScreen() {
    const { phone } = useLocalSearchParams();
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState(false);
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
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const isButtonEnabled = otp.length === 6 && !loading;

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

            {/* Main Content */}
            <View style={styles.contentContainer}>
                {/* Back Button */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                >
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>

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
                            <Text style={styles.title}>Enter OTP</Text>
                            <Text style={styles.subtitle}>
                                We've sent a 6-digit code to{'\n'}
                                <Text style={styles.phoneNumber}>+91 {phone}</Text>
                            </Text>
                            {isDevTestPhone ? <Text style={styles.devHint} testID="dev-otp-helper">Dev test code: {DEV_TEST_OTP}</Text> : null}
                        </View>

                        {/* OTP Input Section */}
                        <View style={styles.inputSection}>
                            <Text style={styles.label}>Verification Code</Text>

                            <View style={[
                                styles.inputRow,
                                focused && styles.inputRowFocused
                            ]}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="• • • • • •"
                                    placeholderTextColor="#A0A0A0"
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    value={otp}
                                    onChangeText={handleOtpChange}
                                    onFocus={() => setFocused(true)}
                                    onBlur={() => setFocused(false)}
                                    testID="verify-otp-input"
                                />
                            </View>

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
                        <TouchableOpacity
                            onPress={handleVerifyOtp}
                            disabled={!isButtonEnabled}
                            activeOpacity={0.85}
                            style={[styles.buttonWrapper, !isButtonEnabled && styles.buttonDisabled]}
                            testID="verify-otp-button"
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
                                    {loading ? 'Verifying...' : 'Verify OTP'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Resend */}
                        <TouchableOpacity style={styles.resendButton}>
                            <Text style={styles.resendText}>Resend OTP</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
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
