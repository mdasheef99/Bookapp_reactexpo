import React from 'react';
import { render } from '@testing-library/react-native';
import ProfileLayout from '../_layout';

const stackScreens: Array<{ name: string }> = [];

jest.mock('expo-router', () => {
    const Stack = ({ children }: { children: React.ReactNode }) => <>{children}</>;
    Stack.Screen = (props: { name: string }) => {
        stackScreens.push(props);
        return null;
    };

    return { Stack };
});

describe('ProfileLayout', () => {
    beforeEach(() => {
        stackScreens.length = 0;
    });

    it('registers profile-linked hidden routes in the profile stack', () => {
        render(<ProfileLayout />);

        expect(stackScreens.map(screen => screen.name)).toEqual([
            'index',
            'settings',
            'edit',
            'credit-history',
            'addresses',
            'notifications',
            'notification-settings',
        ]);
    });
});
