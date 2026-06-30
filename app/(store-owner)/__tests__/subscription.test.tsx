import { render } from '@testing-library/react-native';
import SubscriptionRoute from '../subscription';
import SubscriptionStatusScreen from '@/features/stores/screens/SubscriptionStatusScreen';

jest.mock('@/features/stores/screens/SubscriptionStatusScreen', () => jest.fn(() => null));

describe('Store Owner subscription route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the Subscription Status screen', () => {
        render(<SubscriptionRoute />);

        expect(SubscriptionStatusScreen).toHaveBeenCalled();
    });
});