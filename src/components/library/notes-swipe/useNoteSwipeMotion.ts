import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const noteSwipeHintKey = (actorId: string) => `library_noteSwipeHint:v1:${actorId}`;
export function useReducedNoteMotion() {
  // Start conservatively while the async platform setting is unknown.
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let live = true;
    void Promise.resolve(AccessibilityInfo.isReduceMotionEnabled()).then(value => { if (live) setReduced(!!value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { live = false; subscription?.remove?.(); };
  }, []);
  return reduced;
}
export function useNoteSwipeHint(actorId: string, ready: boolean) {
  const [hintFor, setHintFor] = useState('');
  useEffect(() => {
    if (!actorId || !ready) return;
    let live = true;
    void AsyncStorage.getItem(noteSwipeHintKey(actorId)).then(value => {
      if (!live || value === '1') return;
      setHintFor(actorId);
      void AsyncStorage.setItem(noteSwipeHintKey(actorId), '1').catch(() => {});
    }).catch(() => {});
    return () => { live = false; };
  }, [actorId, ready]);
  return !!actorId && hintFor === actorId;
}
