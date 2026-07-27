import {
  createPhase9WorkerHttpService,
} from '../../../workers/phase9-runtime/httpService';

const token = 'phase9-http-relay-A7z.49_xYp-001-strong';

describe('Phase 9 worker HTTP body relay', () => {
  const started: Array<ReturnType<typeof createPhase9WorkerHttpService>> = [];

  afterEach(async () => {
    await Promise.all(started.splice(0).map((service) => service.stop()));
  });

  it('relays only the bounded request bytes to the committed worker handler', async () => {
    const handler = jest.fn(async (request: Request) => {
      const body = await request.json();
      return Response.json({ claimed: body.batchSize, results: [] });
    });
    const service = createPhase9WorkerHttpService({
      serviceName: 'phase9-http-body-relay-test',
      host: '127.0.0.1',
      port: 0,
      concurrency: 1,
      workerAuthToken: token,
      handler,
      readiness: () => true,
    });
    started.push(service);
    const address = await service.start();

    const response = await fetch(`${address.url}/run`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1 }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: 1, results: [] });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
