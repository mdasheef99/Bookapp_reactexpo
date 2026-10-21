(() => {
  const supabaseHost = 'ahntbtktjjmvfosgkmgn.supabase.co';
  const actorId = '11111111-1111-4111-8111-111111111111';
  const bookId = '375d1a2e-e9da-485b-89ac-b23c40791535';
  const noteId = 'ffe33fb0-0ab9-4d35-a322-9662320ecb45';
  const bookRecordId = 'b600783f-be22-4814-bd60-b4109b697af2';
  const session = {
    access_token: 'fixture-access-token', refresh_token: 'fixture-refresh-token', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
    user: { id: actorId, email: 'fixture@booktalks.test', phone: '+911234567890', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }
  };
  const book = { id: bookRecordId, title: 'The Quiet Atlas of Long Margins and Borrowed Lanterns, Collected Essays', authors: ['Fixture Author'], cover_url: null, page_count: 300 };
  const userBook = { id: bookId, user_id: actorId, book_id: bookRecordId, reading_status: 'reading', ownership: 'owned', condition: 'good', rating: null, review: null, review_is_public: false, available_for_lending: false, book };
  const profile = { id: 'profile-fixture', user_id: actorId, display_name: 'Fixture', username: 'fixture', account_type: 'user', membership_tier: 'free', trust_score: 10 };
  const note = { id: noteId, user_id: actorId, user_book_id: bookId, content: 'Persisted fixture body stays unchanged', tag: 'reflect', page_number: 12, version: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
  const page = { id: 'saved-page-fixture', user_id: actorId, user_book_id: bookId, page_number: 4, content_excerpt: 'Synthetic saved page for browser QA.', full_text: 'Synthetic saved page for browser QA.', word_count: 6, created_at: '2026-10-10T12:00:00Z', updated_at: '2026-10-10T12:00:00Z' };
  const stats = {
    guardInstalledBeforeBundle: false, syntheticAuth: 0, syntheticReads: 0, syntheticReadRpc: 0,
    blockedExternal: 0, blockedUnknown: 0, blockedMutations: 0, cspBlocks: 0, localPassThrough: 0,
    events: [],
    record(kind, method, pathname) {
      const entry = { kind, method, pathname };
      if (this.events.length < 250) this.events.push(entry);
      if (kind === 'synthetic-auth') this.syntheticAuth += 1;
      else if (kind === 'synthetic-read') this.syntheticReads += 1;
      else if (kind === 'synthetic-read-rpc') this.syntheticReadRpc += 1;
      else if (kind === 'blocked-external') this.blockedExternal += 1;
      else if (kind === 'blocked-unknown') this.blockedUnknown += 1;
      else if (kind === 'blocked-mutation') this.blockedMutations += 1;
      else if (kind === 'local-pass-through') this.localPassThrough += 1;
      const root = document.documentElement;
      if (root) {
        root.setAttribute('data-qa-guard-installed-before-bundle', String(this.guardInstalledBeforeBundle));
        root.setAttribute('data-qa-synthetic-auth', String(this.syntheticAuth));
        root.setAttribute('data-qa-synthetic-reads', String(this.syntheticReads));
        root.setAttribute('data-qa-synthetic-read-rpc', String(this.syntheticReadRpc));
        root.setAttribute('data-qa-blocked-external', String(this.blockedExternal));
        root.setAttribute('data-qa-blocked-unknown', String(this.blockedUnknown));
        root.setAttribute('data-qa-blocked-mutations', String(this.blockedMutations));
        root.setAttribute('data-qa-csp-blocks', String(this.cspBlocks));
        root.setAttribute('data-qa-events', JSON.stringify(this.events));
      }
    }
  };
  document.documentElement.setAttribute('data-qa-fixture-guard', 'installed');
  stats.guardInstalledBeforeBundle = !document.querySelector('script[src*="/entry-"]');
  document.documentElement.setAttribute('data-qa-guard-installed-before-bundle', String(stats.guardInstalledBeforeBundle));
  document.documentElement.setAttribute('data-qa-bundle-present-at-guard-execution', String(!stats.guardInstalledBeforeBundle));
  Object.defineProperty(window, '__bookconnectQAFixture', { value: stats, configurable: false, writable: false });
  const bodyObserver = new MutationObserver(() => {
    const entry = document.querySelector('script[src*="/entry-"]');
    if (entry) stats.guardInstalledBeforeBundle = true;
  });
  bodyObserver.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('securitypolicyviolation', event => {
    stats.cspBlocks += 1;
    let target = 'unknown';
    try { const parsed = new URL(event.blockedURI, window.location.href); target = parsed.origin === window.location.origin ? parsed.pathname : parsed.hostname + parsed.pathname; }
    catch { target = String(event.blockedURI || 'unknown').slice(0, 80); }
    stats.record('csp-block', event.violatedDirective || 'unknown', target);
  });

  const response = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  const synthetic = (url, method, accept) => {
    if (url.hostname !== supabaseHost) return undefined;
    const path = url.pathname;
    if (method === 'POST' && (path === '/auth/v1/otp' || path === '/auth/v1/verify' || path === '/auth/v1/token')) {
      stats.record('synthetic-auth', method, path); return response(path === '/auth/v1/otp' ? {} : session);
    }
    if (method === 'GET' && path === '/auth/v1/user') { stats.record('synthetic-auth', method, path); return response(session.user); }
    if (method === 'GET' && path === '/auth/v1/settings') { stats.record('synthetic-auth', method, path); return response({ sms_provider: 'fixture', sms_autoconfirm: false, external: {} }); }
    if (path === '/rest/v1/rpc/get_public_book_reviews' && ['GET', 'POST'].includes(method)) { stats.record('synthetic-read-rpc', method, path); return response([]); }
    if (method === 'GET' && ['/rest/v1/user_profiles', '/rest/v1/user_books', '/rest/v1/books', '/rest/v1/reading_notes', '/rest/v1/user_book_pages'].includes(path)) {
      stats.record('synthetic-read', method, path);
      const body = path.endsWith('/user_profiles') ? profile : path.endsWith('/user_books') ? userBook : path.endsWith('/books') ? book : path.endsWith('/reading_notes') ? note : page;
      return response(accept.includes('application/vnd.pgrst.object+json') ? body : [body]);
    }
    if (method !== 'GET' && method !== 'HEAD' && path.startsWith('/rest/v1/')) { stats.record('blocked-mutation', method, path); return response({ message: 'QA fixture blocked all non-read-only REST requests before dispatch.' }, 403); }
    stats.record('blocked-unknown', method, path); return response({ message: 'QA fixture blocked an unlisted Supabase request before dispatch.' }, 403);
  };
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    let url;
    try { url = new URL(typeof input === 'string' ? input : input.url, window.location.href); }
    catch { stats.record('blocked-unknown', init.method || 'GET', 'invalid-url'); return Promise.resolve(response({ message: 'Invalid URL blocked by QA fixture.' }, 403)); }
    const method = String(init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    if (url.origin === window.location.origin) {
      stats.record('local-pass-through', method, url.pathname); return originalFetch(input, init);
    }
    const result = synthetic(url, method, String((init.headers && new Headers(init.headers).get('accept')) || (typeof input !== 'string' && input.headers && input.headers.get('accept')) || ''));
    if (result) return Promise.resolve(result);
    stats.record('blocked-external', method, url.hostname + url.pathname);
    return Promise.resolve(response({ message: 'External traffic is disabled in the isolated QA fixture.' }, 403));
  };
  const NativeXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function () {
    const xhr = new NativeXHR(); let isLocal = true; let method = 'GET'; let pathname = 'unknown';
    const open = xhr.open.bind(xhr);
    xhr.open = (nextMethod, target, ...rest) => {
      method = String(nextMethod).toUpperCase();
      try { const url = new URL(target, window.location.href); isLocal = url.origin === window.location.origin; pathname = isLocal ? url.pathname : url.hostname + url.pathname; }
      catch { isLocal = false; }
      if (!isLocal) stats.record('blocked-external', method, pathname);
      return open(nextMethod, isLocal ? target : 'about:blank', ...rest);
    };
    const send = xhr.send.bind(xhr);
    xhr.send = body => { if (!isLocal) { stats.record(method !== 'GET' && method !== 'HEAD' ? 'blocked-mutation' : 'blocked-unknown', method, pathname); throw new Error('External XHR blocked by QA fixture'); } return send(body); };
    return xhr;
  };
  window.WebSocket = function (url) { stats.record('blocked-external', 'WEBSOCKET', String(url).split('/').slice(0, 3).join('/')); throw new Error('WebSocket blocked by QA fixture'); };
  window.EventSource = function (url) { stats.record('blocked-external', 'EVENTSOURCE', String(url).split('/').slice(0, 3).join('/')); throw new Error('EventSource blocked by QA fixture'); };
  const beacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
  if (beacon) navigator.sendBeacon = (url, data) => { const parsed = new URL(url, window.location.href); if (parsed.origin !== window.location.origin) { stats.record('blocked-external', 'BEACON', parsed.hostname + parsed.pathname); return false; } return beacon(url, data); };
})();
