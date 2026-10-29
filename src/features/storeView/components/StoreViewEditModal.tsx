import { useEffect, useRef, useState, type Ref } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import type { ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { useTheme } from '@/hooks/useTheme';
import type { StoreViewDetail } from '../contracts/storeViewContracts';
import type { StoreViewChanges } from '../contracts/storeViewManagementContracts';
import {
    buildEditedChanges,
    createStoreViewEditDraft,
    editFieldEquals,
    validateStoreViewEditDraft,
    type StoreViewEditDraft,
    type StoreViewEditField,
} from '../forms/storeViewEditForm';
import {
    editIdentityChanged,
    isEditAccessLost,
    rebaseEditDraft,
    remoteFieldLabel,
    resolveEditConflict,
    type EditRefreshResult,
} from '../state/storeViewEditRebase';
import { STORE_VIEW_DAMAGE_GROUP as DAMAGE_GROUP } from '../forms/storeViewEditForm';

const CONDITIONS = ['new', 'like_new', 'very_good', 'good', 'acceptable'] as const;
const DAMAGE_TYPES = [
    'cover', 'binding', 'pages', 'water', 'staining', 'writing',
    'missing_parts', 'mould_or_contamination', 'other',
] as const;

export type StoreViewSaveOutcome =
    | { ok: true }
    | { ok: false; code: string; message: string; httpStatus?: number | null };

export type StoreViewConflictNotice = 'conflict' | 'no-changes-kept' | null;

function Input({
    label, value, onChangeText, testID, ownerOnly = false, multiline = false, editable = true, inputRef,
}: {
    label: string; value: string; onChangeText: (value: string) => void;
    testID: string; ownerOnly?: boolean; multiline?: boolean; editable?: boolean;
    inputRef?: Ref<TextInput>;
}) {
    const { colors } = useTheme();
    return (
        <View style={{ gap: 6 }}>
            <Text selectable style={{ color: ownerOnly ? colors.accent : colors.textSecondary, fontWeight: '700' }}>
                {`${label}${ownerOnly ? ' · Owner only' : ''}`}
            </Text>
            <TextInput
                ref={inputRef}
                testID={testID}
                accessibilityLabel={label}
                value={value}
                onChangeText={onChangeText}
                multiline={multiline}
                editable={editable}
                style={{
                    minHeight: multiline ? 84 : 46, borderWidth: 1, borderColor: colors.border,
                    borderRadius: 10, padding: 12, color: colors.textPrimary,
                    textAlignVertical: multiline ? 'top' : 'center',
                }}
            />
        </View>
    );
}

export function StoreViewEditModal({
    visible, detail, identity, submitting, error, onDismiss, onSave, onRefreshBook, onAccessLost, onSaved, focusPrice = false,
}: {
    visible: boolean;
    focusPrice?: boolean;
    detail: StoreViewDetail;
    identity: ImageInventoryIdentity;
    submitting: boolean;
    error: string | null;
    onDismiss: () => void;
    onSave: (changes: StoreViewChanges, baselineVersion: number) => Promise<StoreViewSaveOutcome>;
    onRefreshBook: (
        onLate: (detail: StoreViewDetail) => void,
        onLateFailure?: (failure: { ok: false; offline: boolean; code?: string | null; httpStatus?: number | null }) => void,
    ) => Promise<EditRefreshResult>;
    onAccessLost: () => void;
    onSaved: (message: string) => void;
}) {
    const { colors } = useTheme();
    const priceRef = useRef<TextInput>(null);
    // Baseline: a copy of the book and its version taken when the modal
    // opens. The draft starts from the baseline and background refreshes
    // never touch it, so typed edits survive.
    const [baseline, setBaseline] = useState<StoreViewDetail | null>(null);
    const [baselineIdentity, setBaselineIdentity] = useState<ImageInventoryIdentity | null>(null);
    const [draft, setDraft] = useState<StoreViewEditDraft>(() => createStoreViewEditDraft(detail));
    const [conflicts, setConflicts] = useState<StoreViewEditField[]>([]);
    const [notice, setNotice] = useState<StoreViewConflictNotice>(null);
    const [refreshError, setRefreshError] = useState<string | null>(null);
    const [refreshFailed, setRefreshFailed] = useState(false);
    const [saving, setSaving] = useState(false);
    const [recovering, setRecovering] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [recoverKind, setRecoverKind] = useState<'conflict' | 'no-changes' | null>(null);

    const openRef = useRef(false);
    // Opening generation: recovery and late results from a previous opening
    // are ignored and never call onSaved.
    const openingRef = useRef(0);
    // R10: per-attempt id within each opening. A late result from an earlier
    // timed-out attempt must not overwrite a newer Retry.
    const attemptRef = useRef(0);
    // R11: mount tracking. After unmount, no post-await path calls
    // onSaved/onAccessLost or sets state.
    const mountedRef = useRef(true);
    useEffect(() => () => { mountedRef.current = false; }, []);
    // R2: the edited set is held fixed across rebases. It lives in state
    // (rendered) with a synchronously-updated ref (fresh inside batched
    // continuations). Owner edits add to it; it changes otherwise only
    // through conflict choices. Rebases never touch it.
    const [editedSet, setEditedSet] = useState<Set<StoreViewEditField>>(new Set());
    const editedSetRef = useRef<Set<StoreViewEditField>>(new Set());
    const setEdited = (next: Set<StoreViewEditField>) => {
        editedSetRef.current = next;
        if (mountedRef.current) setEditedSet(next);
    };
    // Latest draft/baseline for rebasing (C1/R4): refs are assigned
    // synchronously at event time (not only during render), so recovery
    // rebases from what the owner typed even when a keystroke and the
    // recovery completion are batched together in one act().
    const draftRef = useRef(draft);
    const baselineRef = useRef<StoreViewDetail | null>(baseline);
    const conflictsRef = useRef<StoreViewEditField[]>([]);
    const setConflictList = (next: StoreViewEditField[]) => {
        conflictsRef.current = next;
        if (mountedRef.current) setConflicts(next);
    };
    // Ref lock so Save and Retry can't run twice in the same tick (C7).
    const actionLock = useRef(false);
    useEffect(() => {
        // Capture once per opening; later detail changes are applied only
        // through an explicit rebase so they never wipe typed edits.
        if (visible && !openRef.current) {
            openRef.current = true;
            openingRef.current += 1;
            const fresh = createStoreViewEditDraft(detail);
            // R12: reset saving/recovering on open so a close mid-recovery
            // never leaves Save disabled after reopen.
            baselineRef.current = detail;
            draftRef.current = fresh;
            editedSetRef.current = new Set();
            conflictsRef.current = [];
            setBaseline(detail);
            setBaselineIdentity(identity);
            setDraft(fresh);
            setEditedSet(new Set());
            setConflicts([]);
            setNotice(null);
            setRefreshError(null);
            setRefreshFailed(false);
            setLocalError(null);
            setRecoverKind(null);
            setSaving(false);
            setRecovering(false);
            actionLock.current = false;
        }
        if (!visible) {
            openRef.current = false;
            // Invalidate any in-flight recovery/late refresh (C1).
            openingRef.current += 1;
        }
    }, [visible]);
    const hasChanges = editedSet.size > 0;
    const damageConflict = conflicts.some((field) => (DAMAGE_GROUP as readonly string[]).includes(field));
    const fieldConflicts = conflicts.filter((field) => !(DAMAGE_GROUP as readonly string[]).includes(field));

    const failAccessLost = () => {
        // R11: never call onAccessLost after unmount.
        if (!mountedRef.current) return;
        setSaving(false);
        setRecovering(false);
        onAccessLost();
    };

    // Identity snapshot (C4): a user/store change while open is access lost.
    useEffect(() => {
        if (visible && baselineIdentity && editIdentityChanged(baselineIdentity, identity)) {
            failAccessLost();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, identity, baselineIdentity]);

    const applyLateRefreshFor = (
        generation: number,
        attempt: number,
        kind: 'conflict' | 'no-changes',
        refreshed: StoreViewDetail,
    ) => {
        // R10/R13: ignore late results from a previous opening or an older
        // attempt; a late refresh uses the same outcome handling as a prompt
        // one (already-saved closes, no-changes shows "Nothing was saved").
        // Never call onSaved from a stale path (C1) or after unmount (R11).
        if (generation !== openingRef.current || attempt !== attemptRef.current || !openRef.current) return;
        if (!mountedRef.current) return;
        const currentDraft = draftRef.current;
        const currentBaseline = baselineRef.current ?? detail;
        const rebased = rebaseEditDraft({
            draft: currentDraft, editedSet: editedSetRef.current, refreshed, baseline: currentBaseline,
        });
        baselineRef.current = refreshed;
        draftRef.current = rebased.draft;
        setBaseline(refreshed);
        setDraft(rebased.draft);
        setConflictList(rebased.conflicts);
        setRefreshFailed(false);
        setRefreshError(null);
        applyRecovered(kind, rebased);
    };

    const applyLateFailureFor = (
        generation: number,
        attempt: number,
        failure: { ok: false; offline: boolean; code?: string | null; httpStatus?: number | null },
    ) => {
        // R9: a failure arriving after the timeout routes late access loss
        // to the access-lost path for the current attempt only.
        if (generation !== openingRef.current || attempt !== attemptRef.current || !openRef.current) return;
        if (!mountedRef.current) return;
        if (isEditAccessLost({ code: failure.code ?? null, httpStatus: failure.httpStatus ?? null })) {
            failAccessLost();
        }
    };

    const recover = async (kind: 'conflict' | 'no-changes') => {
        const generation = openingRef.current;
        const attempt = attemptRef.current + 1;
        attemptRef.current = attempt;
        setRecovering(true);
        setRefreshError(null);
        const result = await onRefreshBook(
            (refreshed) => applyLateRefreshFor(generation, attempt, kind, refreshed),
            (failure) => applyLateFailureFor(generation, attempt, failure),
        );
        // Drop results from a previous opening or an older attempt (C1/R10).
        if (generation !== openingRef.current || attempt !== attemptRef.current || !openRef.current) return null;
        if (!mountedRef.current) return null;
        setRecovering(false);
        if (!result.ok) {
            // Access loss during refresh routes to onAccessLost (C2).
            if (isEditAccessLost({ code: result.code ?? null, httpStatus: result.httpStatus ?? null })) {
                failAccessLost();
                return null;
            }
            setRefreshFailed(true);
            setRefreshError(result.offline
                ? "You're offline. Your edits are kept."
                : "Couldn't load the latest version. Try again.");
            return null;
        }
        // Rebase against the latest draft and the fixed edited set (R2),
        // never the closure (C1). Refs were assigned synchronously at event
        // time (R4), so keystrokes queued in the same batch are kept.
        const currentDraft = draftRef.current;
        const currentBaseline = baselineRef.current ?? detail;
        const rebased = rebaseEditDraft({
            draft: currentDraft, editedSet: editedSetRef.current, refreshed: result.detail, baseline: currentBaseline,
        });
        baselineRef.current = result.detail;
        draftRef.current = rebased.draft;
        setBaseline(result.detail);
        setDraft(rebased.draft);
        setConflictList(rebased.conflicts);
        setRefreshFailed(false);
        setRefreshError(null);
        return rebased;
    };

    const applyRecovered = (
        kind: 'conflict' | 'no-changes',
        rebased: { alreadySaved: boolean } | null,
    ): boolean => {
        if (!rebased) return false;
        if (rebased.alreadySaved) {
            // R11: never call onSaved after unmount.
            if (mountedRef.current) onSaved('These changes are already saved.');
            return true;
        }
        setNotice(kind === 'no-changes' ? 'no-changes-kept' : 'conflict');
        return false;
    };

    const update = (value: Partial<StoreViewEditDraft>) => {
        // R4: assign the refs synchronously so a recovery landing in the
        // same batch rebases from these keystrokes instead of overwriting
        // them.
        const base = baselineRef.current ?? detail;
        const next = { ...draftRef.current, ...value };
        draftRef.current = next;
        setDraft(next);
        // R2: grow the fixed edited set from the owner's edits only. A field
        // put back to the baseline value leaves the set (unless it is still
        // an unresolved conflict); rebases never change the set.
        const grown = new Set(editedSetRef.current);
        const conflicted = new Set<string>(conflictsRef.current);
        for (const field of Object.keys(value) as StoreViewEditField[]) {
            if ((DAMAGE_GROUP as readonly string[]).includes(field)) {
                const groupDiffers = DAMAGE_GROUP.some((member) => !editFieldEquals(member, base, next));
                const groupConflicted = DAMAGE_GROUP.some((member) => conflicted.has(member as string));
                if (groupDiffers || groupConflicted) {
                    for (const member of DAMAGE_GROUP) grown.add(member);
                } else {
                    for (const member of DAMAGE_GROUP) grown.delete(member);
                }
                continue;
            }
            if (!editFieldEquals(field, base, next) || conflicted.has(field)) grown.add(field);
            else grown.delete(field);
        }
        setEdited(grown);
        setLocalError(null);
    };

    const submit = async () => {
        if (saving || recovering || actionLock.current) return;
        const generation = openingRef.current;
        actionLock.current = true;
        try {
            const currentDraft = draftRef.current;
            const base = baselineRef.current ?? detail;
            const validation = validateStoreViewEditDraft(currentDraft, editedSetRef.current);
            if (validation) return setLocalError(validation);
            const pendingChanges = buildEditedChanges(base, currentDraft, editedSetRef.current);
            if (Object.keys(pendingChanges).length === 0) return setLocalError('There are no changes to save.');
            if (baselineIdentity && editIdentityChanged(baselineIdentity, identity)) {
                failAccessLost();
                return;
            }
            setSaving(true);
            setLocalError(null);
            const outcome = await onSave(pendingChanges, base.versions.inventoryVersion);
            // R11: no post-await callbacks or state sets after unmount.
            if (generation !== openingRef.current || !mountedRef.current || !openRef.current) return;
            if (outcome.ok) {
                setSaving(false);
                onSaved('Changes saved.');
                return;
            }
            if (isEditAccessLost({ code: outcome.code, httpStatus: outcome.httpStatus ?? null })) {
                failAccessLost();
                return;
            }
            if (outcome.code === 'P9_VERSION_CONFLICT') {
                setSaving(false);
                setRecoverKind('conflict');
                setNotice('conflict');
                const rebased = await recover('conflict');
                applyRecovered('conflict', rebased);
                return;
            }
            if (outcome.code === 'P9_NO_CHANGES') {
                setSaving(false);
                setRecoverKind('no-changes');
                const rebased = await recover('no-changes');
                applyRecovered('no-changes', rebased);
                return;
            }
            setSaving(false);
            setLocalError(outcome.message);
        } finally {
            if (generation === openingRef.current) actionLock.current = false;
        }
    };

    const retryRefresh = async () => {
        if (recovering || actionLock.current) return;
        const generation = openingRef.current;
        actionLock.current = true;
        try {
            const kind = recoverKind ?? 'conflict';
            const rebased = await recover(kind);
            applyRecovered(kind, rebased);
        } finally {
            if (generation === openingRef.current) actionLock.current = false;
        }
    };

    const resolve = (field: StoreViewEditField, choice: 'mine' | 'theirs') => {
        const refreshed = baselineRef.current ?? detail;
        if (!refreshed) return;
        // R2: picking "use theirs" drops the field from the fixed edited
        // set; "keep mine" leaves the set unchanged.
        if (choice === 'theirs') {
            const grown = new Set(editedSetRef.current);
            if ((DAMAGE_GROUP as readonly string[]).includes(field)) {
                for (const member of DAMAGE_GROUP) grown.delete(member);
            } else {
                grown.delete(field);
            }
            setEdited(grown);
        }
        const next = resolveEditConflict({ draft: draftRef.current, refreshed, field, choice });
        draftRef.current = next;
        setDraft(next);
        if ((DAMAGE_GROUP as readonly string[]).includes(field)) {
            setConflictList(conflictsRef.current.filter((value) => !(DAMAGE_GROUP as readonly string[]).includes(value)));
            return;
        }
        setConflictList(conflictsRef.current.filter((value) => value !== field));
    };

    const saveDisabled = saving || recovering || submitting || refreshFailed || conflicts.length > 0;
    const shownError = localError ?? error;
    // R5: inputs are non-editable while saving or recovering so edits typed
    // after Save was pressed can't be silently discarded on success.
    const inputsLocked = saving || recovering;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}
            onShow={() => { if (visible && focusPrice) priceRef.current?.focus(); }}>
            <View testID="store-view-edit-sheet" style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
            <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}>
                <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800' }}>Edit book</Text>
                <Text selectable style={{ color: colors.textSecondary }}>Save Changes updates this committed inventory item. Public and Owner-only fields are labeled separately.</Text>
                {notice === 'conflict' ? (
                    <Text testID="store-view-edit-notice" selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>
                        This book changed while you were editing. Your edits are kept — check them and save again.
                    </Text>
                ) : null}
                {notice === 'no-changes-kept' ? (
                    <Text testID="store-view-edit-notice" selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>
                        Nothing was saved. Try again.
                    </Text>
                ) : null}
                {fieldConflicts.map((field) => (
                    <View key={field} style={{ gap: 6 }}>
                        <Text testID={`store-view-edit-conflict-${field}`} selectable style={{ color: colors.error, fontWeight: '700' }}>
                            {`Changed by someone else to ${remoteFieldLabel(field, baseline ?? detail)}`}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable testID={`store-view-edit-keep-mine-${field}`} onPress={() => resolve(field, 'mine')} style={{ flex: 1, minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Keep mine</Text>
                            </Pressable>
                            <Pressable testID={`store-view-edit-use-theirs-${field}`} onPress={() => resolve(field, 'theirs')} style={{ flex: 1, minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Use theirs</Text>
                            </Pressable>
                        </View>
                    </View>
                ))}
                {damageConflict ? (
                    <View style={{ gap: 6 }}>
                        {(conflicts.filter((field) => (DAMAGE_GROUP as readonly string[]).includes(field)) as StoreViewEditField[]).map((field) => (
                            <Text key={field} testID={`store-view-edit-conflict-${field}`} selectable style={{ color: colors.error, fontWeight: '700' }}>
                                {`Changed by someone else to ${remoteFieldLabel(field, baseline ?? detail)}`}
                            </Text>
                        ))}
                        <Text testID="store-view-edit-conflict-damage" selectable style={{ color: colors.error, fontWeight: '700' }}>
                            Damage details were changed by someone else. Choose which version to keep.
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable testID="store-view-edit-keep-mine-damage" onPress={() => resolve('damageNote', 'mine')} style={{ flex: 1, minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Keep mine</Text>
                            </Pressable>
                            <Pressable testID="store-view-edit-use-theirs-damage" onPress={() => resolve('damageNote', 'theirs')} style={{ flex: 1, minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Use theirs</Text>
                            </Pressable>
                        </View>
                    </View>
                ) : null}
                {refreshError ? (
                    <View style={{ gap: 8 }}>
                        <Text testID="store-view-edit-refresh-error" selectable style={{ color: colors.error, fontWeight: '700' }}>{refreshError}</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                             <Pressable testID="store-view-edit-retry-refresh" disabled={recovering} onPress={() => void retryRefresh()} style={{ flex: 1, minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center', opacity: recovering ? 0.5 : 1 }}>
                                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Retry</Text>
                            </Pressable>
                            <Pressable testID="store-view-edit-close" onPress={onDismiss} style={{ flex: 1, minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Close</Text>
                            </Pressable>
                        </View>
                    </View>
                ) : null}
                <Input label="Title" testID="store-view-edit-title" value={draft.title} onChangeText={(title) => update({ title })} editable={!inputsLocked} />
                <Input label="Authors (comma separated)" testID="store-view-edit-authors" value={draft.authors} onChangeText={(authors) => update({ authors })} editable={!inputsLocked} />
                <Input label="Language" testID="store-view-edit-language" value={draft.language} onChangeText={(language) => update({ language })} editable={!inputsLocked} />
                <Input multiline label="Public description" testID="store-view-edit-public-description" value={draft.publicDescription} onChangeText={(publicDescription) => update({ publicDescription })} editable={!inputsLocked} />
                <Input inputRef={priceRef} label="Selling price (₹)" testID="store-view-edit-price-minor" value={draft.sellingPriceMinor} onChangeText={(sellingPriceMinor) => update({ sellingPriceMinor })} editable={!inputsLocked} />
                <View style={{ gap: 8 }}>
                    <Text selectable style={{ color: colors.textSecondary, fontWeight: '700' }}>Condition</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {CONDITIONS.map((condition) => (
                            <Pressable key={condition} testID={`store-view-condition-${condition}`} disabled={inputsLocked} onPress={() => update({ condition })} style={{ borderWidth: 1, borderColor: draft.condition === condition ? colors.accent : colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }}>
                                <Text style={{ color: colors.textPrimary }}>{condition.replaceAll('_', ' ')}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
                <Input multiline label="Public condition note" testID="store-view-edit-public-condition-note" value={draft.publicConditionNote} onChangeText={(publicConditionNote) => update({ publicConditionNote })} editable={!inputsLocked} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Has damage</Text>
                    <Switch testID="store-view-edit-has-damage" disabled={inputsLocked} value={draft.hasDamage} onValueChange={(hasDamage) => update({ hasDamage, ...(hasDamage ? {} : { damageTypes: [], damageNote: '' }) })} />
                </View>
                {draft.hasDamage ? (
                    <View style={{ gap: 10 }}>
                        <Text selectable style={{ color: colors.textSecondary, fontWeight: '700' }}>Damage types</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {DAMAGE_TYPES.map((damageType) => {
                                const selected = draft.damageTypes.includes(damageType);
                                return (
                                    <Pressable key={damageType} testID={`store-view-damage-${damageType}`} disabled={inputsLocked} onPress={() => update({ damageTypes: selected ? draft.damageTypes.filter((value) => value !== damageType) : [...draft.damageTypes, damageType] })} style={{ borderWidth: 1, borderColor: selected ? colors.accent : colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }}>
                                        <Text style={{ color: colors.textPrimary }}>{damageType.replaceAll('_', ' ')}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                        <Input multiline label="Damage note" testID="store-view-edit-damage-note" value={draft.damageNote} onChangeText={(damageNote) => update({ damageNote })} editable={!inputsLocked} />
                    </View>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Sellable</Text>
                    <Switch testID="store-view-edit-sellable" disabled={inputsLocked} value={draft.isSellable} onValueChange={(isSellable) => update({ isSellable })} />
                </View>
                <Input label="Shelf / location" ownerOnly testID="store-view-edit-shelf-location" value={draft.shelfLocation} onChangeText={(shelfLocation) => update({ shelfLocation })} editable={!inputsLocked} />
                <Input multiline label="Internal notes" ownerOnly testID="store-view-edit-internal-notes" value={draft.internalNotes} onChangeText={(internalNotes) => update({ internalNotes })} editable={!inputsLocked} />
                {shownError ? <Text testID="store-view-edit-error" selectable style={{ color: colors.error, fontWeight: '700' }}>{shownError}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable accessibilityRole="button" disabled={submitting} onPress={onDismiss} style={{ flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Cancel</Text></Pressable>
                    <Pressable testID="store-view-save-changes" accessibilityRole="button" accessibilityState={{ disabled: saveDisabled || !hasChanges }} disabled={saveDisabled || !hasChanges} onPress={() => void submit()} style={{ flex: 1, minHeight: 48, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: saveDisabled || !hasChanges ? 0.5 : 1 }}>
                        {saving || recovering ? <ActivityIndicator color="#fff" /> : null}
                        <Text style={{ color: '#fff', fontWeight: '800' }}>{saving ? 'Saving…' : recovering ? 'Refreshing…' : 'Save Changes'}</Text>
                    </Pressable>
                </View>
            </ScrollView>
            </View>
        </Modal>
    );
}
