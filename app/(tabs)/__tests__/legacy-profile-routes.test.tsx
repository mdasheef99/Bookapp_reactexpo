import React from 'react';
import { render } from '@testing-library/react-native';
import LegacyAddressesRoute from '../addresses';
import LegacyCreditHistoryRoute from '../credit-history';

const redirects: string[] = [];

jest.mock('expo-router', () => ({
    Redirect: ({ href }: { href: string }) => {
        redirects.push(href);
        return null;
    },
}));

describe('legacy profile-linked routes', () => {
    beforeEach(() => {
        redirects.length = 0;
    });

    it('redirects the old addresses path to the profile-scoped route', () => {
        render(<LegacyAddressesRoute />);

        expect(redirects).toEqual(['/(tabs)/profile/addresses']);
    });

    it('redirects the old credit history path to the profile-scoped route', () => {
        render(<LegacyCreditHistoryRoute />);

        expect(redirects).toEqual(['/(tabs)/profile/credit-history']);
    });
});
