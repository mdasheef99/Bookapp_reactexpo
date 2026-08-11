import { Platform } from 'react-native';
import {
    uploadSignedMedia,
    UploadTransportError,
} from '../capture/uploadTransport';

const mockGetInfoAsync = jest.fn();
const mockUploadAsync = jest.fn();
const mockCancelAsync = jest.fn();
type MockProgress = (value: {
    totalBytesSent: number;
    totalBytesExpectedToSend: number;
}) => void;
const mockCreateUploadTask = jest.fn((
    _url: string,
    _fileUri: string,
    _options: unknown,
    _callback: MockProgress,
) => ({
    uploadAsync: mockUploadAsync,
    cancelAsync: mockCancelAsync,
}));

jest.mock('expo-file-system/legacy', () => ({
    getInfoAsync: (uri: string) => mockGetInfoAsync(uri),
    createUploadTask: (
        url: string,
        fileUri: string,
        options: unknown,
        callback: MockProgress,
    ) => mockCreateUploadTask(url, fileUri, options, callback),
    FileSystemUploadType: { BINARY_CONTENT: 0 },
    FileSystemSessionType: { FOREGROUND: 1 },
}));

class FakeXhr {
    static last: FakeXhr;
    upload: { onprogress: ((event: any) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    status = 200;
    open = jest.fn();
    setRequestHeader = jest.fn();
    send = jest.fn();
    abort = jest.fn();
    constructor() {
        FakeXhr.last = this;
    }
}

const media = {
    uri: 'file:///private/scan.jpg',
    mimeType: 'image/jpeg' as const,
    fileSize: 4,
    width: 10,
    height: 20,
    source: 'camera' as const,
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Phase 9 Unit 6C signed upload transport', () => {
    const originalXhr = global.XMLHttpRequest;
    const originalFetch = global.fetch;
    const originalPlatform = Object.getOwnPropertyDescriptor(Platform, 'OS');
    let platform: typeof Platform.OS = 'android';

    beforeAll(() => {
        Object.defineProperty(Platform, 'OS', {
            configurable: true,
            get: () => platform,
        });
    });

    beforeEach(() => {
        platform = 'android';
        jest.clearAllMocks();
        FakeXhr.last = undefined as unknown as FakeXhr;
        (global as any).XMLHttpRequest = FakeXhr;
        global.fetch = jest.fn();
        mockGetInfoAsync.mockResolvedValue({
            exists: true,
            isDirectory: false,
            uri: media.uri,
            size: media.fileSize,
            modificationTime: 1,
        });
        mockUploadAsync.mockResolvedValue({
            status: 200,
            body: '',
            headers: {},
            mimeType: media.mimeType,
        });
        mockCancelAsync.mockResolvedValue(undefined);
    });

    afterEach(() => {
        global.XMLHttpRequest = originalXhr;
        global.fetch = originalFetch;
    });

    afterAll(() => {
        if (originalPlatform) Object.defineProperty(Platform, 'OS', originalPlatform);
    });

    it.each([
        ['android', 'image/jpeg'],
        ['ios', 'image/png'],
    ] as const)('uses native binary file upload on %s with the declared MIME', async (
        targetPlatform,
        mimeType,
    ) => {
        platform = targetPlatform;
        const selected = { ...media, mimeType };
        const onProgress = jest.fn();
        let resolveUpload!: (value: {
            status: number; body: string; headers: object; mimeType: string;
        }) => void;
        mockUploadAsync.mockImplementation(() => new Promise((resolve) => {
            resolveUpload = resolve;
        }));

        const handle = uploadSignedMedia(
            'https://storage.example/private?token=secret',
            selected,
            onProgress,
        );
        await tick();

        expect(global.fetch).not.toHaveBeenCalled();
        expect(FakeXhr.last).toBeUndefined();
        expect(mockGetInfoAsync).toHaveBeenCalledWith(selected.uri);
        expect(mockCreateUploadTask).toHaveBeenCalledWith(
            'https://storage.example/private?token=secret',
            selected.uri,
            {
                httpMethod: 'PUT',
                uploadType: 0,
                sessionType: 1,
                headers: {
                    'cache-control': 'max-age=0',
                    'content-type': mimeType,
                    'x-upsert': 'false',
                },
            },
            expect.any(Function),
        );

        const progress = mockCreateUploadTask.mock.calls[0][3];
        progress({ totalBytesSent: 2, totalBytesExpectedToSend: 4 });
        expect(onProgress).toHaveBeenCalledWith(50);
        resolveUpload({ status: 200, body: '', headers: {}, mimeType });
        await expect(handle.promise).resolves.toBeUndefined();
    });

    it('rejects a changed native file before signed transmission', async () => {
        mockGetInfoAsync.mockResolvedValue({
            exists: true,
            isDirectory: false,
            uri: media.uri,
            size: media.fileSize - 1,
            modificationTime: 1,
        });

        const handle = uploadSignedMedia('https://storage.example/private', media, jest.fn());

        await expect(handle.promise).rejects.toMatchObject({
            name: 'UploadTransportError',
            code: 'UPLOAD_FILE_CHANGED',
        });
        expect(mockCreateUploadTask).not.toHaveBeenCalled();
    });

    it('cancels an in-flight native task and settles exactly once', async () => {
        let resolveUpload!: (value: {
            status: number; body: string; headers: object; mimeType: string;
        }) => void;
        mockUploadAsync.mockImplementation(() => new Promise((resolve) => {
            resolveUpload = resolve;
        }));
        const handle = uploadSignedMedia('https://storage.example/private', media, jest.fn());
        await tick();

        const rejection = expect(handle.promise).rejects.toMatchObject({
            name: 'UploadTransportError',
            code: 'UPLOAD_CANCELLED',
        });
        handle.cancel();
        handle.cancel();
        await rejection;
        expect(mockCancelAsync).toHaveBeenCalledTimes(1);

        resolveUpload({ status: 200, body: '', headers: {}, mimeType: media.mimeType });
        await tick();
        expect(mockCreateUploadTask).toHaveBeenCalledTimes(1);
    });

    it('returns a typed, bounded native failure without exposing the signed URL', async () => {
        mockUploadAsync.mockResolvedValue({
            status: 400,
            body: JSON.stringify({
                error: 'InvalidRequest',
                message: 'Rejected token=https://private.example?token=secret',
            }),
            headers: { 'content-type': 'application/json' },
            mimeType: 'application/json',
        });

        const handle = uploadSignedMedia(
            'https://storage.example/private?token=secret',
            media,
            jest.fn(),
        );
        const error = await handle.promise.catch((caught) => caught) as UploadTransportError;

        expect(error).toMatchObject({
            name: 'UploadTransportError',
            code: 'UPLOAD_HTTP_ERROR',
            diagnostic: {
                platform: 'android',
                stage: 'native_signed_put',
                status: 400,
                contentType: media.mimeType,
                expectedByteSize: media.fileSize,
            },
        });
        expect(JSON.stringify(error)).not.toContain('token=secret');
    });

    it('preserves the proven browser Blob/FormData XMLHttpRequest path', async () => {
        platform = 'web';
        const blob = new Blob(['test'], { type: media.mimeType });
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            blob: jest.fn().mockResolvedValue(blob),
        } as unknown as Response);

        const handle = uploadSignedMedia('https://storage.example/private', media, jest.fn());
        await tick();
        FakeXhr.last.onload?.();
        await handle.promise;

        expect(mockCreateUploadTask).not.toHaveBeenCalled();
        expect(FakeXhr.last.open).toHaveBeenCalledWith(
            'PUT',
            'https://storage.example/private',
        );
        expect(FakeXhr.last.setRequestHeader).toHaveBeenCalledWith('x-upsert', 'false');
        expect(FakeXhr.last.send.mock.calls[0][0]).toBeInstanceOf(FormData);
    });
});
