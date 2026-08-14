import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { PublicCopyMediaManager } from '../components/PublicCopyMediaManager';
import { publicationService } from '../api/publicationService';

jest.mock('expo-image-picker', () => ({
    getMediaLibraryPermissionsAsync: jest.fn(),
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: jest.fn(async () => 'a'.repeat(64)),
    randomUUID: jest.fn(() => '10000000-0000-4000-8000-000000000099'),
}));
jest.mock('../api/publicationService', () => ({
    publicationService: {
        preparePublicCopyUpload: jest.fn(),
        readPublicCopyStatus: jest.fn(),
        submitPublicCopyMedia: jest.fn(),
    },
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: {
    accent: '#2563eb', border: '#d1d5db', textPrimary: '#111827', textSecondary: '#4b5563',
} }) }));

const inventoryId = '10000000-0000-4000-8000-000000000001';
const sourceMediaAssetId = '10000000-0000-4000-8000-000000000002';
const derivativeMediaAssetId = '10000000-0000-4000-8000-000000000003';
const capabilityId = '10000000-0000-4000-8000-000000000004';

describe('Unit 7B public-copy media manager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (ImagePicker.getMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
            granted: true, canAskAgain: true,
        });
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
            canceled: false,
            assets: [{ uri: 'file:///owner-copy.png', mimeType: 'image/png', fileSize: 128,
                width: 10, height: 10 }],
        });
        (publicationService.preparePublicCopyUpload as jest.Mock).mockResolvedValue({
            capabilityId,
            expiresAt: '2026-08-12T12:15:00.000Z',
            upload: jest.fn(() => ({ promise: Promise.resolve(), cancel: jest.fn() })),
            complete: jest.fn(async () => ({ mediaAssetId: sourceMediaAssetId, state: 'processing' })),
        });
        (publicationService.readPublicCopyStatus as jest.Mock)
            .mockResolvedValueOnce({ mediaAssetId: sourceMediaAssetId, state: 'processing' })
            .mockResolvedValueOnce({ mediaAssetId: derivativeMediaAssetId, state: 'approved' });
        (publicationService.submitPublicCopyMedia as jest.Mock).mockResolvedValue({
            mediaLinkId: '10000000-0000-4000-8000-000000000005',
        });
    });

    it('U7B-RT17 uploads exact declared media then polls and links only the approved sanitized derivative', async () => {
        const screen = render(<PublicCopyMediaManager inventoryId={inventoryId} onDone={jest.fn()} />);
        fireEvent.press(screen.getByTestId('public-media-role-damage'));
        fireEvent.press(screen.getByTestId('public-media-order-2'));
        fireEvent.press(screen.getByTestId('choose-public-copy-photo'));
        await waitFor(() => expect(screen.getByTestId('check-public-copy-status')).toBeTruthy());
        expect(publicationService.preparePublicCopyUpload).toHaveBeenCalledWith(expect.objectContaining({
            inventoryId, role: 'damage', ordinal: 2,
            media: expect.objectContaining({ mimeType: 'image/png', fileSize: 128 }),
            envelopeSha256: 'a'.repeat(64),
        }));
        expect(publicationService.submitPublicCopyMedia).not.toHaveBeenCalled();

        fireEvent.press(screen.getByTestId('check-public-copy-status'));
        await waitFor(() => expect(publicationService.submitPublicCopyMedia).toHaveBeenCalledWith(
            expect.objectContaining({
                inventoryId, capabilityId, mediaAssetId: derivativeMediaAssetId,
                role: 'damage', publicOrder: 2,
            }),
        ));
        expect(screen.getByText('Approved sanitized public-copy photo linked.')).toBeTruthy();
        expect(screen.queryByTestId('check-public-copy-status')).toBeNull();
    });
});
