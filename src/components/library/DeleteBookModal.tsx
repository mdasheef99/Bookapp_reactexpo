import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryAppearance } from './LibraryAppearance';

interface DeleteBookModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}

export const DeleteBookModal = ({ visible, onClose, onConfirm, isDeleting }: DeleteBookModalProps) => {
    const colors = useLibraryAppearance();

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
                <BlurView intensity={20} style={StyleSheet.absoluteFill} />
                <View style={[styles.modal, { backgroundColor: colors.bgRaised, shadowColor: colors.shadow }]}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.errorSurface }]}>
                        <Ionicons name="trash-outline" size={40} color={colors.error} />
                    </View>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Remove from Library?</Text>
                    <Text style={[styles.message, { color: colors.textSecondary }]}>
                        This book will be removed from your collection. This action cannot be undone.
                    </Text>

                    <View style={styles.buttons}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton, { backgroundColor: colors.bgSecondary, borderColor: colors.controlBorder }]}
                            onPress={onClose}
                            disabled={isDeleting}
                        >
                            <Text style={[styles.buttonText, { color: colors.textPrimary }]}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.deleteButton, { backgroundColor: colors.error }]}
                            onPress={onConfirm}
                            disabled={isDeleting}
                        >
                            <Text style={[styles.buttonText, { color: colors.onErrorSurface }]}>
                                {isDeleting ? 'Removing...' : 'Remove'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modal: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    message: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    buttons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
    },
    cancelButton: {
        paddingVertical: 13,
        borderWidth: 1,
        // backgroundColor and borderColor set in component
    },
    deleteButton: {
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
