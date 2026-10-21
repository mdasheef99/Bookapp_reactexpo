// Builds only the isolated evidence fixture using the already installed Metro runtime.
const fs = require('fs'), path = require('path'), Metro = require('metro');
const { getDefaultConfig } = require('expo/metro-config');
const root = process.cwd(), directory = __dirname;
const config = getDefaultConfig(root);
config.maxWorkers = 1;
config.resetCache = true;
config.resolver.useWatchman = false;
config.watchFolders = [...config.watchFolders, root, path.join(root, 'node_modules'), directory];
const originalResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resolved = moduleName.startsWith('.') ? path.resolve(path.dirname(context.originModulePath), moduleName) : moduleName;
    const normalized = resolved.replace(/\\/g, '/').replace(/\.(tsx?|jsx?)$/, '');
    if (normalized.endsWith('/hooks/useTheme')) return { type: 'sourceFile', filePath: path.join(directory, 'fixture-theme.js') };
    if (normalized.endsWith('/LibraryTypography')) return { type: 'sourceFile', filePath: path.join(directory, 'fixture-typography.js') };
    if (moduleName === 'expo-image') return { type: 'sourceFile', filePath: path.join(directory, 'fixture-image.js') };
    if (moduleName === '@expo/vector-icons') return { type: 'sourceFile', filePath: path.join(directory, 'fixture-icons.js') };
    if (moduleName === 'react-native') moduleName = 'react-native-web';
    return originalResolver ? originalResolver(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};
(async () => {
    await Metro.runBuild(config, { entry: path.relative(root, path.join(directory, 'fixture-entry.js')), platform: 'web', dev: false,
        minify: true, out: path.join(directory, 'fixture.bundle.js') });
    fs.writeFileSync(path.join(directory, 'fixture.html'), '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}#root{display:flex}</style><body><div id="root"></div><script src="fixture.bundle.js"></script></body></html>');
    console.log('Fixture built. Actual ReactDOM collections, mocked theme/fonts/covers; no native or live performance certification.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
