import { render } from '@testing-library/react-native';
import StoreOwnerIndex from '../index';
import StoreOwnerGateScreen from '@/features/stores/screens/StoreOwnerGateScreen';

jest.mock('@/features/stores/screens/StoreOwnerGateScreen', () => jest.fn(() => null));

describe('StoreOwner index route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the Store Owner gate screen', () => {
        render(<StoreOwnerIndex />);

        expect(StoreOwnerGateScreen).toHaveBeenCalled();
    });
});
