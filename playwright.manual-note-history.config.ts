import base from './playwright.config';
export default { ...base, testMatch: '**/library-manual-note-browser-history.spec.ts', webServer: undefined };
