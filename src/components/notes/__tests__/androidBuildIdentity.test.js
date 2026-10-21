const resolveConfig = require('../../../../app.config.js');
const originalEnv = process.env;
beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.EAS_BUILD_PROFILE;
  delete process.env.EXPO_PUBLIC_APP_ENV;
  delete process.env.BOOKCONNECT_ANDROID_RELEASE_PACKAGE;
});
afterEach(() => { process.env = originalEnv; });
const config = { name: 'BookConnect', android: { edgeToEdgeEnabled: true } };
it('keeps the development identity and existing config locally', () => {
  expect(resolveConfig({ config })).toEqual({ ...config, android: { ...config.android, package: 'com.bookconnect.library.dev' } });
});
it.each(['preview', 'production'])('fails closed for %s without an approved release identity', profile => {
  process.env.EAS_BUILD_PROFILE = profile;
  process.env.EXPO_PUBLIC_APP_ENV = 'development';
  expect(() => resolveConfig({ config })).toThrow('approved BOOKCONNECT_ANDROID_RELEASE_PACKAGE');
  process.env.BOOKCONNECT_ANDROID_RELEASE_PACKAGE = 'com.bookconnect.library.dev';
  expect(() => resolveConfig({ config })).toThrow();
  process.env.BOOKCONNECT_ANDROID_RELEASE_PACKAGE = 'invalid-package';
  expect(() => resolveConfig({ config })).toThrow();
  process.env.BOOKCONNECT_ANDROID_RELEASE_PACKAGE = 'com.example.approvedfixture';
  expect(resolveConfig({ config }).android.package).toBe('com.example.approvedfixture');
});
