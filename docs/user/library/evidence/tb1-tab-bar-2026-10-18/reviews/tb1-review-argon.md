
> plan · gemini-4-argon-contributor

→ Read .spec/TB1-REVIEW.md
→ Read .spec/SDD-07-TAB-BAR-UNIT.md
→ Read .spec/TB1-WEB-RESULTS.md
→ Read app/(tabs)/_layout.tsx
→ Read app/(tabs)/__tests__/_layout.test.tsx
→ Read app/(tabs)/__tests__/tabBarContrast.test.ts
→ Read src/hooks/useTheme.ts

$ git status --short && git diff HEAD --stat
M app/(tabs)/__tests__/_layout.test.tsx
 M app/(tabs)/_layout.tsx
?? .spec-out/
?? .spec/
?? app/(tabs)/__tests__/tabBarContrast.test.ts
 app/(tabs)/__tests__/_layout.test.tsx | 355 ++++++++++++++++++++++++++++++++--
 app/(tabs)/_layout.tsx                | 192 ++++++++++++++++--
 2 files changed, 525 insertions(+), 22 deletions(-)

→ Read node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabBar.js
→ Read node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabItem.js
→ Read node_modules/@react-navigation/elements/lib/module/PlatformPressable.js
→ Read node_modules/expo-router/build/layouts/TabsClient.js
→ Read node_modules/expo-router/build/layouts/TabRouter.js
→ Read node_modules/@react-navigation/routers/lib/module/TabRouter.js
→ Read node_modules/react-native-web/dist/exports/Pressable/index.js
→ Read node_modules/react-native-web/dist/exports/Text/index.js
→ Read node_modules/react-native-web/dist/exports/View/index.js
→ Read node_modules/react-native-web/dist/modules/usePressEvents/index.js
→ Read node_modules/react-native-web/dist/modules/usePressEvents/PressResponder.js
→ Read node_modules/react-native-web/dist/modules/useElementLayout/index.js
→ Read node_modules/react-native-web/dist/modules/forwardedProps/index.js
→ Read node_modules/@react-navigation/bottom-tabs/lib/module/views/TabBarIcon.js
→ Read node_modules/react-native-web/dist/exports/createElement/index.js
→ Read node_modules/react-native-web/dist/modules/createDOMProps/index.js

$ npx --no-install jest --runInBand --testPathPattern "app.\(tabs\)" && npx --no-install tsc -p tsconfig.library-notes.json --noEmit
npm notice run booktalks-mobile@1.0.0 npx
npm notice run jest --runInBand --testPathPattern app.\(tabs\)
PASS app/(tabs)/library/__tests__/book-details-corrections.test.tsx (11.164 s)
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

PASS app/(tabs)/library/__tests__/index.test.tsx
PASS app/(tabs)/profile/__tests__/profile.test.tsx
PASS app/(tabs)/library/__tests__/[bookId].test.tsx
PASS app/(tabs)/__tests__/_layout.test.tsx
PASS app/(tabs)/profile/__tests__/edit-profile.test.tsx
PASS app/(tabs)/clubs/__tests__/index.test.tsx
PASS app/(tabs)/profile/__tests__/credit-history.test.tsx
PASS app/(tabs)/exchange/__tests__/transaction-detail.test.tsx
PASS app/(tabs)/profile/__tests__/settings.test.tsx
PASS app/(tabs)/exchange/__tests__/exchange-capabilities.test.tsx
PASS app/(tabs)/profile/__tests__/addresses.test.tsx
PASS app/(tabs)/exchange/__tests__/listing-detail.test.tsx
PASS app/(tabs)/clubs/__tests__/authors.test.tsx
PASS app/(tabs)/profile/__tests__/notification-settings.test.tsx
PASS app/(tabs)/profile/__tests__/notifications.test.tsx
PASS app/(tabs)/__tests__/tabBarContrast.test.ts
PASS app/(tabs)/profile/__tests__/_layout.test.tsx

Test Suites: 19 passed, 19 total
Tests:       157 passed, 157 total
Snapshots:   0 total
Time:        25.639 s
Ran all test suites matching /app.\(tabs\)/i.
npm notice run booktalks-mobile@1.0.0 npx
npm notice run tsc -p tsconfig.library-notes.json --noEmit

→ Read node_modules/expo-router/build/layouts/withLayoutContext.js
→ Read node_modules/@react-navigation/bottom-tabs/lib/typescript/src/types.d.ts

$ git diff HEAD -- app/\(tabs\)/__tests__/_layout.test.tsx
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
+
+beforeEach(() => {
+    tabScreens.length = 0;
+    Platform.OS = 'web';
+    jest.mocked(useTheme).mockReturnValue({ phase: 'daylight', colors: palettes.daylight });
+    jest.mocked(useWindowDimensions).mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
+});
+afterEach(() => { Platform.OS = originalOS; });
+
+const options = (index: number) => tabScreens[index].options!;
+const layout = (ui: ReturnType<typeof render>, id: string, width: number) => {
+    fireEvent(ui.getByTestId(id, { includeHiddenElements: true }), 'layout', {
+        nativeEvent: { layout: { x: 0, y: 0, width, height: 16 } },
     });
+};
+const measure = (ui: ReturnType<typeof render>, slot: number, label = 60) => {
+    act(() => {
+        names.forEach(name => {
+            layout(ui, `tab-probes-${name}`, slot);
+            layout(ui, `tab-probe-${name}-400`, label);
+            layout(ui, `tab-probe-${name}-700`, label + 2);
+        });
+    });
+};

+describe('TabsLayout', () => {
     it('registers primary tabs, omits legacy shims, and hides detail routes', () => {
         render(<TabsLayout />);

@@ -29,9 +98,273 @@ describe('TabsLayout', () => {
             'clubs',
             'profile',
             'marketplace/store/[storeId]',
+            'marketplace/cart',
+            'marketplace/book/[listingId]',
+            'marketplace/requests/index',
+            'marketplace/requests/[requestId]',
         ]);
         expect(tabScreens.find(screen => screen.name === 'credit-history')).toBeUndefined();
         expect(tabScreens.find(screen => screen.name === 'addresses')).toBeUndefined();
         expect(tabScreens.find(screen => screen.name === 'marketplace/store/[storeId]')?.options?.href).toBeNull();
+        expect(tabScreens.filter(screen => screen.options?.href !== null).map(screen => screen.name)).toEqual(routes);
+        for (const name of hidden) {
+            expect(tabScreens.find(screen => screen.name === name)?.options?.href).toBeNull();
+            expect(tabScreens.find(screen => screen.name === name)?.options?.tabBarButton).toBeUndefined();
+        }
+    });
+
+    it('keeps every pushed marketplace destination registered and uses navigation history', () => {
+        render(<TabsLayout />);
+        for (const name of hidden) expect(tabScreens.some(screen => screen.name === name)).toBe(true);
+        expect(tabProps.backBehavior).toBe('history');
+        expect(tabProps.screenOptions.headerShown).toBe(false);
+        expect(tabProps.screenOptions.sceneStyle).toEqual({ backgroundColor: 'transparent' });
+        expect(options(0).title).toBe('Library');
+    });
+
+    it('returns from hidden destinations and switched tabs through the real history router', () => {
+        render(<TabsLayout />);
+        const { TabRouter, TabActions } = jest.requireActual<typeof import('@react-navigation/routers')>('@react-navigation/routers');
+        const router = TabRouter({ backBehavior: tabProps.backBehavior as 'history' });
+        const config = { routeNames: tabScreens.map(screen => screen.name), routeParamList: {}, routeGetIdList: {} };
+        const applyAction = (state: ReturnType<typeof router.getInitialState>, action: Parameters<typeof router.getStateForAction>[1]) => {
+            const next = router.getStateForAction(state, action, config);
+            expect(next).not.toBeNull();
+            return router.getRehydratedState(next!, config);
+        };
+        for (const destination of hidden) {
+            let state = router.getInitialState(config);
+            state = applyAction(state, TabActions.jumpTo('marketplace/index'));
+            state = applyAction(state, TabActions.jumpTo(destination));
+            expect(state.routes[state.index].name).toBe(destination);
+            expect(tabScreens.find(screen => screen.name === state.routes[state.index].name)?.options?.href).toBeNull();
+            state = applyAction(state, { type: 'GO_BACK' });
+            expect(state.routes[state.index].name).toBe('marketplace/index');
+        }
+        let state = router.getInitialState(config);
+        state = applyAction(state, TabActions.jumpTo('clubs'));
+        state = applyAction(state, TabActions.jumpTo('library'));
+        state = applyAction(state, { type: 'GO_BACK' });
+        expect(state.routes[state.index].name).toBe('clubs');
+    });
+
+    it.each(['daylight', 'golden', 'midnight'] as const)('uses real %s theme tokens', phase => {
+        jest.mocked(useTheme).mockReturnValue({ phase, colors: palettes[phase] });
+        render(<TabsLayout />);
+        const colors = palettes[phase];
+        expect(StyleSheet.flatten(tabProps.screenOptions.tabBarStyle)).toMatchObject({
+            backgroundColor: colors.bgCard, borderTopColor: colors.border, maxWidth: '100%',
+        });
+        expect(tabProps.screenOptions.tabBarActiveTintColor).toBe(colors.textPrimary);
+        expect(tabProps.screenOptions.tabBarInactiveTintColor).toBe(colors.textSecondary);
+    });
+
+    it('updates theme options without replacing tab buttons', () => {
+        const ui = render(<TabsLayout />);
+        const button = options(0).tabBarButton;
+        jest.mocked(useTheme).mockReturnValue({ phase: 'midnight', colors: palettes.midnight });
+        ui.rerender(<TabsLayout />);
+        expect(tabProps.screenOptions.tabBarActiveTintColor).toBe(palettes.midnight.textPrimary);
+        expect(options(0).tabBarButton).toBe(button);
+    });
+
+    it('gives every visible tab its full accessible name, stable wrapper and 48dp target', () => {
+        const ui = render(<TabsLayout />);
+        for (const [index, name] of names.entries()) {
+            expect(options(index).tabBarAccessibilityLabel).toBe(name);
+            expect(options(index).tabBarButton).toBe(options(0).tabBarButton);
+            const button = ui.getByTestId(`button-${name}`);
+            expect(button.props.role).toBe('tab');
+            expect(button.props['aria-label']).toBe(name);
+            expect(button.props['aria-selected']).toBe(index === 0);
+            expect(button.props.href).toBe(`/${routes[index]}`);
+            expect(StyleSheet.flatten(button.props.style)).toMatchObject({ minHeight: 48, minWidth: 0 });
+        }
+        expect(StyleSheet.flatten(tabProps.screenOptions.tabBarItemStyle)).toMatchObject({ minWidth: 0, minHeight: 48 });
+        expect(tabProps.screenOptions.tabBarLabelPosition).toBe('below-icon');
+    });
+
+    it.each([
+        ['library-outline', 'library'], ['swap-horizontal-outline', 'swap-horizontal'],
+        ['storefront-outline', 'storefront'], ['people-outline', 'people'], ['person-circle-outline', 'person-circle'],
+    ])('renders decorative %s / %s icons with a reserved 3px indicator', (outline, filled) => {
+        render(<TabsLayout />);
+        const index = ['library', 'swap-horizontal', 'storefront', 'people', 'person-circle'].indexOf(filled);
+        const icon = options(index).tabBarIcon!;
+        const inactive = render(<>{icon({ focused: false, color: '#123456', size: 12 })}</>);
+        const active = render(<>{icon({ focused: true, color: '#654321', size: 12 })}</>);
+        expect(inactive.getByTestId('tab-icon', { includeHiddenElements: true }).props).toMatchObject({ name: outline, size: 24, color: '#123456', accessible: false });
+        expect(active.getByTestId('tab-icon', { includeHiddenElements: true }).props).toMatchObject({ name: filled, size: 24, color: '#654321', accessible: false });
+        const inactiveMark = StyleSheet.flatten(inactive.getByTestId('tab-indicator', { includeHiddenElements: true }).props.style);
+        const activeMark = StyleSheet.flatten(active.getByTestId('tab-indicator', { includeHiddenElements: true }).props.style);
+        expect(activeMark).toMatchObject({ height: 3, backgroundColor: palettes.daylight.accent, opacity: 1 });
+        expect(inactiveMark).toEqual({ ...activeMark, opacity: 0 });
+        expect(active.getByTestId('tab-icon-frame', { includeHiddenElements: true }).props['aria-hidden']).toBe(true);
+        expect(StyleSheet.flatten(active.getByTestId('tab-icon-frame', { includeHiddenElements: true }).props.style).height).toBe(28);
+    });
+
+    it.each([false, true])('applies 12/16, weight and supplied tint inside the label callback (focused=%s)', focused => {
+        render(<TabsLayout />);
+        const label = options(0).tabBarLabel;
+        expect(typeof label).toBe('function');
+        if (typeof label !== 'function') throw new Error('Missing label callback');
+        const ui = render(<>{label({ focused, color: '#123456', position: 'below-icon', children: 'Library' })}</>);
+        const text = ui.getByText('Library');
+        expect(StyleSheet.flatten(text.props.style)).toMatchObject({
+            fontSize: 12, lineHeight: 16, fontWeight: focused ? '700' : '400', color: '#123456',
+        });
+        expect(text.props.numberOfLines).toBe(1);
+        expect(text.props.ellipsizeMode).toBe('clip');
+        expect(text.props.adjustsFontSizeToFit).not.toBe(true);
+        expect(text.props.allowFontScaling).toBe(true);
+    });
+
+    it('preserves iOS non-scaling labels and matching measurement probes', () => {
+        Platform.OS = 'ios';
+        const ui = render(<TabsLayout />);
+        const label = options(0).tabBarLabel;
+        if (typeof label !== 'function') throw new Error('Missing label callback');
+        const rendered = render(<>{label({ focused: true, color: '#123456', position: 'below-icon', children: 'Library' })}</>);
+        expect(rendered.getByText('Library').props.allowFontScaling).toBe(false);
+        expect(ui.getByTestId('tab-probe-Library-700', { includeHiddenElements: true }).props.allowFontScaling).toBe(false);
+    });
+
+    it('hides all labels for one bold overflow, keeps accessible names, and restores them after fitting', () => {
+        const ui = render(<TabsLayout />);
+        measure(ui, 78);
+        expect(tabProps.screenOptions.tabBarShowLabel).toBe(true);
+        layout(ui, 'tab-probe-Marketplace-700', 69);
+        expect(tabProps.screenOptions.tabBarShowLabel).toBe(false);
+        names.forEach((name, index) => {
+            expect(options(index).tabBarAccessibilityLabel).toBe(name);
+            expect(ui.getByTestId(`tab-probe-${name}-400`, { includeHiddenElements: true })).toBeTruthy();
+            expect(ui.getByTestId(`tab-probe-${name}-700`, { includeHiddenElements: true })).toBeTruthy();
+        });
+        layout(ui, 'tab-probe-Marketplace-700', 68);
+        expect(tabProps.screenOptions.tabBarShowLabel).toBe(true);
+    });
+
+    it('keeps the initial labels until the complete first measurement arrives', () => {
+        const ui = render(<TabsLayout />);
+        layout(ui, 'tab-probes-Marketplace', 39);
+        layout(ui, 'tab-probe-Marketplace-700', 90);
+        expect(tabProps.screenOptions.tabBarShowLabel).toBe(true);
+        measure(ui, 39);
+        expect(tabProps.screenOptions.tabBarShowLabel).toBe(false);
+    });
+
+    it.each(['width', 'fontScale'] as const)('remeasures on %s changes without flickering or remounting the button', dimension => {
+        const ui = render(<TabsLayout />);
+        measure(ui, 39);
+        expect(tabProps.screenOptions.tabBarShowLabel).toBe(false);
+        const button = ui.getByTestId('button-Library');
+        const oldProbe = ui.getByTestId('tab-probe-Library-400', { includeHiddenElements: true });
+        const staleLayout = oldProbe.props.onLayout;
+        jest.mocked(useWindowDimensions).mockReturnValue({ width: dimension === 'width' ? 780 : 390,
+            height: 844, scale: 1, fontScale: dimension === 'fontScale' ? 1.3 : 1 });
+        ui.rerender(<TabsLayout />);
+        expect(ui.getByTestId('button-Library')).toBe(button);
+        expect(ui.getByTestId('tab-probe-Library-400', { includeHiddenElements: true })).not.toBe(oldProbe);
+        expect(tabProps.screenOptions.tabBarShowLabel).toBe(false);
+        layout(ui, 'tab-probes-Library', 156);
+        expect(tabProps.screenOptions.tabBarShowLabel).toBe(false);
+        measure(ui, 156);
+        expect(tabProps.screenOptions.tabBarShowLabel).toBe(true);
+        act(() => staleLayout({ nativeEvent: { layout: { width: 1000 } } }));
+        expect(tabProps.screenOptions.tabBarShowLabel).toBe(true);
+    });
+
+    it('clips persistent measurement layers within each shrinking slot and hides them from accessibility', () => {
+        const ui = render(<TabsLayout />);
+        for (const name of names) {
+            const layer = ui.getByTestId(`tab-probes-${name}`, { includeHiddenElements: true });
+            expect(StyleSheet.flatten(layer.props.style)).toMatchObject({
+                position: 'absolute', left: 0, right: 0, maxWidth: '100%', overflow: 'hidden', opacity: 0,
+            });
+            expect(layer.props.pointerEvents).toBe('none');
+            expect(layer.props['aria-hidden']).toBe(true);
+            expect(layer.props.importantForAccessibility).toBe('no-hide-descendants');
+            for (const weight of ['400', '700']) {
+                const probe = ui.getByTestId(`tab-probe-${name}-${weight}`, { includeHiddenElements: true });
+                expect(StyleSheet.flatten(probe.props.style)).toMatchObject({ fontSize: 12, lineHeight: 16, fontWeight: weight, flexShrink: 0 });
+            }
+        }
+    });
+
+    it('uses only :focus-visible for the web ring and places it inside the button', () => {
+        const ui = render(<TabsLayout />);
+        const css = ui.UNSAFE_getByType('style' as unknown as typeof View).props.children as string;
+        expect(css).toContain(':focus-visible');
+        expect(css).toContain(`outline: 2px solid ${palettes.daylight.textPrimary}`);
+        expect(css).toContain('outline-offset: -3px');
+        // RN-web's numberOfLines=1 applies maxWidth:100%; probes must measure
+        // their natural width rather than inheriting that cap from the slot.
+        expect(css).toContain('width: max-content; max-width: none; white-space: nowrap');
+        expect(css).not.toMatch(/:focus\s*\{|:active|:hover/);
+        Platform.OS = 'android';
+        ui.rerender(<TabsLayout />);
+        expect(ui.UNSAFE_queryByType('style' as unknown as typeof View)).toBeNull();
+        expect(ui.getByTestId('button-Library').props.onKeyDown).toBeUndefined();
+    });
+
+    it('forwards handlers and styles, and Space activates once on release without handling Enter twice', () => {
+        render(<TabsLayout />);
+        const renderButton = options(0).tabBarButton!;
+        const onPress = jest.fn();
+        const onLongPress = jest.fn();
+        const onBlur = jest.fn();
+        const onLayout = jest.fn();
+        const props = { children: <Text>child</Text>, href: '/library', 'aria-label': 'Library',
+            'aria-selected': true, onPress, onLongPress, onBlur, onLayout, style: { marginTop: 2 }, testID: 'forwarded' };
+        const ui = render(<>{renderButton(props)}</>);
+        const button = ui.getByTestId('forwarded');
+        expect(button.props.onPress).toBe(onPress);
+        expect(button.props.onLongPress).toBe(onLongPress);
+        expect(button.props.onLayout).toBe(onLayout);
+        expect(StyleSheet.flatten(button.props.style).marginTop).toBe(2);
+        fireEvent.press(button);
+        expect(onPress).toHaveBeenCalledTimes(1);
+        onPress.mockClear();
+        const click = jest.fn(() => onPress());
+        const event = { key: ' ', repeat: false, preventDefault: jest.fn(), currentTarget: { click } };
+        fireEvent(button, 'keyDown', event);
+        fireEvent(button, 'keyDown', { ...event, repeat: true });
+        expect(click).not.toHaveBeenCalled();
+        fireEvent(button, 'keyUp', event);
+        fireEvent(button, 'keyUp', event);
+        expect(click).toHaveBeenCalledTimes(1);
+        expect(onPress).toHaveBeenCalledTimes(1);
+        expect(event.preventDefault).toHaveBeenCalled();
+        fireEvent(button, 'keyDown', { ...event, key: 'Enter' });
+        fireEvent(button, 'keyUp', { ...event, key: 'Enter' });
+        expect(click).toHaveBeenCalledTimes(1);
+        fireEvent(button, 'keyDown', event);
+        fireEvent(button, 'blur', {});
+        fireEvent(button, 'keyUp', event);
+        expect(click).toHaveBeenCalledTimes(1);
+        expect(onBlur).toHaveBeenCalledTimes(1);
+        ui.rerender(<>{renderButton({ ...props, disabled: true })}</>);
+        fireEvent(ui.getByTestId('forwarded'), 'keyDown', event);
+        fireEvent(ui.getByTestId('forwarded'), 'keyUp', event);
+        expect(click).toHaveBeenCalledTimes(1);
+    });
+});
+
+describe('decideIconOnly', () => {
+    it('uses one overflowing label to select icon-only for the entire bar', () => {
+        expect(decideIconOnly({ slotWidths: [78, 78, 78, 78, 78], labelWidths: [40, 50, 69, 30, 40], horizontalPadding: 10 })).toBe(true);
+    });
+    it('keeps labels when all fit, including exact fits and unequal slots', () => {
+        expect(decideIconOnly({ slotWidths: [78, 90], labelWidths: [68, 80], horizontalPadding: 10 })).toBe(false);
+    });
+    it.each([
+        { slotWidths: [], labelWidths: [] },
+        { slotWidths: [78, undefined], labelWidths: [40, 90] },
+        { slotWidths: [78, 78], labelWidths: [40, undefined] },
+        { slotWidths: [78, 78], labelWidths: [40] },
+        { slotWidths: [0], labelWidths: [90] },
+        { slotWidths: [78], labelWidths: [Number.NaN] },
+    ])('defaults to labels while measurements are incomplete: %j', values => {
+        expect(decideIconOnly({ ...values, horizontalPadding: 10 })).toBe(false);
     });
 });

## VERDICT
Safe to commit (apart from the pending label decision): YES WITH FIXES. The TB-D1 through TB-D5 architecture, web ResizeObserver measurement, Space/Enter activation, theme contrast, and route history are solid, but native probe measurement is capped to the slot width when `right: 0` constrains `probeRow`, and `TabBarButton` overrides `@react-navigation/bottom-tabs`'s iOS `role="button"` workaround and drops caller-supplied `onKeyDown`/`onKeyUp`.

## FINDINGS
| id | file:line | problem | evidence (what you checked) | concrete fix | severity |
|---|---|---|---|---|---|
| F1 | `app/(tabs)/_layout.tsx:185` | On native (Android), `probeRow` has `left: 0, right: 0, flexDirection: 'row'`, constraining its width to `styles.probes` (the slot width). Unlike web (which overrides `max-width: none; width: max-content` via CSS), Yoga's `numberOfLines={1}` text baseline pass clamps single-line `Text` layout to the parent's constrained inner width despite `flexShrink: 0`, so `onLayout` can report at most `slotWidth` and miss overflows > `slotWidth - 10`. | Checked `_layout.tsx:74-80, 129, 181-186` and `Text/index.js:168-174`. Web relies on `[id^="tb1-probe-"] { width: max-content; max-width: none; }` because `probeRow` is otherwise slot-bounded. | Remove `right: 0` from `styles.probeRow` (or set `width: 9999` on `probeRow` inside the `overflow: 'hidden'` `probes` container) so Yoga gives `Text` an unconstrained horizontal measure pass on native. | must-fix |
| F2 | `app/(tabs)/_layout.tsx:63` | `role="tab"` is hardcoded after `{...props}`, overriding `BottomTabItem`'s explicit `Platform.select({ ios: 'button', default: 'tab' })` workaround for iOS VoiceOver. | Checked `@react-navigation/bottom-tabs` `BottomTabItem.js:136-140` (`// FIXME: role: 'tab' doesn't seem to work as expected on iOS`). | Remove `role="tab"` on line 63 (or use `role={Platform.OS === 'ios' ? props.role : 'tab'}`) so `BottomTabItem`'s platform role is preserved on iOS while web/Android still receive `role="tab"`. | should-fix |
| F3 | `app/(tabs)/_layout.tsx:45-63` | `{...webKeys}` is spread after `{...props}`, silently overwriting any `onKeyDown` or `onKeyUp` passed in `BottomTabBarButtonProps` instead of composing them like `onBlur` on line 64. | Checked `_layout.tsx:39-64` and `@react-navigation/bottom-tabs` `types.d.ts:321` (`BottomTabBarButtonProps` includes `PlatformPressable` props). | Destructure `onKeyDown, onKeyUp` in `TabBarButton` and call `onKeyDown?.(event)` / `onKeyUp?.(event)` inside `webKeys`. | consider |
| F4 | `app/(tabs)/_layout.tsx:92-94` | `measurementKey` omits `insets.left` and `insets.right`; `BottomTabBar` applies `paddingHorizontal: Math.max(insets.left, insets.right)` which shrinks slots on rotation without changing `measurementKey`, though `ResizeObserver` / `onLayout` on `probes` still fires and updates `values['*:slot']`. | Checked `BottomTabBar.js:253` and `_layout.tsx:93-109`. `onLayout` on `tab-probes-${name}` still fires when safe-area horizontal insets change, so slots re-record, but stale slot widths briefly coexist with new ones across the 5 tabs. | Include `left` and `right` from `useSafeAreaInsets()` in `measurementKey` (`${width}:${fontScale}:${left}:${right}`). | consider |

## VERIFIED OK
- **No measurement loop or stuck icon-only state (`_layout.tsx:67-82, 101-122`):** `tab-probes-${name}` stays mounted inside `TabBarButton` regardless of `showLabels` (`BottomTabItem.js:68-70` only unmounts the visible label when `showLabel === false`), and `record` short-circuits when `values[id] === measuredWidth`, preventing render loops and allowing labels to restore when the viewport widens.
- **Slot width vs. padding (`_layout.tsx:70, 177-184`, `BottomTabItem.js:170`):** `styles.probes` has `position: 'absolute', left: 0, right: 0` inside `PlatformPressable` (`box-sizing: border-box`), so `onLayout` measures the full button padding-box width (`slot`), and `decideIconOnly` accurately compares `labelWidth + HORIZONTAL_PADDING > slot` (accounting for the 5px left + 5px right padding in `styles.button`).
- **Space / Enter / link semantics (`_layout.tsx:45-60`, `PlatformPressable.js:43-59`, `PressResponder.js:66-72, 209-256`, `createDOMProps/index.js:784-791`):** With `href` and `role="tab"`, `react-native-web` renders `<a role="tab">`; `PressResponder.isValidKeyPress` ignores Space when `role="tab"` and ignores Enter on `<a>` in `keyupHandler`, so dispatching a single `.click()` on Space `keyUp` (with `repeat`, `disabled`, and `onBlur` guards) activates `PlatformPressable.handlePress` once without double-firing Enter or breaking modifier-clicks.
- **Web `<style>` injection (`_layout.tsx:126-130`, `withLayoutContext.js:49-94`):** Rendered as a sibling above `<Tabs>` inside `MeasurementContext.Provider` (not as a child of `<Tabs>`, avoiding `useFilterScreenChildren` warnings), gated by `Platform.OS === 'web'` (no native crash), scoped to `[id^="tb1-tab-"]` and `[id^="tb1-probe-"]`, and cleaned up on unmount by React DOM.
- **Hidden routes & `backBehavior="history"` (`_layout.tsx:131, 165-169`, `TabsClient.js:18-40`, `TabRouter.js:58-87, 262-288`):** `href: null` hides the tab item (`display: 'none'`, `tabBarButton: () => null`) while keeping all 5 detail routes registered in `TabRouter`; `backBehavior="history"` deduplicates route keys in `state.history` and returns to the prior route on `GO_BACK` (verified against the real `TabRouter` in `_layout.test.tsx:125-149`).
- **Theme & test integrity (`tabBarContrast.test.ts:14-35`, `_layout.test.tsx:53-64, 91-114`, `git status`):** Both test suites call `jest.requireActual('@/hooks/useTheme')` with fake timers at hours 12/18/23 to pull real unmocked `THEME_COLORS` tokens per phase; all original `_layout.test.tsx` assertions are preserved and strengthened, all 19 tab test suites (157 tests) and `tsc --noEmit` pass, and changes are strictly confined to the 3 authorized files.
