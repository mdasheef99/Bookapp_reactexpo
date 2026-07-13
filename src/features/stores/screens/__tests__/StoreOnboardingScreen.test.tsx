import { fireEvent, render, waitFor } from '@testing-library/react-native';
import StoreOnboardingScreen from '../StoreOnboardingScreen';
import { storeOwnerService } from '../../services/storeOwnerService';
import { useStoreOwnerGate } from '../../hooks/useStoreOwnerGate';
import { supabase } from '@/lib/supabase';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    launchImageLibraryAsync: jest.fn(() => Promise.resolve({
        canceled: false,
        assets: [{ uri: 'file:///storefront.jpg', fileName: 'storefront.jpg', mimeType: 'image/jpeg' }],
    })),
    MediaTypeOptions: { Images: 'Images' },
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('../../hooks/useStoreOwnerGate', () => ({ useStoreOwnerGate: jest.fn() }));
jest.mock('../../services/storeOwnerService', () => ({
    storeOwnerService: {
        saveApplicationDraft: jest.fn(),
        submitApplication: jest.fn(),
        recordVerificationDocument: jest.fn(),
    },
}));
jest.mock('@/lib/supabase');
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            accent: '#84cc16',
            bgSecondary: '#f8fafc',
            border: '#e5e7eb',
            textPrimary: '#111827',
            textSecondary: '#4b5563',
        },
    }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({ ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const fillRequiredFields = (screen: ReturnType<typeof render>) => {
    fireEvent.changeText(screen.getByLabelText('Owner full name'), 'Reader Owner');
    fireEvent.changeText(screen.getByLabelText('Store display name'), 'Reader Lane Books');
    fireEvent.changeText(screen.getByLabelText('Legal seller name'), 'Reader Lane Books');
    fireEvent.changeText(screen.getByLabelText('City'), 'Bengaluru');
    fireEvent.changeText(screen.getByLabelText('State'), 'Karnataka');
    fireEvent.changeText(screen.getByLabelText('Pincode'), '560001');
};

describe('StoreOnboardingScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useStoreOwnerGate as jest.Mock).mockReturnValue({
            data: { state: 'application_draft', storeId: 'store-1', requestId: 'request-1' },
            isLoading: false,
        });
        (storeOwnerService.saveApplicationDraft as jest.Mock).mockResolvedValue(undefined);
        (storeOwnerService.submitApplication as jest.Mock).mockResolvedValue(undefined);
        (storeOwnerService.recordVerificationDocument as jest.Mock).mockResolvedValue(undefined);
        (global as any).fetch = jest.fn(() => Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(new Blob(['image'], { type: 'image/jpeg' })),
        }));
    });

    it('keeps submit disabled until required policies are accepted', () => {
        const screen = render(<StoreOnboardingScreen />);
        fillRequiredFields(screen);

        expect(screen.getByLabelText('Submit store application').props.accessibilityState.disabled).toBe(true);

        fireEvent.press(screen.getByLabelText('Accept seller agreement'));
        fireEvent.press(screen.getByLabelText('Accept prohibited items policy'));
        fireEvent.press(screen.getByLabelText('Accept support policy'));

        expect(screen.getByLabelText('Submit store application').props.accessibilityState.disabled).toBe(false);
    });

    it('uploads seller documents to the private bucket and records scoped metadata without public URL', async () => {
        const storageClient = supabase.storage.from('seller-verification-docs');
        const getPublicUrl = jest.fn();
        (storageClient.getPublicUrl as jest.Mock | undefined)?.mockImplementation(getPublicUrl);

        const screen = render(<StoreOnboardingScreen />);
        fireEvent.press(screen.getByLabelText('Upload storefront document'));

        await waitFor(() => expect(supabase.storage.from).toHaveBeenCalledWith('seller-verification-docs'));
        const uploadCall = (storageClient.upload as jest.Mock).mock.calls[0];
        expect(uploadCall[0]).toMatch(/^store-1\/request-1\/storefront_photo\/\d+-storefront\.jpg$/);
        expect(storeOwnerService.recordVerificationDocument).toHaveBeenCalledWith(expect.objectContaining({
            storeId: 'store-1',
            requestId: 'request-1',
            documentType: 'storefront_photo',
            storagePath: expect.stringMatching(/^store-1\//),
            maskedLabel: 'storefront.jpg',
        }));
        expect(getPublicUrl).not.toHaveBeenCalled();
    });
});
