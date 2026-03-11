/**
 * Mock for expo-haptics
 *
 * Used in: SearchBar, SwipeableBookCard, useRecentSearches, FilterModal, search.tsx
 * APIs used: Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
 */

export const ImpactFeedbackStyle = {
  Light: 'light' as const,
  Medium: 'medium' as const,
  Heavy: 'heavy' as const,
};

export const NotificationFeedbackType = {
  Success: 'success' as const,
  Warning: 'warning' as const,
  Error: 'error' as const,
};

export const impactAsync = jest.fn();
export const notificationAsync = jest.fn();
export const selectionAsync = jest.fn();

