import { Pressable, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import InventoryScanLayout from '../../../../app/(store-owner)/inventory/scan/_layout';
import InventoryPreviewRoute from '../../../../app/(store-owner)/inventory/scan/preview';
import { CaptureWorkflowProvider, useCaptureWorkflow } from '../capture/CaptureWorkflowContext';
import { captureService } from '../api/captureService';

jest.unmock('expo-router');

jest.mock('expo-crypto', () => ({
    randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000009'),
}));

const identity = {
    userId: '00000000-0000-4000-8000-000000000001',
    storeId: '00000000-0000-4000-8000-000000000002',
};

const mockInvalidateQueries = jest.fn(() => Promise.resolve());
let previewRenderHistory: string[] = [];

jest.mock('@/hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => ({ isOffline: false }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            accent: '#2255aa',
            error: '#aa2222',
            textPrimary: '#111111',
            textSecondary: '#444444',
        },
    }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: { children: import('react').ReactNode }) => {
        const { View } = require('react-native') as typeof import('react-native');
        return <View>{children}</View>;
    },
}));
jest.mock('@/components/ui/GlassCard', () => ({
    GlassCard: ({ children }: { children: import('react').ReactNode }) => {
        const { View } = require('react-native') as typeof import('react-native');
        return <View>{children}</View>;
    },
}));
jest.mock('@/components/ui/Button', () => ({
    Button: ({ title, onPress, disabled }: {
        title: string;
        onPress: () => void;
        disabled?: boolean;
    }) => {
        const { Pressable, Text } = require('react-native') as typeof import('react-native');
        return <Pressable disabled={disabled} onPress={onPress}><Text>{title}</Text></Pressable>;
    },
}));
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));
jest.mock('../queries/ownerUxQueries', () => ({
    getResolvedImageInventoryIdentity: () => identity,
    imageInventoryKeys: {
        all: ['phase9', 'ownerInventory'],
        discovery: jest.fn(),
        session: jest.fn(),
        inputs: jest.fn(),
    },
    useOwnerInventoryInputs: () => ({ data: { items: [] }, isLoading: false }),
}));
jest.mock('../offline/ownerUxOfflineGate', () => ({
    useOwnerQueryMutationGate: () => ({ canMutate: true }),
}));
jest.mock('../identity/imageInventoryIdentity', () => ({
    useImageInventoryIdentity: () => {
        const React = require('react') as typeof import('react');
        const [checking, setChecking] = React.useState(false);
        React.useEffect(() => {
            setChecking(true);
            void Promise.resolve().then(() => setChecking(false));
        }, []);
        return checking
            ? { status: 'loading' as const, identity: null }
            : { status: 'ready' as const, identity, storeName: 'Fixture Books' };
    },
}));

function SetupRoute() {
    const router = useRouter();
    const workflow = useCaptureWorkflow();
    return (
        <Pressable
            testID="select-gallery-image"
            onPress={() => {
                workflow.select({
                    uri: 'file:///sanitized/capture-handoff.jpg',
                    mimeType: 'image/jpeg',
                    fileSize: 1024,
                    width: 1200,
                    height: 1600,
                    source: 'gallery',
                });
                router.push({
                    pathname: '/preview',
                    params: { sessionId: '00000000-0000-4000-8000-000000000003' },
                });
            }}
        >
            <Text>Select fixture image</Text>
        </Pressable>
    );
}

function WorkflowProbe() {
    const workflow = useCaptureWorkflow();
    return <Text testID="workflow-status">{workflow.selected ? 'selected' : 'empty'}</Text>;
}

function TrackedPreviewRoute() {
    const workflow = useCaptureWorkflow();
    const snapshot = workflow.selected ? 'selected' : 'empty';
    if (previewRenderHistory.at(-1) !== snapshot) previewRenderHistory.push(snapshot);
    return <InventoryPreviewRoute />;
}

function RegistrationLayout() {
    return (
        <CaptureWorkflowProvider>
            <WorkflowProbe />
            <Stack>
                <Stack.Screen name="index" />
                <Stack.Screen name="preview" />
                <Stack.Screen name="[sessionId]" />
            </Stack>
        </CaptureWorkflowProvider>
    );
}

function SessionDestination() {
    return <Text>Session destination</Text>;
}

describe('capture workflow navigation lifecycle', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        mockInvalidateQueries.mockReset().mockResolvedValue(undefined);
        previewRenderHistory = [];
    });

    it('preserves selected media when Preview re-enters its access boundary', async () => {
        renderRouter({
            _layout: InventoryScanLayout,
            index: SetupRoute,
            preview: InventoryPreviewRoute,
            '[sessionId]': () => null,
        }, { initialUrl: '/' });

        fireEvent.press(screen.getByTestId('select-gallery-image'));

        await waitFor(() => {
            expect(screen.getByLabelText('Selected spine photo')).toBeTruthy();
        });
        expect(screen.queryByText('That upload was not registered. Select the image again.'))
            .toBeNull();
    });

    it('does not render unavailable media while registered Preview navigates to the session', async () => {
        const pendingInvalidations: Array<() => void> = [];
        mockInvalidateQueries.mockImplementation(() => new Promise<void>((resolve) => {
            pendingInvalidations.push(resolve);
        }));
        const register = jest.fn().mockResolvedValue({
            inputId: '00000000-0000-4000-8000-000000000004',
            state: 'uploaded',
        });
        jest.spyOn(captureService, 'prepareUpload').mockResolvedValue({
            expiresAt: '2099-01-01T00:00:00.000Z',
            upload: () => ({ promise: Promise.resolve(), cancel: jest.fn() }),
            register,
        });

        renderRouter({
            _layout: RegistrationLayout,
            index: SetupRoute,
            preview: TrackedPreviewRoute,
            '[sessionId]': SessionDestination,
            '(store-owner)/inventory/scan/preview': TrackedPreviewRoute,
            '(store-owner)/inventory/scan/[sessionId]': SessionDestination,
        }, { initialUrl: '/' });

        fireEvent.press(screen.getByTestId('select-gallery-image'));
        await waitFor(() => expect(screen.getByLabelText('Selected spine photo')).toBeTruthy());
        fireEvent.press(screen.getByText('Upload image'));

        await waitFor(() => expect(captureService.prepareUpload).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
        expect(pendingInvalidations).toHaveLength(3);
        expect(screen.queryByText('That upload was not registered. Select the image again.'))
            .toBeNull();
        expect(previewRenderHistory).toEqual(['selected']);

        pendingInvalidations.forEach((resolve) => resolve());
        await waitFor(() => expect(screen.getByText('Session destination')).toBeTruthy());
        expect(screen.queryByText('That upload was not registered. Select the image again.'))
            .toBeNull();
        expect(previewRenderHistory).toEqual(['selected']);
        expect(screen.getByTestId('workflow-status').props.children).toBe('empty');
    });
});
