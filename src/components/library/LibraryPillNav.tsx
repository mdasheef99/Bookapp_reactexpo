import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type PillItem = 'shelf' | 'search' | 'notes' | 'wishlist' | 'profile';

type Props = {
    active: PillItem;
    onChange?: (item: PillItem) => void;
};

export function LibraryPillNav({ active, onChange }: Props) {
    const Item = ({ id, icon, label }: { id: PillItem; icon: any; label?: string }) => {
        const isActive = active === id;
        return (
            <TouchableOpacity
                onPress={() => onChange?.(id)}
                style={[styles.item, isActive && styles.itemActive]}
                activeOpacity={0.9}
            >
                <Ionicons name={icon} size={20} color={isActive ? '#e78e56' : 'rgba(176,161,148,0.70)'} />
                {label ? <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text> : null}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.wrap} pointerEvents="box-none">
            <View style={styles.bar}>
                <Item id="shelf" icon="library" label="Shelf" />
                <Item id="search" icon="search-outline" />
                <Item id="notes" icon="create-outline" />
                <Item id="wishlist" icon="bookmark-outline" />
                <Item id="profile" icon="person-outline" />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        bottom: 24,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 50,
    },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        height: 64,
        maxWidth: 380,
        width: '90%',
        backgroundColor: '#42382e',
        borderRadius: 999,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
    },
    itemActive: {
        backgroundColor: 'rgba(248,229,210,0.20)',
        borderWidth: 1,
        borderColor: 'rgba(255,182,140,0.30)',
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.6,
        color: 'rgba(176,161,148,0.70)',
    },
    labelActive: {
        color: '#e78e56',
    },
});
