import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from 'expo-router';

export function useCandidateLeaveGuard(dirty: boolean, saving: boolean) {
  const navigation = useNavigation();
  useEffect(() => navigation.addListener('beforeRemove', (event: any) => {
    if (!dirty) return;
    event.preventDefault();
    if (saving) {
      Alert.alert('Save in progress', 'Wait for the review save to finish before leaving.', [{ text: 'Stay', style: 'cancel' }]);
      return;
    }
    Alert.alert('Leave without saving?', 'Your unsaved review edits exist only on this screen.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave unsaved', style: 'destructive', onPress: () => navigation.dispatch?.(event.data.action) },
    ]);
  }), [dirty, saving, navigation]);
}