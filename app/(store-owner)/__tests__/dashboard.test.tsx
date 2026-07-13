import { render } from '@testing-library/react-native';
import StoreDashboardRoute from '../dashboard';
import StoreDashboardScreen from '@/features/stores/screens/StoreDashboardScreen';

jest.mock('@/features/stores/screens/StoreDashboardScreen', () => jest.fn(() => null));

describe('Store Owner dashboard route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the Store Dashboard screen', () => {
        render(<StoreDashboardRoute />);

        expect(StoreDashboardScreen).toHaveBeenCalled();
    });
});