import React from 'react';
import { render } from '@testing-library/react-native';
import TabsLayout from '../_layout';

const tabScreens: Array<{ name: string; options?: { href?: string | null; title?: string } }> = [];

jest.mock('expo-router', () => {
    const Tabs = ({ children }: { children: React.ReactNode }) => <>{children}</>;
    Tabs.Screen = (props: { name: string; options?: { href?: string | null; title?: string } }) => {
        tabScreens.push(props);
        return null;
    };

    return { Tabs };
});

describe('TabsLayout', () => {
    beforeEach(() => {
        tabScreens.length = 0;
    });

    it('registers primary tabs, omits legacy shims, and hides detail routes', () => {
        render(<TabsLayout />);

        expect(tabScreens.map(screen => screen.name)).toEqual([
            'library',
            'exchange',
            'marketplace/index',
            'clubs',
            'profile',
            'marketplace/store/[storeId]',
        ]);
        expect(tabScreens.find(screen => screen.name === 'credit-history')).toBeUndefined();
        expect(tabScreens.find(screen => screen.name === 'addresses')).toBeUndefined();
        expect(tabScreens.find(screen => screen.name === 'marketplace/store/[storeId]')?.options?.href).toBeNull();
    });
});
