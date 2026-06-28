import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { Button } from '@/components/ui/Button';
import { useStoreOwnerGate } from '../hooks/useStoreOwnerGate';
import { storeOwnerService } from '../services/storeOwnerService';
import type { StoreApplicationDraftInput, StoreOwnerGateState } from '../types';

const SELLER_AGREEMENT_VERSION = 'seller-agreement-v2026-06-27';
const DOCUMENT_BUCKET = 'seller-verification-docs';

type DraftField = keyof StoreApplicationDraftInput;

const initialDraft: StoreApplicationDraftInput = {
    ownerFullName: '',
    ownerEmail: '',
    supportContactChannel: 'phone',
    displayName: '',
    legalName: '',
    legalSellerName: '',
    storeType: 'independent_bookstore',
    description: '',
    city: '',
    state: '',
    pincode: '',
    publicAddressMode: 'locality_only',
    sellerAgreementVersion: SELLER_AGREEMENT_VERSION,
    sellerAgreementAccepted: false,
    prohibitedItemsPolicyAccepted: false,
    supportPolicyAccepted: false,
    panStatus: 'not_collected',
    gstin: '',
    applicantNotes: '',
};

function idsFromGate(gateState?: StoreOwnerGateState) {
    if (!gateState) return null;
    if (gateState.state === 'application_draft' || gateState.state === 'needs_more_info' || gateState.state === 'pending_verification') {
        return { storeId: gateState.storeId, requestId: gateState.requestId };
    }
    return null;
}

function safeFileName(name: string) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '-');
}

export default function StoreOnboardingScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const gateQuery = useStoreOwnerGate(user?.id ?? null);
    const ids = idsFromGate(gateQuery.data);
    const [draft, setDraft] = useState<StoreApplicationDraftInput>(initialDraft);
    const [isSaving, setIsSaving] = useState(false);

    const canSubmit = useMemo(() => {
        return Boolean(
            ids &&
            draft.ownerFullName.trim() &&
            draft.displayName.trim() &&
            draft.legalSellerName.trim() &&
            draft.city.trim() &&
            draft.state.trim() &&
            draft.pincode.trim() &&
            draft.sellerAgreementAccepted &&
            draft.prohibitedItemsPolicyAccepted &&
            draft.supportPolicyAccepted
        );
    }, [draft, ids]);

    const updateDraft = (field: DraftField, value: StoreApplicationDraftInput[DraftField]) => {
        setDraft((current) => ({ ...current, [field]: value }));
    };

    const saveDraft = async () => {
        if (!ids) return;
        setIsSaving(true);
        try {
            await storeOwnerService.saveApplicationDraft({ ...draft, ...ids });
        } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Could not save application.');
        } finally {
            setIsSaving(false);
        }
    };

    const submit = async () => {
        if (!ids || !canSubmit) return;
        setIsSaving(true);
        try {
            await storeOwnerService.submitApplication({ ...draft, ...ids });
        } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Could not submit application.');
        } finally {
            setIsSaving(false);
        }
    };

    const uploadDocument = async () => {
        if (!ids) return;
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });
        if (result.canceled || !result.assets[0]) return;

        const asset = result.assets[0];
        const fileName = safeFileName(asset.fileName ?? 'storefront-document.jpg');
        const documentType = 'storefront_photo';
        const storagePath = `${ids.storeId}/${ids.requestId}/${documentType}/${Date.now()}-${fileName}`;
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const { error } = await supabase.storage
            .from(DOCUMENT_BUCKET)
            .upload(storagePath, blob, { contentType: asset.mimeType ?? 'image/jpeg', upsert: true });
        if (error) throw error;

        await storeOwnerService.recordVerificationDocument({
            ...ids,
            documentType,
            storagePath,
            maskedLabel: fileName,
        });
    };

    return (
        <ScreenBackground>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={[styles.title, { color: colors.textPrimary }]}>Store application</Text>
                <Field label="Owner full name" value={draft.ownerFullName} onChangeText={(value) => updateDraft('ownerFullName', value)} />
                <Field label="Owner email" value={draft.ownerEmail ?? ''} onChangeText={(value) => updateDraft('ownerEmail', value)} />
                <Field label="Store display name" value={draft.displayName} onChangeText={(value) => updateDraft('displayName', value)} />
                <Field label="Legal name" value={draft.legalName ?? ''} onChangeText={(value) => updateDraft('legalName', value)} />
                <Field label="Legal seller name" value={draft.legalSellerName} onChangeText={(value) => updateDraft('legalSellerName', value)} />
                <Field label="City" value={draft.city} onChangeText={(value) => updateDraft('city', value)} />
                <Field label="State" value={draft.state} onChangeText={(value) => updateDraft('state', value)} />
                <Field label="Pincode" value={draft.pincode} onChangeText={(value) => updateDraft('pincode', value)} />
                <Field label="Applicant notes" value={draft.applicantNotes ?? ''} onChangeText={(value) => updateDraft('applicantNotes', value)} />

                <PolicyToggle label="Accept seller agreement" checked={draft.sellerAgreementAccepted} onPress={() => updateDraft('sellerAgreementAccepted', !draft.sellerAgreementAccepted)} />
                <PolicyToggle label="Accept prohibited items policy" checked={draft.prohibitedItemsPolicyAccepted} onPress={() => updateDraft('prohibitedItemsPolicyAccepted', !draft.prohibitedItemsPolicyAccepted)} />
                <PolicyToggle label="Accept support policy" checked={draft.supportPolicyAccepted} onPress={() => updateDraft('supportPolicyAccepted', !draft.supportPolicyAccepted)} />

                <Button title="Save draft" onPress={saveDraft} variant="secondary" size="md" disabled={!ids || isSaving} accessibilityLabel="Save store application draft" />
                <View style={styles.buttonGap} />
                <Button title="Submit application" onPress={submit} variant="primary" size="md" disabled={!canSubmit || isSaving} accessibilityLabel="Submit store application" />
                <View style={styles.buttonGap} />
                <Button title="Upload storefront document" onPress={uploadDocument} variant="secondary" size="md" disabled={!ids} accessibilityLabel="Upload storefront document" />
            </ScrollView>
        </ScreenBackground>
    );
}

function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                accessibilityLabel={label}
                style={styles.input}
            />
        </View>
    );
}

function PolicyToggle({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity onPress={onPress} accessibilityLabel={label} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.policyRow}>
            <Text style={styles.checkbox}>{checked ? '[x]' : '[ ]'}</Text>
            <Text style={styles.policyText}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    content: {
        padding: 24,
        paddingTop: 72,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        marginBottom: 20,
    },
    field: {
        marginBottom: 14,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: '#4b5563',
        marginBottom: 6,
    },
    input: {
        minHeight: 48,
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 16,
        backgroundColor: '#ffffff',
    },
    policyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 44,
    },
    checkbox: {
        width: 34,
        fontWeight: '800',
        color: '#111827',
    },
    policyText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    buttonGap: {
        height: 12,
    },
});
