
> plan · space-bunny-free

I'll read the instructions file first.
→ Read .spec/TB1-REVIEW.md

$ git diff HEAD --stat 2>&1 | head -30
app/(tabs)/__tests__/_layout.test.tsx | 355 ++++++++++++++++++++++++++++++++--
 app/(tabs)/_layout.tsx                | 192 ++++++++++++++++--
 2 files changed, 525 insertions(+), 22 deletions(-)

$ git status --porcelain -uall 2>&1 | head -50; echo "---BRANCH---"; git branch --show-current; echo "---LOG---"; git log --oneline -5
M app/(tabs)/__tests__/_layout.test.tsx
 M app/(tabs)/_layout.tsx
?? .spec-out/fu6-cleanup/README.md
?? .spec-out/fu6-cleanup/focused-before.json
?? .spec-out/fu6-cleanup/jest-after.json
?? .spec-out/swatches.md
?? .spec/A1r-daylight-390-full.png
?? .spec/A2r-daylight-390-full.png
?? .spec/A3r-daylight-390-fold.png
?? .spec/ESSENCE.md
?? .spec/FINAL-REVIEW.md
?? .spec/SDD-07-FLOW-A-PROTOTYPE.md
?? .spec/SDD-07-FOUNDATION-PLAN.md
?? .spec/SDD-07-TAB-BAR-UNIT.md
?? .spec/SDD-07-book-section-ui-overhaul.md
?? .spec/TB1-PROBE.md
?? .spec/TB1-REVIEW.md
?? .spec/TB1-WEB-RESULTS.md
?? .spec/WAVE1-REVIEW.md
?? .spec/WAVE1.diff
?? .spec/fixture-cover-walden.png
?? app/(tabs)/__tests__/tabBarContrast.test.ts
---BRANCH---
sdd07/tab-bar
---LOG---
6644689 feat(library): add the book-section type scale and layout-level fonts (SDD-07 FU-2)
640ef30 refactor(library): remove unused legacy note UI and service code (SDD-07 FU-6a/b/c)
a36b8e5 build(library): add scoped ESLint for the book section (SDD-07 FU-5a)
17ad84f feat(library): add FA-P1 Book Details web prototype (dev only)
db715d3 feat(library): add SDD-07 FU-1a semantic colour tokens and FU-3 spacing/radius scale

→ Read .spec/SDD-07-TAB-BAR-UNIT.md
→ Read app/(tabs)/_layout.tsx
→ Read app/(tabs)/__tests__/_layout.test.tsx
→ Read app/(tabs)/__tests__/tabBarContrast.test.ts
→ Read .spec/TB1-WEB-RESULTS.md
→ Read src/hooks/useTheme.ts

$ ls node_modules/@react-navigation/elements/lib/module/ 2>&1
Background.js
Background.js.map
Badge.js
Badge.js.map
Button.js
Button.js.map
Header
Label
Lazy.js
Lazy.js.map
MaskedView.android.js
MaskedView.android.js.map
MaskedView.ios.js
MaskedView.ios.js.map
MaskedView.js
MaskedView.js.map
MaskedViewNative.js
MaskedViewNative.js.map
MissingIcon.js
MissingIcon.js.map
PlatformPressable.js
PlatformPressable.js.map
ResourceSavingView.js
ResourceSavingView.js.map
SafeAreaProviderCompat.js
SafeAreaProviderCompat.js.map
Screen.js
Screen.js.map
Text.js
Text.js.map
assets
getDefaultSidebarWidth.js
getDefaultSidebarWidth.js.map
getNamedContext.js
getNamedContext.js.map
index.js
index.js.map
package.json
types.js
types.js.map
useFrameSize.js
useFrameSize.js.map

$ ls node_modules/@react-navigation/bottom-tabs/lib/module/views/ 2>&1; echo "---"; ls node_modules/@react-navigation/bottom-tabs/lib/ 2>&1; echo "---VER---"; node -e "console.log(require('./node_modules/@react-navigation/bottom-tabs/package.json').version, require('./node_modules/expo-router/package.json').version, require('./node_modules/react-native-web/package.json').version, require('./node_modules/@react-navigation/elements/package.json').version, require('./node_modules/@react-navigation/routers/package.json').version)"
BottomTabBar.js
BottomTabBar.js.map
BottomTabItem.js
BottomTabItem.js.map
BottomTabView.js
BottomTabView.js.map
ScreenFallback.js
ScreenFallback.js.map
TabBarIcon.js
TabBarIcon.js.map
---
module
typescript
---VER---
7.15.9 6.0.24 0.21.2 2.9.14 7.5.3

→ Read node_modules/@react-navigation/elements/lib/module/PlatformPressable.js
→ Read node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabItem.js

$ git diff HEAD -- "app/(tabs)/__tests__/_layout.test.tsx" | head -80
diff --git a/app/(tabs)/__tests__/_layout.test.tsx b/app/(tabs)/__tests__/_layout.test.tsx
index 2d29697..b6d1868 100644
--- a/app/(tabs)/__tests__/_layout.test.tsx
+++ b/app/(tabs)/__tests__/_layout.test.tsx
@@ -1,24 +1,93 @@
 import React from 'react';
-import { render } from '@testing-library/react-native';
-import TabsLayout from '../_layout';
+import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
+import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
+import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
+import { useTheme, type ThemeColors, type ThemePhase } from '@/hooks/useTheme';
+import TabsLayout, { decideIconOnly } from '../_layout';

-const tabScreens: Array<{ name: string; options?: { href?: string | null; title?: string } }> = [];
+type Options = BottomTabNavigationOptions & { href?: string | null };
+const tabScreens: Array<{ name: string; options?: Options }> = [];
+let tabProps: { backBehavior?: string; screenOptions: Options };
+const names = ['Library', 'Exchange', 'Marketplace', 'Clubs', 'Profile'];
+const routes = ['library', 'exchange', 'marketplace/index', 'clubs', 'profile'];
+const hidden = ['marketplace/store/[storeId]', 'marketplace/cart', 'marketplace/book/[listingId]',
+    'marketplace/requests/index', 'marketplace/requests/[requestId]'];
+const palettes = {} as Record<ThemePhase, ThemeColors>;
+const originalOS = Platform.OS;
+
+jest.mock('@/hooks/useTheme', () => ({ useTheme: jest.fn() }));
+jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
+    __esModule: true, default: jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 })),
+}));
+jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
+jest.mock('@expo/vector-icons', () => {
+    const { Text } = require('react-native');
+    return { Ionicons: (props: object) => <Text testID="tab-icon" {...props} /> };
+});
+jest.mock('@react-navigation/elements', () => {
+    const { View } = require('react-native');
+    return { PlatformPressable: (props: object) => <View {...props} /> };
+});

 jest.mock('expo-router', () => {
-    const Tabs = ({ children }: { children: React.ReactNode }) => <>{children}</>;
-    Tabs.Screen = (props: { name: string; options?: { href?: string | null; title?: string } }) => {
-        tabScreens.push(props);
-        return null;
+    const { Text } = require('react-native');
+    const Tabs = ({ children, ...props }: { children: React.ReactNode }) => {
+        tabProps = props as typeof tabProps;
+        return <>{children}</>;
+    };
+    Tabs.Screen = (props: { name: string; options?: Options }) => {
+        const index = tabScreens.findIndex(screen => screen.name === props.name);
+        if (index < 0) tabScreens.push(props);
+        else tabScreens[index] = props;
+        if (!props.options?.tabBarButton) return null;
+        const title = props.options.title!;
+        return props.options.tabBarButton({
+            children: <Text>{title} content</Text>, href: `/${props.name}`,
+            'aria-label': props.options.tabBarAccessibilityLabel, 'aria-selected': props.name === 'library',
+            role: 'button', style: { flex: 1 }, testID: `button-${title}`,
+        });
     };
-
     return { Tabs };
 });

-describe('TabsLayout', () => {
-    beforeEach(() => {
-        tabScreens.length = 0;
+beforeAll(() => {
+    jest.useFakeTimers();
+    const actual = jest.requireActual<typeof import('@/hooks/useTheme')>('@/hooks/useTheme');
+    for (const [phase, hour] of [['daylight', 12], ['golden', 18], ['midnight', 23]] as const) {
+        jest.setSystemTime(new Date(2026, 9, 18, hour));
+        const hook = renderHook(actual.useTheme);
+        expect(hook.result.current.phase).toBe(phase);
+        palettes[phase] = hook.result.current.colors;
+        hook.unmount();
+    }
+    jest.useRealTimers();
+});

$ node -e "const p=require('./package.json'); console.log(JSON.stringify({scripts:p.scripts, rn:p.dependencies['react-native'], react:p.dependencies.react, expo:p.dependencies.expo, rnrw:p.dependencies['react-native-web'], er:p.dependencies['expo-router'], nav:p.dependencies['@react-navigation/native']},null,1))" 2>&1
{
 "scripts": {
  "test:phase9:unit7b-cross-layer": "node scripts/test-phase9-unit7b-cross-layer.js",
  "start": "expo start",
  "android": "expo run:android",
  "ios": "expo start --ios",
  "web": "expo start --web",
  "export:web": "expo export --platform web",
  "e2e:build:web": "node scripts/e2e-build-web.js",
  "test:e2e:web": "npm run e2e:build:web && playwright test",
  "smoke:phase2b:store-application": "node scripts/smoke-phase2b-store-application.js",
  "validate:auth-config": "node scripts/validate-auth-config.js",
  "sentry:upload-sourcemaps": "node node_modules/@sentry/react-native/scripts/expo-upload-sourcemaps.js dist",
  "sentry:upload-sourcemaps:web": "npm run export:web && npm run sentry:upload-sourcemaps",
  "test": "jest",
  "test:phase9:db": "node --experimental-vm-modules --test supabase/tests/phase9/*.integration.test.mjs",
  "benchmark:phase9:sanitizer": "node scripts/benchmark-phase9-sanitizer.mjs",
  "build:phase9:media-worker": "tsc -p workers/phase9-media-validation-worker/tsconfig.json",
  "start:phase9:media-worker": "node .phase9-dist/workers/phase9-media-validation-worker/server.js",
  "build:phase9:vision-worker": "tsc -p workers/phase9-vision-analysis-worker/tsconfig.json",
  "start:phase9:vision-worker": "node .phase9-dist/workers/phase9-vision-analysis-worker/server.js",
  "build:phase9:metadata-worker": "tsc -p workers/phase9-metadata-worker/tsconfig.json",
  "start:phase9:metadata-worker": "node .phase9-dist/workers/phase9-metadata-worker/server.js",
  "build:phase9:publication-worker": "tsc -p workers/phase9-publication-worker/tsconfig.json",
  "start:phase9:publication-worker": "node .phase9-dist/workers/phase9-publication-worker/server.js",
  "test:phase9:structural-metadata": "npm run build:phase9:metadata-worker && node --experimental-vm-modules --test supabase/tests/phase9/phase9StructuralMetadataWorker.integration.test.mjs",
  "invoke:phase9:worker": "node scripts/invoke-phase9-worker.js",
  "smoke:phase9:worker-entrypoints": "node scripts/smoke-phase9-worker-entrypoints.js",
  "smoke:phase9:worker-containers": "node scripts/smoke-phase9-worker-containers.js",
  "validate:phase9:deployment-runtime": "node scripts/validate-phase9-deployment-runtime.js",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "lint:library": "eslint \"app/(tabs)/library\" src/components/library src/components/notes src/features/books/notes"
 },
 "rn": "0.81.5",
 "react": "19.1.0",
 "expo": "~54.0.36",
 "rnrw": "^0.21.0",
 "er": "~6.0.24"
}

$ git show HEAD:"app/(tabs)/__tests__/_layout.test.tsx"
import React from 'react';
import { render } from '@testing-library/react-native';
import TabsLayout from '../_layout';

const tabScreens: Array<{ name: string; options?: { href?: string | null; title?: string } }> = [];

jest.mock('expo-router', () => {
    const Tabs = ({ children }: { children: React.ReactNode }) => <>{children}</>;
    Tabs.Screen = (props: { name: string; options?: { href?: string | null; title?: string } }) => {
        tabScreens.push(props);
        return null;
    };

    return { Tabs };
});

describe('TabsLayout', () => {
    beforeEach(() => {
        tabScreens.length = 0;
    });

    it('registers primary tabs, omits legacy shims, and hides detail routes', () => {
        render(<TabsLayout />);

        expect(tabScreens.map(screen => screen.name)).toEqual([
            'library',
            'exchange',
            'marketplace/index',
            'clubs',
            'profile',
            'marketplace/store/[storeId]',
        ]);
        expect(tabScreens.find(screen => screen.name === 'credit-history')).toBeUndefined();
        expect(tabScreens.find(screen => screen.name === 'addresses')).toBeUndefined();
        expect(tabScreens.find(screen => screen.name === 'marketplace/store/[storeId]')?.options?.href).toBeNull();
    });
});

$ npx --no-install jest --runInBand --testPathPattern "app.\(tabs\)" 2>&1 | tail -60
npm notice run booktalks-mobile@1.0.0 npx
npm notice run jest --runInBand --testPathPattern app.\(tabs\)
PASS app/(tabs)/library/__tests__/book-details-corrections.test.tsx (9.653 s)
PASS app/(tabs)/profile/__tests__/profile.test.tsx
PASS app/(tabs)/library/__tests__/index.test.tsx
PASS app/(tabs)/library/__tests__/search.test.tsx
  ● Console

    console.error
      An update to SearchBooksScreenContent inside a test was not wrapped in act(...).

      When testing, code that causes React state updates should be wrapped into act(...):

      act(() => {
        /* fire events that update state */
      });
      /* assert on the output */

      This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

      at node_modules/react-test-renderer/cjs/react-test-renderer.development.js:11801:19
      at runWithFiberInDEV (node_modules/react-test-renderer/cjs/react-test-renderer.development.js:1574:13)
      at warnIfUpdatesNotWrappedWithActDEV (node_modules/react-test-renderer/cjs/react-test-renderer.development.js:11800:9)
      at scheduleUpdateOnFiber (node_modules/react-test-renderer/cjs/react-test-renderer.development.js:10326:9)
      at forceStoreRerender (node_modules/react-test-renderer/cjs/react-test-renderer.development.js:3430:24)
      at node_modules/react-test-renderer/cjs/react-test-renderer.development.js:3415:41
      at node_modules/@tanstack/query-core/src/notifyManager.ts:73:11
      at notifyFn (node_modules/@tanstack/query-core/src/notifyManager.ts:21:5)
      at node_modules/@tanstack/query-core/src/notifyManager.ts:44:13
          at Array.forEach (<anonymous>)
      at node_modules/@tanstack/query-core/src/notifyManager.ts:43:25
      at batchNotifyFn (node_modules/@tanstack/query-core/src/notifyManager.ts:24:5)
      at Timeout._onTimeout (node_modules/@tanstack/query-core/src/notifyManager.ts:42:9)

PASS app/(tabs)/__tests__/_layout.test.tsx
PASS app/(tabs)/clubs/__tests__/index.test.tsx
PASS app/(tabs)/profile/__tests__/edit-profile.test.tsx
PASS app/(tabs)/profile/__tests__/addresses.test.tsx
PASS app/(tabs)/exchange/__tests__/exchange-capabilities.test.tsx
PASS app/(tabs)/exchange/__tests__/listing-detail.test.tsx
PASS app/(tabs)/exchange/__tests__/transaction-detail.test.tsx
PASS app/(tabs)/library/__tests__/[bookId].test.tsx
PASS app/(tabs)/profile/__tests__/credit-history.test.tsx
PASS app/(tabs)/profile/__tests__/notification-settings.test.tsx
PASS app/(tabs)/profile/__tests__/settings.test.tsx
PASS app/(tabs)/clubs/__tests__/authors.test.tsx
PASS app/(tabs)/profile/__tests__/notifications.test.tsx
PASS app/(tabs)/profile/__tests__/_layout.test.tsx
PASS app/(tabs)/__tests__/tabBarContrast.test.ts

Test Suites: 19 passed, 19 total
Tests:       157 passed, 157 total
Snapshots:   0 total
Time:        19.642 s, estimated 26 s
Ran all test suites matching /app.\(tabs\)/i.

$ node -e "console.log(JSON.stringify(require('./app.json').expo.web,null,1))" 2>&1; echo "--- RN roles ---"; grep -n "'tab'" node_modules/react-native/Libraries/Components/View/ViewAccessibility.js | head -20
{
 "favicon": "./assets/favicon.png",
 "meta": {
  "viewport": "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no"
 }
}
--- RN roles ---
42:  | 'tab'
115:  | 'tab'

$ npx --no-install tsc -p tsconfig.library-notes.json --noEmit 2>&1 | tail -40
npm notice run booktalks-mobile@1.0.0 npx
npm notice run tsc -p tsconfig.library-notes.json --noEmit

$ grep -rn "tab" node_modules/react-native/Libraries/Components/View/ViewPropTypes.js 2>/dev/null | head; echo "=== native role map (iOS) ==="; grep -rn "accessibilityRole" node_modules/react-native/React/Views/RCTViewComponentView.m 2>/dev/null | head -5; echo "=== search for RN mapping table ==="; grep -rn "'tab':" node_modules/react-native/Libraries/ 2>/dev/null | head -10
331:   * See https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex
340:  tabIndex?: 0 | -1,
357:  isTVSelectable?: boolean,
=== native role map (iOS) ===
=== search for RN mapping table ===

$ npx --no-install tsc -p tsconfig.library-notes.json --noEmit > /tmp/tsc.txt 2>&1; echo "exit=$?"; wc -l /tmp/tsc.txt
exit=0
2 /tmp/tsc.txt

$ grep -rn "role" node_modules/react-native/Libraries/Components/View/ViewAccessibility.js | sed -n '1,60p'
378:   * Indicates to accessibility services to treat UI component like a specific role.
385:  role?: ?Role,

$ ls node_modules/react-native/React/Views/ 2>/dev/null | head -40; echo "=== grep ==="; grep -rln "accessibilityTraits\|AccessibilityTraits" node_modules/react-native/React/Views/ 2>/dev/null | head -10
RCTActivityIndicatorView.h
RCTActivityIndicatorView.m
RCTActivityIndicatorViewManager.h
RCTActivityIndicatorViewManager.m
RCTAnimationType.h
RCTAutoInsetsProtocol.h
RCTBorderCurve.h
RCTBorderDrawing.h
RCTBorderDrawing.m
RCTBorderStyle.h
RCTComponent.h
RCTComponentData.h
RCTComponentData.mm
RCTConvert+CoreLocation.h
RCTConvert+CoreLocation.m
RCTConvert+Transform.h
RCTConvert+Transform.m
RCTCursor.h
RCTDebuggingOverlay.h
RCTDebuggingOverlay.m
RCTDebuggingOverlayManager.h
RCTDebuggingOverlayManager.m
RCTFont.h
RCTFont.mm
RCTLayout.h
RCTLayout.m
RCTModalHostView.h
RCTModalHostView.m
RCTModalHostViewController.h
RCTModalHostViewController.m
RCTModalHostViewManager.h
RCTModalHostViewManager.m
RCTModalManager.h
RCTModalManager.m
RCTPointerEvents.h
RCTRootShadowView.h
RCTRootShadowView.m
RCTShadowView+Internal.h
RCTShadowView+Internal.m
RCTShadowView+Layout.h
=== grep ===
node_modules/react-native/React/Views/RCTView.h
node_modules/react-native/React/Views/RCTView.m
node_modules/react-native/React/Views/RCTViewManager.m
node_modules/react-native/React/Views/UIView+React.h
node_modules/react-native/React/Views/UIView+React.m

$ grep -n "accessibilityRole\|tab\|Role" node_modules/react-native/React/Views/RCTViewManager.m | head -40
30:      @"adjustable" : @(UIAccessibilityTraitAdjustable),
105:      @"tab" : @(UIAccessibilityTraitNone),
106:      @"tabbar" : @(UIAccessibilityTraitTabBar),
107:      @"table" : @(UIAccessibilityTraitNone),
108:      @"tablist" : @(UIAccessibilityTraitNone),
109:      @"tabpanel" : @(UIAccessibilityTraitNone),
224:RCT_CUSTOM_VIEW_PROPERTY(accessibilityRole, UIAccessibilityTraits, RCTView)
226:  UIAccessibilityTraits accessibilityRoleTraits =
228:  if (view.reactAccessibilityElement.accessibilityRoleTraits != accessibilityRoleTraits) {
229:    view.accessibilityRoleTraits = accessibilityRoleTraits;
230:    view.reactAccessibilityElement.accessibilityRole = json ? [RCTConvert NSString:json] : nil;
231:    [self updateAccessibilityTraitsForRole:view withDefaultView:defaultView];
241:    [self updateAccessibilityTraitsForRole:view withDefaultView:defaultView];
245:- (void)updateAccessibilityTraitsForRole:(RCTView *)view withDefaultView:(RCTView *)defaultView
247:  const UIAccessibilityTraits AccessibilityRolesMask = UIAccessibilityTraitNone | UIAccessibilityTraitButton |
249:      UIAccessibilityTraitKeyboardKey | UIAccessibilityTraitStaticText | UIAccessibilityTraitAdjustable |
253:  // Clear any existing traits set for AccessibilityRole
254:  view.reactAccessibilityElement.accessibilityTraits &= ~(AccessibilityRolesMask);
258:      : view.reactAccessibilityElement.accessibilityRole ? view.reactAccessibilityElement.accessibilityRoleTraits
259:                                                         : (defaultView.accessibilityTraits & AccessibilityRolesMask);
265:  NSMutableDictionary<NSString *, id> *newState = [NSMutableDictionary<NSString *, id> new];

$ grep -rn "accessibilityRole" node_modules/react-native/Libraries/Components/View/ViewAccessibility.js | head -20; echo "=== android role map ==="; grep -rn "tab\b" node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/accessibility/ReactAccessibilityDelegate.java 2>/dev/null | head -10
380:  accessibilityRole?: ?AccessibilityRole,
383:   * Alias for accessibilityRole
=== android role map ===

→ Read node_modules/react-native/React/Views/RCTViewManager.m [offset=20, limit=120]

$ ls node_modules/expo-router/build/layouts/ 2>&1; echo "=== Tabs.js head ==="; sed -n '1,60p' node_modules/expo-router/build/layouts/Tabs.js 2>&1
BaseStack.d.ts
BaseStack.d.ts.map
BaseStack.js
BaseStack.js.map
Drawer.d.ts
Drawer.d.ts.map
Drawer.js
Drawer.js.map
DrawerClient.d.ts
DrawerClient.d.ts.map
DrawerClient.js
DrawerClient.js.map
ExperimentalModalStack.d.ts
ExperimentalModalStack.d.ts.map
ExperimentalModalStack.js
ExperimentalModalStack.js.map
RootModal.d.ts
RootModal.d.ts.map
RootModal.js
RootModal.js.map
Stack.d.ts
Stack.d.ts.map
Stack.js
Stack.js.map
Stack.web.d.ts
Stack.web.d.ts.map
Stack.web.js
Stack.web.js.map
StackClient.d.ts
StackClient.d.ts.map
StackClient.js
StackClient.js.map
TabRouter.d.ts
TabRouter.d.ts.map
TabRouter.js
TabRouter.js.map
Tabs.d.ts
Tabs.d.ts.map
Tabs.js
Tabs.js.map
TabsClient.d.ts
TabsClient.d.ts.map
TabsClient.js
TabsClient.js.map
_web-modal.d.ts
_web-modal.d.ts.map
_web-modal.js
_web-modal.js.map
withLayoutContext.d.ts
withLayoutContext.d.ts.map
withLayoutContext.js
withLayoutContext.js.map
=== Tabs.js head ===
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tabs = void 0;
const TabsClient_1 = __importDefault(require("./TabsClient"));
exports.Tabs = TabsClient_1.default;
const Screen_1 = require("../views/Screen");
TabsClient_1.default.Screen = Screen_1.Screen;
exports.default = TabsClient_1.default;
//# sourceMappingURL=Tabs.js.map

$ grep -rn "href === null\|href: null\|isVisible\|hide" node_modules/expo-router/build/layouts/Tabs.js node_modules/expo-router/build/layouts/TabsHost.js 2>/dev/null | head -20; echo "=== useScreens ==="; grep -rn "href" node_modules/expo-router/build/layouts/common.js 2>/dev/null | head -20
=== useScreens ===

$ grep -n "href" node_modules/expo-router/build/layouts/TabsClient.js | head -40
17:    // Support the `href` shortcut prop.
19:        if (typeof screen.options !== 'function' && screen.options?.href !== undefined) {
20:            const { href, ...options } = screen.options;
22:                throw new Error('Cannot use `href` and `tabBarButton` together.');
28:                    tabBarItemStyle: href == null ? { display: 'none' } : options.tabBarItemStyle,
31:                        if (href == null) {
37:                        return (<Link_1.Link {...props} style={[{ display: 'flex' }, props.style]} href={href} asChild={react_native_1.Platform.OS !== 'web'} children={children}/>);

$ grep -rn "href" node_modules/expo-router/build/getRoutes.js node_modules/expo-router/build/hooks/useScreens.js 2>/dev/null | head -20; echo "=== find useScreens ==="; ls node_modules/expo-router/build/hooks/ 2>/dev/null
=== find useScreens ===

→ Read node_modules/expo-router/build/layouts/TabsClient.js
→ Read node_modules/expo-router/build/layouts/TabRouter.js

$ grep -n "numberOfLines\|maxWidth" node_modules/react-native-web/dist/exports/Text/index.js | head -30
15:var _excluded = ["hrefAttrs", "numberOfLines", "onClick", "onLayout", "onPress", "onMoveShouldSetResponder", "onMoveShouldSetResponderCapture", "onResponderEnd", "onResponderGrant", "onResponderMove", "onResponderReject", "onResponderRelease", "onResponderStart", "onResponderTerminate", "onResponderTerminationRequest", "onScrollShouldSetResponder", "onScrollShouldSetResponderCapture", "onSelectionChangeShouldSetResponder", "onSelectionChangeShouldSetResponderCapture", "onStartShouldSetResponder", "onStartShouldSetResponderCapture", "selectable"];
37:    numberOfLines = props.numberOfLines,
113:  supportedProps.style = [numberOfLines != null && numberOfLines > 1 && {
114:    WebkitLineClamp: numberOfLines
115:  }, hasTextAncestor === true ? styles.textHasAncestor$raw : styles.text$raw, numberOfLines === 1 && styles.textOneLine, numberOfLines != null && numberOfLines > 1 && styles.textMultiLine, props.style, selectable === true && styles.selectable, selectable === false && styles.notSelectable, onPress && styles.pressable];
169:    maxWidth: '100%',
178:    maxWidth: '100%',

$ grep -n "href\|'a'\|role" node_modules/react-native-web/dist/exports/Pressable/index.js | head -40
(no output)

$ sed -n '160,200p' node_modules/react-native-web/dist/exports/Text/index.js
var styles = StyleSheet.create({
  text$raw: textStyle,
  textHasAncestor$raw: _objectSpread(_objectSpread({}, textStyle), {}, {
    color: 'inherit',
    font: 'inherit',
    textAlign: 'inherit',
    whiteSpace: 'inherit'
  }),
  textOneLine: {
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    wordWrap: 'normal'
  },
  // See #13
  textMultiLine: {
    display: '-webkit-box',
    maxWidth: '100%',
    overflow: 'clip',
    textOverflow: 'ellipsis',
    WebkitBoxOrient: 'vertical'
  },
  notSelectable: {
    userSelect: 'none'
  },
  selectable: {
    userSelect: 'text'
  },
  pressable: {
    cursor: 'pointer'
  }
});
export default Text;

$ grep -rn "href" node_modules/react-native-web/dist/modules/usePressEvents/PressResponder.js 2>/dev/null | head -20; echo "=== createDOMProps href ==="; grep -rn "'href'\|href:" node_modules/react-native-web/dist/modules/createDOMProps/index.js | head -20
=== createDOMProps href ===

$ grep -rn "href" node_modules/react-native-web/dist/modules/createDOMProps/index.js node_modules/react-native-web/dist/exports/View/index.js 2>/dev/null | head -30
node_modules/react-native-web/dist/exports/View/index.js:14:var _excluded = ["hrefAttrs", "onLayout", "onMoveShouldSetResponder", "onMoveShouldSetResponderCapture", "onResponderEnd", "onResponderGrant", "onResponderMove", "onResponderReject", "onResponderRelease", "onResponderStart", "onResponderTerminate", "onResponderTerminationRequest", "onScrollShouldSetResponder", "onScrollShouldSetResponderCapture", "onSelectionChangeShouldSetResponder", "onSelectionChangeShouldSetResponderCapture", "onStartShouldSetResponder", "onStartShouldSetResponderCapture"];
node_modules/react-native-web/dist/exports/View/index.js:27:  href: true,
node_modules/react-native-web/dist/exports/View/index.js:35:  var hrefAttrs = props.hrefAttrs,
node_modules/react-native-web/dist/exports/View/index.js:91:  if (props.href != null) {
node_modules/react-native-web/dist/exports/View/index.js:93:    if (hrefAttrs != null) {
node_modules/react-native-web/dist/exports/View/index.js:94:      var download = hrefAttrs.download,
node_modules/react-native-web/dist/exports/View/index.js:95:        rel = hrefAttrs.rel,
node_modules/react-native-web/dist/exports/View/index.js:96:        target = hrefAttrs.target;

$ ls node_modules/react-native-web/dist/modules/ 2>/dev/null | head -60; echo "=== forwardProps ==="; grep -rn "href" node_modules/react-native-web/dist/modules/forwardedProps/index.js 2>/dev/null | head -20
AccessibilityUtil
AssetRegistry
ImageLoader
TextInputState
UnimplementedView
addEventListener
canUseDom
createDOMProps
dismissKeyboard
forwardedProps
getBoundingClientRect
isSelectionValid
isWebColor
mergeRefs
modality
multiplyStyleLengthValue
normalizeColor
pick
prefixStyles
requestIdleCallback
setValueForStyles
unitlessNumbers
useElementLayout
useEvent
useHover
useLayoutEffect
useLocale
useMergeRefs
usePlatformMethods
usePressEvents
useResponderEvents
useStable
warnOnce
=== forwardProps ===

→ Read node_modules/react-native-web/dist/exports/View/index.js [offset=85, limit=40]

$ grep -n "borderTopWidth\|hairlineWidth\|styles = \|content:\|paddingBottom\|paddingTop\|paddingHorizontal\|minHeight\|height:" node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabBar.js | head -40
180:    height: 0
223:      borderLeftWidth: StyleSheet.hairlineWidth
225:      borderRightWidth: StyleSheet.hairlineWidth
227:      borderBottomWidth: StyleSheet.hairlineWidth
229:      borderTopWidth: StyleSheet.hairlineWidth
234:      paddingTop: (hasHorizontalLabels ? spacing : spacing / 2) + insets.top,
235:      paddingBottom: (hasHorizontalLabels ? spacing : spacing / 2) + insets.bottom,
243:          outputRange: [layout.height + insets[tabBarPosition === 'top' ? 'top' : 'bottom'] + StyleSheet.hairlineWidth, 0]
250:      height: tabBarHeight,
251:      paddingBottom: tabBarPosition === 'bottom' ? insets.bottom : 0,
252:      paddingTop: tabBarPosition === 'top' ? insets.top : 0,
253:      paddingHorizontal: Math.max(insets.left, insets.right)
337:const styles = StyleSheet.create({

→ Read node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabBar.js [limit=120, offset=215]

$ node -e "const e=require('./app.json').expo; console.log('reactStrictMode=',e.reactStrictMode); console.log('web=',JSON.stringify(e.web))"; echo "=== FU-1a contrast fn ==="; grep -rln "0.04045" --include=*.ts --include=*.tsx . 2>/dev/null | head -10
reactStrictMode= undefined
web= {"favicon":"./assets/favicon.png","meta":{"viewport":"width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no"}}
=== FU-1a contrast fn ===
./app/(tabs)/__tests__/tabBarContrast.test.ts
./node_modules/expo-image/src/utils/blurhash/utils.ts
./node_modules/react-native-reanimated/src/culori/lrgb.ts
./src/components/library/__tests__/LibraryAppearance.test.ts
./src/features/books/utils/shelfLayout.ts
./src/features/books/utils/__tests__/shelfLayout.test.ts

$ grep -n "0.04045" -A 12 -B 8 src/components/library/__tests__/LibraryAppearance.test.ts | head -50
130-    r: top.r * top.a + bottom.r * (1 - top.a),
131-    g: top.g * top.a + bottom.g * (1 - top.a),
132-    b: top.b * top.a + bottom.b * (1 - top.a),
133-    a: 1,
134-});
135-
136-const luminance = ({ r, g, b }: Rgba) => [r, g, b]
137-    .map((channel) => channel / 255)
138:    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
139-    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
140-
141-const contrastRatio = (foreground: string, background: string) => {
142-    const back = composite(parseColor(background), PAPER);
143-    const front = composite(parseColor(foreground), back);
144-    const light = Math.max(luminance(front), luminance(back));
145-    const dark = Math.min(luminance(front), luminance(back));
146-    return (light + 0.05) / (dark + 0.05);
147-};
148-
149-const measure = (phase: Phase, pair: TokenPair) => {
150-    const colors = getLibraryAppearance(phase);

$ grep -n "history" node_modules/@react-navigation/routers/lib/module/TabRouter.js | head -40
19:  const history = [{
27:        history.unshift({
35:        history.unshift({
45:        history.unshift({
51:    case 'history':
53:      // The history will fill up on navigation
56:  return history;
59:  let history = state.history;
60:  if (backBehavior === 'history' || backBehavior === 'fullHistory') {
62:    if (backBehavior === 'history') {
63:      // Remove the existing key from the history to de-duplicate it
64:      history = history.filter(it => it.type === 'route' ? it.key !== currentRoute.key : false);
66:      const lastHistoryRouteItemIndex = history.findLastIndex(item => item.type === 'route');
67:      if (currentRoute.key === history[lastHistoryRouteItemIndex]?.key) {
68:        // For full-history, only remove if it matches the last route
69:        // Useful for drawer, if current route was in history, then drawer state changed
71:        history = [...history.slice(0, lastHistoryRouteItemIndex), ...history.slice(lastHistoryRouteItemIndex + 1)];
74:    history = history.concat({
80:    history = getRouteHistory(state.routes, index, backBehavior, initialRouteName);
85:    history
105:      const history = getRouteHistory(routes, index, backBehavior, initialRouteName);
112:        history,
139:      const history = state.history?.filter(it => routeKeys.includes(it.key)) ?? [];
146:        history,
162:      let history = state.history.filter(
165:      if (!history.length) {
166:        history = getRouteHistory(routes, index, backBehavior, initialRouteName);
170:        history,
245:                const historyItemIndex = state.history.findLastIndex(item => item.key === focusedRoute.key);
246:                let updatedHistory = state.history;
247:                if (historyItemIndex !== -1) {
248:                  updatedHistory = [...state.history];
249:                  updatedHistory[historyItemIndex] = {
250:                    ...updatedHistory[historyItemIndex],
256:                  history: updatedHistory
264:            if (state.history.length === 1) {
267:            const previousHistoryItem = state.history[state.history.length - 2];
285:              history: state.history.slice(0, -1),
317:              history: key === route.key ? state.history : state.history.filter(record => record.key !== route.key)

→ Read node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabBar.js [offset=336]
## VERDICT

Safe to commit: **YES WITH FIXES**. The TB-D5 measurement and prop forwarding are sound — the slot is genuinely measured (padding-box width) and every prop BottomTabItem passes reaches `PlatformPressable`, with Enter/Space/disabled handled without double activation. But forcing `role="tab"` on iOS reverses an explicit workaround in `@react-navigation/bottom-tabs` and drops `UIAccessibilityTraitButton`, and the bare `tabBarAccessibilityLabel` drops the library's ", tab, N of 5" announcement; those are real a11y regressions on the app's primary navigation and should land before the commit.

## FINDINGS

| id | file:line | problem | evidence (what you checked) | concrete fix | severity |
|---|---|---|---|---|---|
| TB1-R1 | `app/(tabs)/_layout.tsx:63` | `role="tab"` is forced on iOS too, reversing the library's own workaround | `BottomTabItem.js:137-140` sends `Platform.select({ ios: 'button', default: 'tab' })` with the comment *"FIXME: role: 'tab' doesn't seem to work as expected on iOS"*. `RCTViewManager.m:105` maps `@"tab" → UIAccessibilityTraitNone`, and `RCTViewManager.m:245-259` clears the traits mask then applies the role's traits — so every iOS tab loses the Button trait it has today | `role={Platform.select({ ios: 'button', default: 'tab' })}` (or spread the incoming `props.role` and only default it), so the library's platform value wins | should-fix |
| TB1-R2 | `app/(tabs)/_layout.tsx:148` | `tabBarAccessibilityLabel: tab.title` drops the tab-position announcement | `BottomTabBar.js:292`: when `tabBarAccessibilityLabel` is `undefined` it falls back to `` `${label}, tab, ${index + 1} of ${routes.length}` `` on iOS; setting it explicitly suppresses that, so VoiceOver no longer announces "1 of 5". On web the bare title also replaces the default `aria-label` fallback (which is `undefined` off-iOS, so the name must be set — but the position need not be dropped) | `` tabBarAccessibilityLabel: `${tab.title}, tab, ${index + 1} of ${VISIBLE_TABS.length}` `` in the `.map((tab, index) => …)`, keeping the icon-only accessible name intact | should-fix |
| TB1-R3 | `app/(tabs)/_layout.tsx:96` | `currentKey.current = measurementKey` is a ref write during render | Unsafe under concurrent rendering/StrictMode: a started-then-discarded render can leave `currentKey` on a key that never commits, after which every `record()` call hits the `currentKey.current !== measurementKey` guard, the 15-value `every()` never completes, and the bar stays on the stale `showLabels` forever (the "stuck icon-only" path the spec asks about) | Move the assignment into `useLayoutEffect(() => { currentKey.current = measurementKey; }, [measurementKey])`, or drop the ref and have `record` compare against `measurements.key` | consider |
| TB1-R4 | `app/(tabs)/_layout.tsx:129` | `max-width: none` in the injected CSS is inert | RNW applies `styles.textOneLine` (`maxWidth: '100%'`, Text/index.js:169) through `supportedProps.style` (Text/index.js:113), i.e. an **inline** style, which outranks any author stylesheet rule regardless of the `[id^="tb1-probe-"]` specificity. Only `width: max-content` (not set inline) actually contributes — consistent with V1b's ~70 px Marketplace probe on a 78 px slot | Drop `max-width: none` (and the matching assertion at `_layout.test.tsx:302`) or add `!important`; the measurement is safe either way because the inline cap saturates at the slot width, which still yields icon-only | consider |
| TB1-R5 | `app/(tabs)/_layout.tsx:100` | `showLabels` starts `true`, so the first committed frame paints labels before any measurement exists | `onLayout` fires after the first commit/paint (RNW `useElementLayout`), so at 390 px the bar renders one frame of `numberOfLines={1} ellipsizeMode="clip"` labels before flipping to icon-only. `_layout.test.tsx:247` locks this in as intended | Acceptable trade-off to avoid a flash of missing labels at ≥400 px; if unwanted, start from the measured decision and keep a `hasMeasured` guard. Not a page-overflow risk (`overflow: hidden` + `minWidth: 0`) | consider |
| TB1-R6 | `app/(tabs)/__tests__/_layout.test.tsx:317` | The "forwards every prop" test builds its own prop object instead of BottomTabItem's real prop set | `BottomTabItem.js:128-153` also sends `accessibilityLargeContentTitle`, `accessibilityShowsLargeContentViewer`, `android_ripple`, `pressOpacity` and `hoverEffect`; none appear in the test props, so the claim rests on reading `{...props}` rather than on evidence. (Functionally fine — `{...props}` does forward all of them, and `PlatformPressable`'s own `role: 'link'\|'button'` is itself overridden by `...rest`, PlatformPressable.js:74/89) | Render the real `BottomTabBar`/`BottomTabItem` once (no `Tabs` mock) and snapshot the DOM props of one anchor | consider |
| TB1-R7 | `app/(tabs)/__tests__/tabBarContrast.test.ts:5` | Contrast function copy-pasted instead of shared, though §7 specifies "the same contrast function as the FU-1a registry test" | `LibraryAppearance.test.ts:136-147` has a materially different version (parses colours and alpha-composites over PAPER); the new copy silently skips compositing. Not tautological — it uses `jest.requireActual` + `renderHook` and asserts `phase` before measuring — but the two will drift | Extract one shared helper (e.g. `src/utils/contrast.ts`) and import it in both | consider |
| TB1-R8 | `app/(tabs)/_layout.tsx:127` | `outline: none` is unconditional; only `:focus-visible` restores the ring | Correct on all current targets (verified `2px solid rgb(15,23,42)` in V4b), but an engine without `:focus-visible` support would end up with no focus indicator at all, which is the 2.4.7 failure the rule exists to prevent | `outline: 2px solid …` as the base rule and scope the reset to `@supports selector(:focus-visible)`, or keep `[id^="tb1-tab-"]:focus:not(:focus-visible) { outline: none }` | consider |

## VERIFIED OK

- **TB-D5 measurement.** Probes measure the button's *padding* box (`position: absolute; left/right: 0` resolves against the padding box in both Yoga and CSS), and `label +10` vs `slot` is exactly `label ≤ slot − 10 = ` the content box (`styles.button` paddingHorizontal 5 + 5 = `HORIZONTAL_PADDING`). Keying the probe container on `${width}:${fontScale}` forces a remount so every resize re-fires all15 `onLayout`s; `measurements.key !== measurementKey` plus the `currentKey` guard drop post-resize events, identity-equal widths return the previous object, and `setShowLabels` bails on an equal value — no loop, no stuck icon-only. Native is fine: `flexShrink: 0` + `numberOfLines={1}` gives Yoga an unconstrained single-line measure.
- **Prop forwarding and semantics.** `{...props}` follows a three-prop destructure (`children`, `style`, `onBlur`), so `href`, `onPress`, `onLongPress`, `testID`, `aria-label`, `aria-selected`, the Large Content Viewer pair, `android_ripple`, `pressOpacity` and `hoverEffect` all reach `PlatformPressable`; `style` is merged, not replaced (`[style, styles.button]`), and `onBlur` is re-wrapped while still calling through.
- **Space vs Enter vs disabled.** RNW renders an `<a>` when `href != null` (View/index.js:91) and browsers activate anchors on Enter only, so synthesising Space is necessary and Enter is correctly left alone. `preventDefault` on keydown stops page scroll, `spaceDown` + the blur reset prevent double activation and stuck keys, and both handlers guard `props.disabled`.
- **Hidden routes and `backBehavior`.** expo-router's href transform (`TabsClient.js:19-41`) keeps the screen registered and only nulls `tabBarButton`, so the seven §3 call sites still resolve; the layout never sets `tabBarButton` on an `href` screen, which avoids expo-router's `Cannot use 'href' and 'tabBarButton' together` throw. TabRouter de-dupes history by route key (`TabRouter.js:62-64`), so tab history stays bounded; the real-router test plus V3a/V3b cover the switch.
- **Theme and contrast.** Colours come from `useTheme()` per phase; `tabBarContrast.test.ts` renders the *real* hook via `jest.requireActual` and asserts the exact phase before measuring, so it cannot pass against the wrong palette, and the four TB-D2 pairs are all real token-on-`bgCard` checks. No existing assertion was weakened — `git show HEAD:` confirms every prior assertion survives and the screen list is a strict superset.
- **Injected `<style>`.** Guarded by `Platform.OS === 'web'` (no native crash), `app.json` has no `web.output` so there is no SSR/hydration path, the `tb1-` id prefixes cannot collide with app CSS, React owns the node so there is no manual cleanup, and `overflow: hidden` + `minWidth: 0` keep the bar from widening the page (V2a/V2b: `scrollWidth` = 390).
