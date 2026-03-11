import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Image, ImageBackground } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '@/features/auth/services/authService';

export default function LoginScreen() {
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState(false);

    // Input sanitization: only allow numeric digits
    const handlePhoneChange = (text: string) => {
        const sanitized = text.replace(/[^0-9]/g, '');
        setPhone(sanitized);
    };

    const handleSendOtp = async () => {
        if (phone.length !== 10) {
            Alert.alert('Error', 'Please enter a valid 10-digit phone number');
            return;
        }

        setLoading(true);
        try {
            await authService.signInWithOtp(phone);
            router.push({ pathname: '/(auth)/verify-otp', params: { phone } });
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const isButtonEnabled = phone.length === 10 && !loading;

    return (
        <ImageBackground
            source={require('../../assets/images/backgrounds/bg_golden.webp')}
            style={styles.container}
            resizeMode="cover"
        >
            <View style={styles.overlay} />

            {/* Main Content Card with Glassmorphism */}
            <View style={styles.contentContainer}>
                <View style={styles.cardContainer}>
                    {/* Glassmorphism gradient overlay - Golden Brown Transparent */}
                    <LinearGradient
                        colors={['rgba(100, 70, 20, 0.55)', 'rgba(80, 50, 10, 0.45)']} // Golden Brown, more transparent
                        style={styles.glassOverlay}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                    />

                    {/* Border for extra glass definition */}
                    <View style={styles.glassBorder} />

                    <View style={styles.card}>
                        {/* Logo Icon */}
                        <View style={styles.logoContainer}>
                            <LinearGradient
                                colors={['#84cc16', '#bef264']} // Keeping the brand lime green for logo
                                style={styles.logoBox}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={styles.logoIcon}>📖</Text>
                            </LinearGradient>
                        </View>

                        {/* Title */}
                        <Text style={[styles.title, { color: '#FFFFFF' }]}>BookTalks</Text>

                        {/* Tagline */}
                        <Text style={[styles.tagline, { color: '#eab308' }]}>Where Books Keep Moving Forward</Text>

                        {/* Input Section */}
                        <View style={styles.inputSection}>
                            <Text style={[styles.label, { color: '#F3F4F6' }]}>Mobile Number</Text>

                            <View style={[
                                styles.inputRow,
                                focused && styles.inputRowFocused,
                                { backgroundColor: 'rgba(255, 255, 255, 0.95)', opacity: 1 } // High opacity for readability
                            ]}>
                                <View style={styles.countryCodeBox}>
                                    <Text style={styles.countryCode}>+91</Text>
                                    <View style={styles.countryDivider} />
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="98765"
                                    placeholderTextColor="#6B7280"
                                    keyboardType="number-pad"
                                    maxLength={10}
                                    value={phone}
                                    onChangeText={handlePhoneChange}
                                    onFocus={() => setFocused(true)}
                                    onBlur={() => setFocused(false)}
                                    testID="login-phone-input"
                                />
                            </View>

                            {/* Progress indicator */}
                            {phone.length > 0 && (
                                <View style={styles.progressContainer}>
                                    <View style={styles.progressBar}>
                                        <View style={[
                                            styles.progressFill,
                                            {
                                                width: `${(phone.length / 10) * 100}%`,
                                                backgroundColor: phone.length === 10 ? '#84cc16' : '#facc15'
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
                        <TouchableOpacity
                            onPress={handleSendOtp}
                            disabled={!isButtonEnabled}
                            activeOpacity={0.85}
                            style={[styles.buttonWrapper, !isButtonEnabled && styles.buttonDisabled]}
                            testID="login-continue-button"
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
                                {loading ? (
                                    <View style={styles.loadingContainer}>
                                        <View style={styles.loadingDot} />
                                        <View style={[styles.loadingDot, styles.loadingDot2]} />
                                        <View style={[styles.loadingDot, styles.loadingDot3]} />
                                    </View>
                                ) : (
                                    <>
                                        <Text style={[
                                            styles.buttonText,
                                            { color: isButtonEnabled ? '#FFFFFF' : '#A0A0A0' }
                                        ]}>
                                            Continue
                                        </Text>
                                        <Text style={[styles.buttonArrow, {
                                            color: isButtonEnabled ? '#FFFFFF' : '#A0A0A0'
                                        }]}>
                                            →
                                        </Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Footer */}
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                By continuing, you agree to our{' '}
                                <Text style={styles.footerLink}>Terms of Service</Text>
                                {' '}&{' '}
                                <Text style={styles.footerLink}>Privacy Policy</Text>
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.2)', // Slight dark overlay for text contrast on the background
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
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    cardContainer: {
        width: '85%', // Responsive width for mobile
        maxWidth: 360, // Standard mobile width limit
        borderRadius: 32,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.3,
        shadowRadius: 35,
        elevation: 20,
    },
    glassOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    glassBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 32,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 237, 213, 0.3)', // Soft golden border
    },
    card: {
        padding: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
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
    logoIcon: {
        fontSize: 40,
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
