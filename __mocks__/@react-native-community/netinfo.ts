/**
 * Mock for @react-native-community/netinfo
 *
 * Used in: src/hooks/useNetworkStatus.ts (dynamic import on native platform)
 * APIs: NetInfo.addEventListener, NetInfo.fetch
 */

const defaultState = {
  type: 'wifi',
  isConnected: true,
  isInternetReachable: true,
  details: {
    isConnectionExpensive: false,
  },
};

const NetInfo = {
  addEventListener: jest.fn((_callback: (state: any) => void) => {
    // Return unsubscribe function
    return jest.fn();
  }),
  fetch: jest.fn(() => Promise.resolve(defaultState)),
  refresh: jest.fn(() => Promise.resolve(defaultState)),
  configure: jest.fn(),
};

export default NetInfo;

