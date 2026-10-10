import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useFonts } from 'expo-font';
import { ClubsFontProvider } from '../Fonts';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));

describe('ClubsFontProvider', () => {
    it('shows an accessible loading indicator while fonts are pending', () => {
        (useFonts as jest.Mock).mockReturnValue([false, null]);
        const { getByLabelText, queryByText } = render(<ClubsFontProvider><Text>Clubs content</Text></ClubsFontProvider>);
        expect(getByLabelText('Loading Clubs')).toBeOnTheScreen();
        expect(queryByText('Clubs content')).toBeNull();
    });

    it.each([[true, null], [false, new Error('Font download timed out')]])(
        'renders Clubs when loading has settled (loaded=%s, error=%s)', (loaded, error) => {
            (useFonts as jest.Mock).mockReturnValue([loaded, error]);
            const { getByText, queryByLabelText } = render(<ClubsFontProvider><Text>Clubs content</Text></ClubsFontProvider>);
            expect(getByText('Clubs content')).toBeOnTheScreen();
            expect(queryByLabelText('Loading Clubs')).toBeNull();
        },
    );
});
