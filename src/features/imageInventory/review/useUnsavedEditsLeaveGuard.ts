import { useEffect, useRef, useState } from 'react';
import { useNavigation } from 'expo-router';

type LeaveGuardCopy = Readonly<{
  title: string; description: string; discardLabel: string; busyTitle: string; busyDescription: string;
}>;

// SDD-1 §4 / D09: shared navigation guard, with caller-owned dirty/busy state and copy.
// Returns dialog state for OwnerConfirmationDialog (works on web, where Alert is a no-op).
export function useUnsavedEditsLeaveGuard(dirty: boolean, busy: boolean, copy: LeaveGuardCopy) {
  const navigation = useNavigation();
  const discarding = useRef(false);
  const [pendingAction, setPendingAction] = useState<any>(null);
  useEffect(() => {
    if (!dirty && !busy) {
      discarding.current = false;
      setPendingAction(null);
    }
  }, [dirty, busy]);
  useEffect(() => navigation.addListener('beforeRemove', (event: any) => {
    if (discarding.current || (!dirty && !busy)) return;
    event.preventDefault();
    setPendingAction(event.data.action);
  }), [dirty, busy, navigation]);
  return {
    visible: pendingAction !== null,
    title: busy ? copy.busyTitle : copy.title,
    description: busy ? copy.busyDescription : copy.description,
    cancelLabel: 'Stay',
    confirmLabel: copy.discardLabel,
    onCancel: () => setPendingAction(null),
    onConfirm: busy ? undefined : () => {
      const action = pendingAction;
      if (!action) return;
      discarding.current = true;
      setPendingAction(null);
      navigation.dispatch?.(action);
    },
  };
}
