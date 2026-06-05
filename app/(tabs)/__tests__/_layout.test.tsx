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

    it('registers primary tab sections and hides legacy profile route shims', () => {
        render(<TabsLayout />);

        expect(tabScreens.map(screen => screen.name)).toEqual([
            'library',
            'exchange',
            'clubs',
            'profile',
            'credit-history',
            'addresses',
        ]);
        expect(tabScreens.find(screen => screen.name === 'credit-history')?.options?.href).toBeNull();
        expect(tabScreens.find(screen => screen.name === 'addresses')?.options?.href).toBeNull();
    });
});
