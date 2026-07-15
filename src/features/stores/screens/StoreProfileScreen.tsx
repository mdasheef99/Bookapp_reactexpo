import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useStoreOwnerGate } from '../hooks/useStoreOwnerGate';
import { OPERATING_HOURS_DAYS, RETURN_POLICY_TYPES, storeProfileService } from '../services/storeProfileService';
import type { StoreProfileInput } from '../types';

type DaySchedule = { open: string | null; close: string | null; closed: boolean };
type Weekday = typeof OPERATING_HOURS_DAYS[number];
type HoursState = Record<Weekday, DaySchedule> & { temporary_closure: boolean };

const defaultHours = (): HoursState => ({
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false },
    wednesday: { open: '09:00', close: '18:00', closed: false },
    thursday: { open: '09:00', close: '18:00', closed: false },
    friday: { open: '09:00', close: '18:00', closed: false },
    saturday: { open: '10:00', close: '17:00', closed: false },
    sunday: { open: null, close: null, closed: true },
    temporary_closure: false,
});

function toMinor(value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round(parsed * 100);
}

function fromMinor(value: number | null) {
    return value ? String(Math.round(value / 100)) : '';
}

function normalizeHours(input: Record<string, unknown>): HoursState {
    const source = Object.keys(input ?? {}).length > 0 ? input : defaultHours();
    const next = defaultHours();
    for (const day of OPERATING_HOURS_DAYS) {
        const entry = source[day] as Partial<DaySchedule> | undefined;
        next[day] = {
            open: entry?.open ?? next[day].open,
            close: entry?.close ?? next[day].close,
            closed: Boolean(entry?.closed),
        };
        if (next[day].closed) {
            next[day].open = null;
            next[day].close = null;
        }
    }
    next.temporary_closure = Boolean((source as { temporary_closure?: unknown }).temporary_closure);
    return next;
}

function SectionButton({ label, testID, onPress }: { label: string; testID: string; onPress: () => void }) {
    const { colors } = useTheme();
    return (
        <TouchableOpacity testID={testID} onPress={onPress} style={{ minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, marginTop: 12 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{label}</Text>
        </TouchableOpacity>
    );
}

export default function StoreProfileScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const queryClient = useQueryClient();
    const gateQuery = useStoreOwnerGate(user?.id ?? null);
    const gateState = gateQuery.data;
    const canEditProfile = gateState?.state === 'active_owner' || gateState?.state === 'approved_pending_setup';
    const storeId = canEditProfile ? gateState.storeId : null;

    const { data: profile, isLoading: profileLoading } = useQuery({
        queryKey: ['storeProfile', storeId],
        queryFn: () => storeProfileService.getProfile(storeId!),
        enabled: !!storeId,
        gcTime: 0,
    });

    const [displayName, setDisplayName] = useState('');
    const [description, setDescription] = useState('');
    const [hours, setHours] = useState<HoursState>(defaultHours);
    const [returnPolicyType, setReturnPolicyType] = useState('no_returns');
    const [pickupEnabled, setPickupEnabled] = useState(false);
    const [deliveryEnabled, setDeliveryEnabled] = useState(false);
    const [minimumOrder, setMinimumOrder] = useState('');
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!profile) return;
        setDisplayName(profile.displayName);
        setDescription(profile.description ?? '');
        setHours(normalizeHours(profile.operatingHours));
        setReturnPolicyType(profile.returnPolicyType);
        setPickupEnabled(profile.pickupEnabled);
        setDeliveryEnabled(profile.deliveryEnabled);
        setMinimumOrder(fromMinor(profile.minimumDeliveryOrderValueMinor));
    }, [profile]);

    if (gateQuery.isLoading || profileLoading) {
        return (
            <ScreenBackground>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Loading...</Text>
                </View>
            </ScreenBackground>
        );
    }

    if (!canEditProfile || !profile) {
        return (
            <ScreenBackground>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: colors.textPrimary }}>Access denied</Text>
                </View>
            </ScreenBackground>
        );
    }

    async function saveSection(input: StoreProfileInput) {
        if (!storeId) return;
        setIsSaving(true);
        setSaveMessage(null);
        try {
            const updated = await storeProfileService.updateProfile(storeId, input);
            queryClient.setQueryData(['storeProfile', storeId], updated);
            setSaveMessage('Store settings saved.');
        } catch {
            setSaveMessage('Could not save store settings. Please try again.');
        } finally {
            setIsSaving(false);
        }
    }

    function saveProfile() {
        return saveSection({ displayName, description: description || null });
    }

    function saveHours() {
        return saveSection({ operatingHours: hours });
    }

    function savePolicy() {
        return saveSection({ returnPolicyType });
    }

    function saveFulfillment() {
        return saveSection({
            pickupEnabled,
            deliveryEnabled,
            minimumDeliveryOrderValueMinor: minimumOrder ? toMinor(minimumOrder) : null,
        });
    }

    function setDay(day: Weekday, patch: Partial<DaySchedule>) {
        setHours((current) => {
            const next = { ...current, [day]: { ...current[day], ...patch } };
            if (next[day].closed) next[day] = { open: null, close: null, closed: true };
            return next;
        });
    }

    return (
        <ScreenBackground>
            <ScrollView style={{ flex: 1, padding: 16 }}>
                {saveMessage ? (
                    <Text testID="store-profile-save-message" style={{ color: colors.textSecondary, marginBottom: 10 }}>
                        {saveMessage}
                    </Text>
                ) : null}
                {isSaving ? <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>Saving...</Text> : null}
                <GlassCard padding={16} borderRadius={16}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 10 }}>Profile</Text>
                    <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 4 }}>{profile.displayName}</Text>
                    {profile.description ? <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>{profile.description}</Text> : null}
                    <TextInput testID="profile-display-name" style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginBottom: 8 }} value={displayName} onChangeText={setDisplayName} placeholder="Store name" />
                    <TextInput testID="profile-description" style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10 }} value={description} onChangeText={setDescription} placeholder="Description" multiline />
                    <SectionButton testID="save-profile-section" label="Save profile" onPress={saveProfile} />
                </GlassCard>

                <View style={{ height: 12 }} />

                <GlassCard padding={16} borderRadius={16}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 10 }}>Operating Hours</Text>
                    <TouchableOpacity testID="toggle-temporary-closure" onPress={() => setHours((current) => ({ ...current, temporary_closure: !current.temporary_closure }))}>
                        <Text style={{ color: colors.textPrimary }}>Temporary closure: {hours.temporary_closure ? 'Yes' : 'No'}</Text>
                    </TouchableOpacity>
                    {OPERATING_HOURS_DAYS.map((day) => (
                        <View key={day} style={{ marginTop: 8 }}>
                            <TouchableOpacity testID={`toggle-${day}-closed`} onPress={() => setDay(day, { closed: !hours[day].closed })}>
                                <Text style={{ color: colors.textPrimary, textTransform: 'capitalize' }}>{day}: {hours[day].closed ? 'Closed' : 'Open'}</Text>
                            </TouchableOpacity>
                            {!hours[day].closed ? (
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                                    <TextInput testID={`${day}-open`} style={{ flex: 1, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8 }} value={hours[day].open ?? ''} onChangeText={(value) => setDay(day, { open: value })} />
                                    <TextInput testID={`${day}-close`} style={{ flex: 1, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8 }} value={hours[day].close ?? ''} onChangeText={(value) => setDay(day, { close: value })} />
                                </View>
                            ) : null}
                        </View>
                    ))}
                    <SectionButton testID="save-hours-section" label="Save hours" onPress={saveHours} />
                </GlassCard>

                <View style={{ height: 12 }} />

                <GlassCard padding={16} borderRadius={16}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 10 }}>Return Policy</Text>
                    {RETURN_POLICY_TYPES.map((policy) => (
                        <TouchableOpacity key={policy} testID={`policy-${policy}`} onPress={() => setReturnPolicyType(policy)} style={{ paddingVertical: 6 }}>
                            <Text style={{ color: policy === returnPolicyType ? colors.accent : colors.textPrimary }}>{policy}</Text>
                        </TouchableOpacity>
                    ))}
                    <SectionButton testID="save-policies-section" label="Save policies" onPress={savePolicy} />
                </GlassCard>

                <View style={{ height: 12 }} />

                <GlassCard padding={16} borderRadius={16}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 10 }}>Fulfillment</Text>
                    <TouchableOpacity testID="toggle-pickup" onPress={() => setPickupEnabled((value) => !value)}>
                        <Text style={{ color: colors.textPrimary }}>Pickup: {pickupEnabled ? 'Available' : 'Not available'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="toggle-delivery" onPress={() => setDeliveryEnabled((value) => !value)} style={{ marginTop: 8 }}>
                        <Text style={{ color: colors.textPrimary }}>Delivery: {deliveryEnabled ? 'Available' : 'Not available'}</Text>
                    </TouchableOpacity>
                    <TextInput testID="minimum-delivery-order" style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginTop: 8 }} value={minimumOrder} onChangeText={setMinimumOrder} placeholder="Minimum delivery order in rupees" keyboardType="decimal-pad" />
                    <SectionButton testID="save-fulfillment-section" label="Save fulfillment" onPress={saveFulfillment} />
                </GlassCard>
            </ScrollView>
        </ScreenBackground>
    );
}
