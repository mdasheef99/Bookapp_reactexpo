import { render } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import PreviewRoute from '../../../../app/(store-owner)/inventory/scan/preview';
import SessionRoute from '../../../../app/(store-owner)/inventory/scan/[sessionId]';
import CandidateRoute from '../../../../app/(store-owner)/inventory/scan/[sessionId]/candidate/[candidateId]';
import MissedRoute from '../../../../app/(store-owner)/inventory/scan/[sessionId]/missed';
import SummaryRoute from '../../../../app/(store-owner)/inventory/scan/[sessionId]/summary';
import {
    InvalidInventoryRouteScreen,
    InventoryCandidateFoundationScreen,
    InventoryMissedFoundationScreen,
    InventoryPreviewFoundationScreen,
    InventorySessionFoundationScreen,
    InventorySummaryFoundationScreen,
} from '../screens/InventoryFoundationScreens';

jest.mock('expo-router', () => ({
    useLocalSearchParams: jest.fn(),
}));
jest.mock('../screens/InventoryFoundationScreens', () => ({
    InvalidInventoryRouteScreen: jest.fn(() => null),
    InventoryCandidateFoundationScreen: jest.fn(() => null),
    InventoryMissedFoundationScreen: jest.fn(() => null),
    InventoryPreviewFoundationScreen: jest.fn(() => null),
    InventorySessionFoundationScreen: jest.fn(() => null),
    InventorySummaryFoundationScreen: jest.fn(() => null),
}));

const params = useLocalSearchParams as jest.Mock;
const sessionId = '00000000-0000-4000-8000-000000000001';
const candidateId = '00000000-0000-4000-8000-000000000002';

const routes = [
    ['preview', PreviewRoute, InventoryPreviewFoundationScreen, { sessionId }],
    ['session', SessionRoute, InventorySessionFoundationScreen, { sessionId }],
    ['missed', MissedRoute, InventoryMissedFoundationScreen, { sessionId }],
    ['summary', SummaryRoute, InventorySummaryFoundationScreen, { sessionId }],
    [
        'candidate',
        CandidateRoute,
        InventoryCandidateFoundationScreen,
        { sessionId, candidateId },
    ],
] as const;

describe('Phase 9 Unit 6B dynamic route guard entry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it.each(routes)('%s route enters its guarded foundation with valid opaque IDs', (
        _name,
        Route,
        Foundation,
        validParams,
    ) => {
        params.mockReturnValue(validParams);
        render(<Route />);
        expect(Foundation).toHaveBeenCalled();
        expect(InvalidInventoryRouteScreen).not.toHaveBeenCalled();
    });

    it.each(routes)('%s route enters the guarded invalid foundation for missing parameters', (
        _name,
        Route,
    ) => {
        params.mockReturnValue({});
        render(<Route />);
        expect(InvalidInventoryRouteScreen).toHaveBeenCalled();
    });

    it.each(routes)('%s route enters the guarded invalid foundation for malformed parameters', (
        _name,
        Route,
        _Foundation,
        validParams,
    ) => {
        params.mockReturnValue({ ...validParams, sessionId: 'not-a-uuid' });
        render(<Route />);
        expect(InvalidInventoryRouteScreen).toHaveBeenCalled();
    });

    it.each(routes)('%s route enters the guarded invalid foundation for repeated parameters', (
        _name,
        Route,
        _Foundation,
        validParams,
    ) => {
        params.mockReturnValue({ ...validParams, sessionId: [sessionId] });
        render(<Route />);
        expect(InvalidInventoryRouteScreen).toHaveBeenCalled();
    });
});
