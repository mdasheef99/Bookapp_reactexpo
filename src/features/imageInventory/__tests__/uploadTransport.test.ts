import { uploadSignedMedia } from '../capture/uploadTransport';

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

describe('Phase 9 Unit 6C signed transport cancellation', () => {
    const originalXhr = global.XMLHttpRequest;
    const originalFetch = global.fetch;

    beforeEach(() => {
        (global as any).XMLHttpRequest = FakeXhr;
    });
    afterEach(() => {
        global.XMLHttpRequest = originalXhr;
        global.fetch = originalFetch;
    });

    it('cancels a delayed local read before any signed request is opened or sent', async () => {
        let resolveFetch!: (value: Response) => void;
        global.fetch = jest.fn(() => new Promise((resolve) => { resolveFetch = resolve; })) as jest.Mock;
        const handle = uploadSignedMedia('https://storage.example/private', media, jest.fn());
        handle.cancel();
        await expect(handle.promise).rejects.toThrow('cancelled');
        resolveFetch(new Response(new Blob(['test']), { status: 200 }));
        await Promise.resolve();
        expect(FakeXhr.last.open).not.toHaveBeenCalled();
        expect(FakeXhr.last.send).not.toHaveBeenCalled();
    });
});
