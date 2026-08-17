import { render } from '@testing-library/react-native';
import StoreProfileRoute from '../store-profile';
import StoreProfileScreen from '@/features/stores/screens/StoreProfileScreen';

jest.mock('@/features/stores/screens/StoreProfileScreen', () => jest.fn(() => null));

describe('Store Owner Store Profile route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('preserves the existing Store Profile settings surface', () => {
        render(<StoreProfileRoute />);

        expect(StoreProfileScreen).toHaveBeenCalled();
    });
});
