import { render } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import StorefrontRoute from '../storefront';

jest.mock('expo-router', () => ({
    Redirect: jest.fn((_props: { href: string }) => null),
}));

describe('Store Owner storefront route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('redirects legacy storefront links to the secondary Store Profile route', () => {
        render(<StorefrontRoute />);

        expect(Redirect).toHaveBeenCalled();
        expect((Redirect as jest.Mock).mock.calls[0][0]).toEqual({ href: '/(store-owner)/store-profile' });
    });
});
