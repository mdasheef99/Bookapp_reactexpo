import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import {
    InventoryCapturePreviewScreen,
    InventoryCaptureSetupScreen,
} from '../screens/CaptureScreens';
import { CaptureClientError, captureService } from '../api/captureService';
import { cancelAllCaptureWork } from '../capture/captureCancellation';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockWorkflow = { selected: null as any, select: jest.fn(), clear: jest.fn() };
const mockIdentity = { userId: 'owner-1', storeId: 'store-1' };
let mockCurrentIdentity = mockIdentity;
const mockQueryClient = { invalidateQueries: jest.fn(() => Promise.resolve()) };

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockQueryClient }));
jest.mock('expo-image-picker', () => ({
    getCameraPermissionsAsync: jest.fn(),
    requestCameraPermissionsAsync: jest.fn(),
    getMediaLibraryPermissionsAsync: jest.fn(),
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchCameraAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        textPrimary: '#111', textSecondary: '#333', error: '#900', border: '#ccc',
    } }),
}));
jest.mock('@/hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => ({ isOffline: false, isConnected: true }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: any) => children,
}));
jest.mock('@/components/ui/GlassCard', () => ({
    GlassCard: ({ children }: any) => children,
}));
jest.mock('../screens/InventoryAccessBoundary', () => ({
    InventoryAccessBoundary: ({ children }: any) => children(mockIdentity),
}));
jest.mock('../capture/CaptureWorkflowContext', () => ({
    useCaptureWorkflow: () => mockWorkflow,
}));
jest.mock('../api/captureService', () => ({
    CaptureClientError: class CaptureClientError extends Error {
        code: string;
        retryable: boolean;
        constructor(...mockArgs: [string, boolean, string]) {
            super(mockArgs[2]);
            this.code = mockArgs[0];
            this.retryable = mockArgs[1];
        }
    },
    captureService: {
        startSession: jest.fn(),
        prepareUpload: jest.fn(),
    },
}));
jest.mock('../queries/ownerUxQueries', () => ({
    getResolvedImageInventoryIdentity: () => mockCurrentIdentity,
    imageInventoryKeys: {
        discovery: jest.fn(() => ['discovery']),
        session: jest.fn(() => ['session']),
        inputs: jest.fn(() => ['inputs']),
    },
    useOwnerInventoryDiscovery: jest.fn(() => ({
        data: { activeSession: null },
        isLoading: false,
        error: null,
        isFetchedAfterMount: true,
        refetch: jest.fn().mockResolvedValue({ data: { activeSession: null }, isError: false, error: null }),
    })),
    useOwnerInventoryInputs: jest.fn(() => ({
        data: { items: [] }, isLoading: false, error: null, isFetchedAfterMount: true,
        refetch: jest.fn().mockResolvedValue({ data: { items: [] }, isError: false, error: null }),
    })),
    useOwnerInventorySession: jest.fn(() => ({
        data: { status: 'active' }, error: null, refetch: jest.fn(),
    })),
}));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const randomUUID = Crypto.randomUUID as jest.MockedFunction<typeof Crypto.randomUUID>;
jest.setTimeout(60_000);

describe('Phase 9 Unit 6C capture routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQueryClient.invalidateQueries.mockReset().mockResolvedValue(undefined);
        let uuidCounter = 0;
        randomUUID.mockImplementation(() => (
            `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`
        ));
        mockWorkflow.selected = null;
        mockCurrentIdentity = mockIdentity;
        picker.getCameraPermissionsAsync.mockResolvedValue({
            granted: true, canAskAgain: true, status: 'granted', expires: 'never',
        } as never);
    });

    it('keeps the setup attempt identity stable across rerenders', () => {
        const screen = render(<InventoryCaptureSetupScreen />);
        const initialUuidCalls = randomUUID.mock.calls.length;

        screen.rerender(<InventoryCaptureSetupScreen />);

        expect(randomUUID).toHaveBeenCalledTimes(initialUuidCalls);
    });

    it('keeps upload attempt identities stable across rerenders', () => {
        mockWorkflow.selected = {
            uri: 'file:///private/scan.jpg',
            mimeType: 'image/jpeg',
            fileSize: 1024,
            width: 100,
            height: 200,
            source: 'camera',
        };
        const screen = render(<InventoryCapturePreviewScreen sessionId="session-1" />);
        const initialUuidCalls = randomUUID.mock.calls.length;

        screen.rerender(<InventoryCapturePreviewScreen sessionId="session-1" />);

        expect(randomUUID).toHaveBeenCalledTimes(initialUuidCalls);
    });

    it('treats picker cancellation as normal and creates no session', async () => {
        picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
        const screen = render(<InventoryCaptureSetupScreen />);
        fireEvent.press(screen.getByTestId('capture-start'));
        fireEvent.press(screen.getByTestId('capture-camera'));
        await waitFor(() => expect(picker.launchCameraAsync).toHaveBeenCalledTimes(1));
        expect(captureService.startSession).not.toHaveBeenCalled();
        expect(mockWorkflow.select).not.toHaveBeenCalled();
    });

    it('shows settings guidance after permanent camera denial', async () => {
        picker.getCameraPermissionsAsync.mockResolvedValue({
            granted: false, canAskAgain: false, status: 'denied', expires: 'never',
        } as never);
        const screen = render(<InventoryCaptureSetupScreen />);
        fireEvent.press(screen.getByTestId('capture-start'));
        fireEvent.press(screen.getByTestId('capture-camera'));
        expect(await screen.findByText(/device settings/u)).toBeTruthy();
        expect(picker.launchCameraAsync).not.toHaveBeenCalled();
        expect(captureService.startSession).not.toHaveBeenCalled();
    });

    it('locks repeated source taps and starts only after valid selection', async () => {
        let resolvePicker!: (value: any) => void;
        picker.launchCameraAsync.mockReturnValue(new Promise((resolve) => { resolvePicker = resolve; }));
        (captureService.startSession as jest.Mock).mockResolvedValue('00000000-0000-4000-8000-000000000001');
        const screen = render(<InventoryCaptureSetupScreen />);
        fireEvent.press(screen.getByTestId('capture-start'));
        fireEvent.press(screen.getByTestId('capture-camera'));
        fireEvent.press(screen.getByTestId('capture-camera'));
        await waitFor(() => expect(picker.launchCameraAsync).toHaveBeenCalledTimes(1));
        resolvePicker({
            canceled: false,
            assets: [{
                uri: 'file:///private/scan.jpg',
                mimeType: 'image/jpeg',
                fileSize: 1024,
                width: 100,
                height: 200,
            }],
        });
        await waitFor(() => expect(captureService.startSession).toHaveBeenCalledTimes(1));
        expect(mockWorkflow.select).toHaveBeenCalledWith(expect.objectContaining({ source: 'camera' }));
        expect(mockRouter.push).toHaveBeenCalled();
    });

    it('drops a delayed picker completion before any mutation after identity replacement', async () => {
        let resolvePicker!: (value: any) => void;
        picker.launchCameraAsync.mockReturnValue(new Promise((resolve) => { resolvePicker = resolve; }));
        const screen = render(<InventoryCaptureSetupScreen />);
        fireEvent.press(screen.getByTestId('capture-start'));
        fireEvent.press(screen.getByTestId('capture-camera'));
        await waitFor(() => expect(picker.launchCameraAsync).toHaveBeenCalled());
        mockCurrentIdentity = { userId: 'owner-2', storeId: 'store-2' };
        resolvePicker({
            canceled: false,
            assets: [{
                uri: 'file:///private/scan.jpg',
                mimeType: 'image/jpeg',
                fileSize: 1024,
                width: 100,
                height: 200,
            }],
        });
        await waitFor(() => expect(screen.getByTestId('capture-camera')).toBeEnabled());
        expect(captureService.startSession).not.toHaveBeenCalled();
        expect(mockWorkflow.select).not.toHaveBeenCalled();
    });

    it('uploads, registers, clears local media, and routes to server progress', async () => {
        const handoffEvents: string[] = [];
        mockWorkflow.clear.mockImplementation(() => handoffEvents.push('clear'));
        mockRouter.replace.mockImplementation(() => handoffEvents.push('replace'));
        mockWorkflow.selected = {
            uri: 'file:///private/scan.jpg',
            mimeType: 'image/jpeg',
            fileSize: 1024,
            width: 100,
            height: 200,
            source: 'camera',
        };
        (captureService.prepareUpload as jest.Mock).mockResolvedValue({
            expiresAt: '2099-01-01T00:00:00.000Z',
            upload: (progress: (value: number) => void) => {
                progress(25);
                progress(100);
                return { promise: Promise.resolve(), cancel: jest.fn() };
            },
            register: jest.fn().mockResolvedValue({
                inputId: '00000000-0000-4000-8000-000000000004',
                state: 'uploaded',
            }),
        });
        const screen = render(
            <InventoryCapturePreviewScreen sessionId="00000000-0000-4000-8000-000000000001" />,
        );
        fireEvent.press(screen.getByText('Upload image'));
        await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
        expect(mockWorkflow.clear).not.toHaveBeenCalled();
        expect(handoffEvents).toEqual(['replace']);
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(3);
        screen.unmount();
        expect(mockWorkflow.clear).toHaveBeenCalledTimes(1);
        expect(handoffEvents).toEqual(['replace', 'clear']);
    });

    it('does not navigate or clear after Preview unmounts during post-registration refresh', async () => {
        const pendingInvalidations: Array<() => void> = [];
        mockQueryClient.invalidateQueries.mockImplementation(() => new Promise<void>((resolve) => {
            pendingInvalidations.push(resolve);
        }));
        mockWorkflow.selected = {
            uri: 'file:///private/scan.jpg', mimeType: 'image/jpeg', fileSize: 1024,
            width: 100, height: 200, source: 'camera',
        };
        const register = jest.fn().mockResolvedValue({
            inputId: '00000000-0000-4000-8000-000000000004', state: 'uploaded',
        });
        (captureService.prepareUpload as jest.Mock).mockResolvedValue({
            expiresAt: '2099-01-01T00:00:00.000Z',
            upload: () => ({ promise: Promise.resolve(), cancel: jest.fn() }),
            register,
        });
        const screen = render(
            <InventoryCapturePreviewScreen sessionId="00000000-0000-4000-8000-000000000001" />,
        );
        fireEvent.press(screen.getByText('Upload image'));
        await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
        expect(pendingInvalidations).toHaveLength(3);

        screen.unmount();
        pendingInvalidations.forEach((resolve) => resolve());
        await act(async () => { await Promise.resolve(); });

        expect(mockRouter.replace).not.toHaveBeenCalled();
        expect(mockWorkflow.clear).not.toHaveBeenCalled();
    });

    it('preserves selected media across a transient Preview unmount', () => {
        mockWorkflow.selected = {
            uri: 'file:///private/scan-3.jpg', mimeType: 'image/jpeg', fileSize: 1024,
            width: 100, height: 200, source: 'camera',
        };
        const screen = render(
            <InventoryCapturePreviewScreen sessionId="00000000-0000-4000-8000-000000000001" />,
        );
        screen.unmount();
        expect(mockWorkflow.clear).not.toHaveBeenCalled();
    });

    it('clears selected media only when the Owner chooses another image', () => {
        mockWorkflow.selected = {
            uri: 'file:///private/scan-3.jpg', mimeType: 'image/jpeg', fileSize: 1024,
            width: 100, height: 200, source: 'camera',
        };
        const screen = render(
            <InventoryCapturePreviewScreen sessionId="00000000-0000-4000-8000-000000000001" />,
        );

        fireEvent.press(screen.getByText('Choose another image'));

        expect(mockWorkflow.clear).toHaveBeenCalledTimes(1);
        expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });

    it('keeps unavailable-media recovery routed back to scan setup', () => {
        const screen = render(
            <InventoryCapturePreviewScreen sessionId="00000000-0000-4000-8000-000000000001" />,
        );

        expect(screen.getByText('That upload was not registered. Select the image again.'))
            .toBeTruthy();
        fireEvent.press(screen.getByText('Choose image'));

        expect(mockRouter.replace).toHaveBeenCalled();
    });

    it('uses a new registration key after object-change reauthorization', async () => {
        mockWorkflow.selected = {
            uri: 'file:///private/scan.jpg', mimeType: 'image/jpeg', fileSize: 1024,
            width: 100, height: 200, source: 'camera',
        };
        const firstRegister = jest.fn().mockRejectedValue(
            new CaptureClientError('P9_MEDIA_OBJECT_CHANGED', true, 'changed'),
        );
        const secondRegister = jest.fn().mockResolvedValue({
            inputId: '00000000-0000-4000-8000-000000000004', state: 'uploaded',
        });
        const prepared = (register: jest.Mock) => ({
            expiresAt: '2099-01-01T00:00:00.000Z',
            upload: () => ({ promise: Promise.resolve(), cancel: jest.fn() }),
            register,
        });
        (captureService.prepareUpload as jest.Mock)
            .mockResolvedValueOnce(prepared(firstRegister))
            .mockResolvedValueOnce(prepared(secondRegister));
        const screen = render(
            <InventoryCapturePreviewScreen sessionId="00000000-0000-4000-8000-000000000001" />,
        );
        fireEvent.press(screen.getByText('Upload image'));
        fireEvent.press(await screen.findByText('Retry upload'));
        await waitFor(() => expect(secondRegister).toHaveBeenCalled());
        expect(firstRegister.mock.calls[0][0]).not.toBe(secondRegister.mock.calls[0][0]);
        expect(captureService.prepareUpload).toHaveBeenCalledTimes(2);
    });

    it('reuses the same registration key for an uncertain replay of one capability', async () => {
        mockWorkflow.selected = {
            uri: 'file:///private/scan.jpg', mimeType: 'image/jpeg', fileSize: 1024,
            width: 100, height: 200, source: 'camera',
        };
        const register = jest.fn()
            .mockRejectedValueOnce(new CaptureClientError('P9_INTERNAL_ERROR', true, 'retry'))
            .mockResolvedValueOnce({
                inputId: '00000000-0000-4000-8000-000000000004', state: 'uploaded',
            });
        const transport = jest.fn(() => ({ promise: Promise.resolve(), cancel: jest.fn() }));
        (captureService.prepareUpload as jest.Mock).mockResolvedValue({
            expiresAt: '2099-01-01T00:00:00.000Z',
            upload: transport,
            register,
        });
        const screen = render(
            <InventoryCapturePreviewScreen sessionId="00000000-0000-4000-8000-000000000001" />,
        );
        fireEvent.press(screen.getByText('Upload image'));
        fireEvent.press(await screen.findByText('Retry registration'));
        await waitFor(() => expect(register).toHaveBeenCalledTimes(2));
        expect(register.mock.calls[0]).toEqual(register.mock.calls[1]);
        expect(transport).toHaveBeenCalledTimes(1);
        expect(captureService.prepareUpload).toHaveBeenCalledTimes(1);
    });

    it('bounds repeated ambiguous registration replays without repeating bytes or keys', async () => {
        mockWorkflow.selected = {
            uri: 'file:///private/scan.jpg', mimeType: 'image/jpeg', fileSize: 1024,
            width: 100, height: 200, source: 'camera',
        };
        const transport = jest.fn(() => ({ promise: Promise.resolve(), cancel: jest.fn() }));
        const register = jest.fn()
            .mockRejectedValueOnce(new CaptureClientError('P9_INTERNAL_ERROR', true, 'retry'))
            .mockRejectedValueOnce(new CaptureClientError('P9_INTERNAL_ERROR', true, 'retry'))
            .mockResolvedValueOnce({
                inputId: '00000000-0000-4000-8000-000000000004', state: 'uploaded',
            });
        (captureService.prepareUpload as jest.Mock).mockResolvedValue({
            expiresAt: '2099-01-01T00:00:00.000Z',
            upload: transport,
            register,
        });
        const screen = render(
            <InventoryCapturePreviewScreen sessionId="00000000-0000-4000-8000-000000000001" />,
        );
        fireEvent.press(screen.getByText('Upload image'));
        fireEvent.press(await screen.findByText('Retry registration'));
        fireEvent.press(await screen.findByText('Retry registration'));
        await waitFor(() => expect(register).toHaveBeenCalledTimes(3));
        expect(register.mock.calls[1]).toEqual(register.mock.calls[0]);
        expect(register.mock.calls[2]).toEqual(register.mock.calls[0]);
        expect(transport).toHaveBeenCalledTimes(1);
    });

    it('retries failed bytes with the same still-valid prepared capability', async () => {
        mockWorkflow.selected = {
            uri: 'file:///private/scan.jpg', mimeType: 'image/jpeg', fileSize: 1024,
            width: 100, height: 200, source: 'camera',
        };
        const transport = jest.fn()
            .mockReturnValueOnce({ promise: Promise.reject(new Error('transport')), cancel: jest.fn() })
            .mockReturnValueOnce({ promise: Promise.resolve(), cancel: jest.fn() });
        const register = jest.fn().mockResolvedValue({
            inputId: '00000000-0000-4000-8000-000000000004', state: 'uploaded',
        });
        (captureService.prepareUpload as jest.Mock).mockResolvedValue({
            expiresAt: '2099-01-01T00:00:00.000Z',
            upload: transport,
            register,
        });
        const screen = render(
            <InventoryCapturePreviewScreen sessionId="00000000-0000-4000-8000-000000000001" />,
        );
        fireEvent.press(screen.getByText('Upload image'));
        fireEvent.press(await screen.findByText('Retry upload'));
        await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
        expect(transport).toHaveBeenCalledTimes(2);
        expect(captureService.prepareUpload).toHaveBeenCalledTimes(1);
    });

    it('discards an expired failed-transport capability before uploading again', async () => {
        mockWorkflow.selected = {
            uri: 'file:///private/scan.jpg', mimeType: 'image/jpeg', fileSize: 1024,
            width: 100, height: 200, source: 'camera',
        };
        const expiredTransport = jest.fn(() => ({
            promise: Promise.reject(new Error('transport')), cancel: jest.fn(),
        }));
        const freshTransport = jest.fn(() => ({
            promise: Promise.resolve(), cancel: jest.fn(),
        }));
        const register = jest.fn().mockResolvedValue({
            inputId: '00000000-0000-4000-8000-000000000004', state: 'uploaded',
        });
        (captureService.prepareUpload as jest.Mock)
            .mockResolvedValueOnce({
                expiresAt: '2000-01-01T00:00:00.000Z',
                upload: expiredTransport,
                register: jest.fn(),
            })
            .mockResolvedValueOnce({
                expiresAt: '2099-01-01T00:00:00.000Z',
                upload: freshTransport,
                register,
            });
        const screen = render(
            <InventoryCapturePreviewScreen sessionId="00000000-0000-4000-8000-000000000001" />,
        );
        fireEvent.press(screen.getByText('Upload image'));
        fireEvent.press(await screen.findByText('Retry upload'));
        await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
        expect(captureService.prepareUpload).toHaveBeenCalledTimes(2);
        expect(expiredTransport).toHaveBeenCalledTimes(1);
        expect(freshTransport).toHaveBeenCalledTimes(1);
    });

    it('ignores a late registration completion after identity cleanup', async () => {
        mockWorkflow.selected = {
            uri: 'file:///private/scan.jpg', mimeType: 'image/jpeg', fileSize: 1024,
            width: 100, height: 200, source: 'camera',
        };
        let resolveRegistration!: (value: unknown) => void;
        const register = jest.fn(() => new Promise((resolve) => {
            resolveRegistration = resolve;
        }));
        (captureService.prepareUpload as jest.Mock).mockResolvedValue({
            expiresAt: '2099-01-01T00:00:00.000Z',
            upload: () => ({ promise: Promise.resolve(), cancel: jest.fn() }),
            register,
        });
        const screen = render(
            <InventoryCapturePreviewScreen sessionId="00000000-0000-4000-8000-000000000001" />,
        );
        fireEvent.press(screen.getByText('Upload image'));
        await screen.findByText('Registering image');
        await act(async () => {
            cancelAllCaptureWork();
            resolveRegistration({
                inputId: '00000000-0000-4000-8000-000000000004', state: 'uploaded',
            });
            await Promise.resolve();
        });
        expect(mockWorkflow.clear).not.toHaveBeenCalled();
        expect(mockRouter.replace).not.toHaveBeenCalled();
    });
});
