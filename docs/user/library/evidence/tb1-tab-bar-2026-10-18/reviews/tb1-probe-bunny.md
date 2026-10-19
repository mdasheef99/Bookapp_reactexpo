
> plan · space-bunny-free

→ Read .spec/TB1-PROBE.md
I'll start by reading the probe specification file.
This is a no-edit probe. Let me gather the required context.
→ Read .spec/SDD-07-TAB-BAR-UNIT.md
→ Read src/hooks/useTheme.ts
→ Read app/(tabs)/_layout.tsx
→ Read app/(tabs)/__tests__/_layout.test.tsx
✱ Grep "THEME_COLORS" in . · 8 matches

$ ls app/\(tabs\)/marketplace/; echo "---requests---"; ls app/\(tabs\)/marketplace/requests/ 2>/dev/null; echo "---branch---"; git status --short | head -30; git rev-parse --abbrev-ref HEAD
book
cart.tsx
index.tsx
requests
store
---requests---
[requestId].tsx
index.tsx
---branch---
?? .spec-out/
?? .spec/
sdd07/tab-bar

$ ls node_modules/@react-navigation/bottom-tabs/lib/typescript/ 2>/dev/null; echo "---VERSIONS---"; node -e "const p=require('./package.json');console.log(JSON.stringify({expo:p.dependencies?.expo,'expo-router':p.dependencies?.['expo-router'],'react-native':p.dependencies?.['react-native'],'react-navigation-bottom-tabs':p.dependencies?.['@react-navigation/bottom-tabs'],vector:p.dependencies?.['@expo/vector-icons'],jest:p.devDependencies?.jest,'testing-library':p.devDependencies?.['@testing-library/react-native']},null,2))"; echo "---INSTALLED---"; node -e "for(const m of ['expo-router','@react-navigation/bottom-tabs','@react-navigation/routers','@expo/vector-icons','react-native','jest']){try{console.log(m, require('./node_modules/'+m+'/package.json').version)}catch(e){console.log(m,'MISSING')}}"
package.json
src
---VERSIONS---
{
  "expo": "~54.0.36",
  "expo-router": "~6.0.24",
  "react-native": "0.81.5",
  "vector": "~15.0.3",
  "testing-library": "^13.3.3"
}
---INSTALLED---
expo-router 6.0.24
@react-navigation/bottom-tabs 7.15.9
@react-navigation/routers 7.5.3
@expo/vector-icons 15.0.3
react-native 0.81.5
jest 29.7.0

✱ Grep "tabBarAccessibilityLabel|tabBarButton|tabBarShowLabel|tabBarLabelStyle|tabBarIconStyle|tabBarItemStyle" in node_modules/@react-navigation/bottom-tabs · 9 matches

$ ls -R node_modules/@react-navigation/bottom-tabs/lib/typescript/src 2>/dev/null | head -40; echo "===EXPO-ROUTER TABS==="; ls node_modules/expo-router/build/layouts/ 2>/dev/null | head -40
node_modules/@react-navigation/bottom-tabs/lib/typescript/src:
TransitionConfigs
index.d.ts
index.d.ts.map
navigators
types.d.ts
types.d.ts.map
unstable
utils
views

node_modules/@react-navigation/bottom-tabs/lib/typescript/src/TransitionConfigs:
SceneStyleInterpolators.d.ts
SceneStyleInterpolators.d.ts.map
TransitionPresets.d.ts
TransitionPresets.d.ts.map
TransitionSpecs.d.ts
TransitionSpecs.d.ts.map

node_modules/@react-navigation/bottom-tabs/lib/typescript/src/navigators:
createBottomTabNavigator.d.ts
createBottomTabNavigator.d.ts.map

node_modules/@react-navigation/bottom-tabs/lib/typescript/src/unstable:
NativeBottomTabView.d.ts
NativeBottomTabView.d.ts.map
NativeBottomTabView.native.d.ts
NativeBottomTabView.native.d.ts.map
NativeScreen
createNativeBottomTabNavigator.d.ts
createNativeBottomTabNavigator.d.ts.map
createNativeBottomTabNavigator.native.d.ts
createNativeBottomTabNavigator.native.d.ts.map
index.d.ts
index.d.ts.map
types.d.ts
types.d.ts.map

node_modules/@react-navigation/bottom-tabs/lib/typescript/src/unstable/NativeScreen:
NativeScreen.d.ts
===EXPO-ROUTER TABS===
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

→ Read node_modules/@react-navigation/bottom-tabs/lib/typescript/src/types.d.ts [limit=240]

$ grep -n "backBehavior" node_modules/@react-navigation/bottom-tabs/lib/typescript/src/types.d.ts node_modules/@react-navigation/routers/lib/typescript/src/TabRouter.d.ts 2>/dev/null; echo "===JS TabRouter default==="; grep -n "backBehavior\|'firstRoute'\|history\|initialRoute" node_modules/@react-navigation/routers/lib/module/TabRouter.js | head -30
node_modules/@react-navigation/routers/lib/typescript/src/TabRouter.d.ts:22:    backBehavior?: BackBehavior;
node_modules/@react-navigation/routers/lib/typescript/src/TabRouter.d.ts:60:export declare function TabRouter({ initialRouteName, backBehavior, }: TabRouterOptions): Router<TabNavigationState<ParamListBase>, import("./CommonActions").Action | TabActionType>;
===JS TabRouter default===
18:const getRouteHistory = (routes, index, backBehavior, initialRouteName) => {
19:  const history = [{
23:  let initialRouteIndex;
24:  switch (backBehavior) {
27:        history.unshift({
33:    case 'firstRoute':
35:        history.unshift({
41:    case 'initialRoute':
42:      initialRouteIndex = routes.findIndex(route => route.name === initialRouteName);
43:      initialRouteIndex = initialRouteIndex === -1 ? 0 : initialRouteIndex;
44:      if (index !== initialRouteIndex) {
45:        history.unshift({
47:          key: routes[initialRouteIndex].key
51:    case 'history':
53:      // The history will fill up on navigation
56:  return history;
58:const changeIndex = (state, index, backBehavior, initialRouteName) => {
59:  let history = state.history;
60:  if (backBehavior === 'history' || backBehavior === 'fullHistory') {
62:    if (backBehavior === 'history') {
63:      // Remove the existing key from the history to de-duplicate it
64:      history = history.filter(it => it.type === 'route' ? it.key !== currentRoute.key : false);
65:    } else if (backBehavior === 'fullHistory') {
66:      const lastHistoryRouteItemIndex = history.findLastIndex(item => item.type === 'route');
67:      if (currentRoute.key === history[lastHistoryRouteItemIndex]?.key) {
68:        // For full-history, only remove if it matches the last route
69:        // Useful for drawer, if current route was in history, then drawer state changed
71:        history = [...history.slice(0, lastHistoryRouteItemIndex), ...history.slice(lastHistoryRouteItemIndex + 1)];
74:    history = history.concat({
77:      params: backBehavior === 'fullHistory' ? currentRoute.params : undefined

$ grep -n "accessibilityRole\|accessibilityState\|tabBarAccessibilityLabel\|tabBarShowLabel\|tabBarButton\|tabBarItemStyle\|tabBarLabelStyle\|tabBarIconStyle\|tabBarLabelPosition" node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabBar.js
23:    tabBarLabelPosition
25:  if (tabBarLabelPosition) {
26:    switch (tabBarLabelPosition) {
37:        tabBarItemStyle
39:      const flattenedStyle = StyleSheet.flatten(tabBarItemStyle);
123:    tabBarShowLabel,
124:    tabBarLabelPosition,
138:  if (tabBarLabelPosition === 'below-icon' && tabBarVariant === 'uikit' && (tabBarPosition === 'left' || tabBarPosition === 'right')) {
292:        const accessibilityLabel = options.tabBarAccessibilityLabel !== undefined ? options.tabBarAccessibilityLabel : typeof label === 'string' && Platform.OS === 'ios' ? `${label}, tab, ${index + 1} of ${routes.length}` : undefined;
308:            testID: options.tabBarButtonTestID,
314:            button: options.tabBarButton,
325:            showLabel: tabBarShowLabel,
326:            labelStyle: options.tabBarLabelStyle,
327:            iconStyle: options.tabBarIconStyle,
330:            } : styles.bottomItem, options.tabBarItemStyle]

$ grep -n "backBehavior\|detachInactiveScreens\|screenOptions\|tabBarPosition\|href" node_modules/expo-router/build/layouts/Tabs.js | head -40; echo "=== Tabs.d.ts ==="; cat node_modules/expo-router/build/layouts/Tabs.d.ts
=== Tabs.d.ts ===
import Tabs from './TabsClient';
export { Tabs };
export default Tabs;
//# sourceMappingURL=Tabs.d.ts.map

→ Read node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabBar.js [offset=270, limit=70]

$ grep -rn "accessibilityRole\|accessibilityState\|aria-selected\|role" node_modules/@react-navigation/elements/lib/commonjs/PlatformPressable.js | head -30
grep: node_modules/@react-navigation/elements/lib/commonjs/PlatformPressable.js: No such file or directory

$ ls node_modules/@react-navigation/elements/lib/; echo "---"; find node_modules/@react-navigation/elements -name "PlatformPressable*" | head
module
typescript
---
node_modules/@react-navigation/elements/lib/module/PlatformPressable.js
node_modules/@react-navigation/elements/lib/module/PlatformPressable.js.map
node_modules/@react-navigation/elements/lib/typescript/src/PlatformPressable.d.ts
node_modules/@react-navigation/elements/lib/typescript/src/PlatformPressable.d.ts.map
node_modules/@react-navigation/elements/src/PlatformPressable.tsx

$ grep -rn "accessibilityRole\|accessibilityState\|role=\|aria-selected" node_modules/@react-navigation/elements/lib/module/PlatformPressable.js 2>/dev/null | head -30; echo "=== BottomTabItem ==="; find node_modules/@react-navigation/bottom-tabs -name "BottomTabItem*" | head
=== BottomTabItem ===
node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabItem.js
node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabItem.js.map
node_modules/@react-navigation/bottom-tabs/lib/typescript/src/views/BottomTabItem.d.ts
node_modules/@react-navigation/bottom-tabs/lib/typescript/src/views/BottomTabItem.d.ts.map
node_modules/@react-navigation/bottom-tabs/src/views/BottomTabItem.tsx

$ grep -n "accessibilityRole\|accessibilityState\|role\|aria-\|focusable\|href" node_modules/@react-navigation/elements/src/PlatformPressable.tsx
21:  href?: string;
78:    if (Platform.OS === 'web' && rest.href !== null) {
121:      role={Platform.OS === 'web' && rest.href != null ? 'link' : 'button'}
200:      <style href={CLASS_NAME} precedence="elements">

$ grep -n "accessibilityRole\|accessibilityState\|accessibilityLabel\|PlatformPressable\|button\|onPress\|style=" node_modules/@react-navigation/bottom-tabs/src/views/BottomTabItem.tsx
1:import { getLabel, Label, PlatformPressable } from '@react-navigation/elements';
67:   * The button for the tab. Uses a `Pressable` by default.
69:  button?: (props: BottomTabBarButtonProps) => React.ReactNode;
73:  accessibilityLabel?: string;
82:  onPress: (
147:  <PlatformPressable {...props} />
162:  button = renderButtonDefault,
163:  accessibilityLabel,
165:  onPress,
252:        style={[
300:        style={iconStyle}
323:      style={[
332:      {button({
334:        onPress,
337:        'aria-label': accessibilityLabel,
341:        'role': Platform.select({ ios: 'button', default: 'tab' }),

→ Read node_modules/@react-navigation/elements/src/PlatformPressable.tsx [offset=60, limit=150]
→ Read node_modules/@react-navigation/bottom-tabs/src/views/BottomTabItem.tsx [offset=300, limit=60]

$ node -e "console.log('rnw', require('./node_modules/react-native-web/package.json').version)"; echo "=== TabsClient children handling ==="; grep -n "Children\|Screen\|Fragment\|React.isValidElement" node_modules/expo-router/build/layouts/TabsClient.js | head -30
rnw 0.21.2
=== TabsClient children handling ===
48:    Screen: ExpoTabs.Screen,

$ grep -rln "contrast\|relativeLuminance" src/features/books/**/__tests__/*.ts* src/**/__tests__/*.ts* 2>/dev/null | head -20; echo "=== registry tests ==="; find src -path "*__tests__*" -name "*contrast*" -o -path "*__tests__*" -name "*registry*" | head -20
src/features/books/utils/__tests__/shelfLayout.test.ts
=== registry tests ===

$ cat node_modules/expo-router/build/layouts/TabsClient.js
"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bottom_tabs_1 = require("@react-navigation/bottom-tabs");
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const withLayoutContext_1 = require("./withLayoutContext");
const Link_1 = require("../link/Link");
const TabRouter_1 = require("./TabRouter");
const Protected_1 = require("../views/Protected");
// This is the only way to access the navigator.
const BottomTabNavigator = (0, bottom_tabs_1.createBottomTabNavigator)().Navigator;
const ExpoTabs = (0, withLayoutContext_1.withLayoutContext)(BottomTabNavigator, (screens) => {
    // Support the `href` shortcut prop.
    return screens.map((screen) => {
        if (typeof screen.options !== 'function' && screen.options?.href !== undefined) {
            const { href, ...options } = screen.options;
            if (options.tabBarButton) {
                throw new Error('Cannot use `href` and `tabBarButton` together.');
            }
            return {
                ...screen,
                options: {
                    ...options,
                    tabBarItemStyle: href == null ? { display: 'none' } : options.tabBarItemStyle,
                    // @ts-expect-error: TODO(@kitten): This isn't properly typed
                    tabBarButton: (props) => {
                        if (href == null) {
                            return null;
                        }
                        const children = react_native_1.Platform.OS === 'web' ? props.children : <react_native_1.Pressable>{props.children}</react_native_1.Pressable>;
                        // TODO: React Navigation types these props as Animated.WithAnimatedValue<StyleProp<ViewStyle>>
                        //       While Link expects a TextStyle. We need to reconcile these types.
                        return (<Link_1.Link {...props} style={[{ display: 'flex' }, props.style]} href={href} asChild={react_native_1.Platform.OS !== 'web'} children={children}/>);
                    },
                },
            };
        }
        return screen;
    });
});
const Tabs = Object.assign((props) => {
    return <ExpoTabs {...props} UNSTABLE_router={TabRouter_1.tabRouterOverride}/>;
}, {
    Screen: ExpoTabs.Screen,
    Protected: Protected_1.Protected,
});
exports.default = Tabs;
//# sourceMappingURL=TabsClient.js.map

$ grep -rn "contrastRatio\|luminance\|getContrast" src/features/books/utils/__tests__/shelfLayout.test.ts | head -20; echo "=== impl ==="; find src -name "shelfLayout*" -not -path "*__tests__*" | head
260:    const luminance = (hex: string) => {
269:        const pair = [luminance(background), luminance(spineTextColor(background))].sort((a, b) => b - a);
=== impl ===
src/features/books/utils/shelfLayout.ts

$ grep -n "role\|aria-\|accessibility\|asChild\|Pressable\|href" node_modules/expo-router/build/link/Link.js | head -40
6:const href_1 = require("./href");
9: * Component that renders a link using [`href`](#href) to another route.
28: *    <Link href="/about">About</Link>
38:    resolveHref: href_1.resolveHref,

$ cat node_modules/expo-router/build/layouts/withLayoutContext.js
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.useFilterScreenChildren = useFilterScreenChildren;
exports.withLayoutContext = withLayoutContext;
const react_1 = __importStar(require("react"));
const Route_1 = require("../Route");
const NativeTabTrigger_1 = require("../native-tabs/NativeBottomTabs/NativeTabTrigger");
const useScreens_1 = require("../useScreens");
const Protected_1 = require("../views/Protected");
const Screen_1 = require("../views/Screen");
function useFilterScreenChildren(children, { isCustomNavigator, contextKey, } = {}) {
    return (0, react_1.useMemo)(() => {
        const customChildren = [];
        const screens = [];
        const protectedScreens = new Set();
        function flattenChild(child, exclude = false) {
            if ((0, Screen_1.isScreen)(child, contextKey)) {
                if (exclude) {
                    protectedScreens.add(child.props.name);
                }
                else {
                    screens.push(child.props);
                }
                return;
            }
            if ((0, NativeTabTrigger_1.isNativeTabTrigger)(child, contextKey)) {
                if (exclude) {
                    protectedScreens.add(child.props.name);
                }
                else {
                    const options = (0, NativeTabTrigger_1.convertTabPropsToOptions)(child.props);
                    if (options.hidden === false) {
                        screens.push({
                            ...child.props,
                            options: (0, NativeTabTrigger_1.convertTabPropsToOptions)(child.props),
                        });
                    }
                    else {
                        // - hidden = undefined -> then the route was not specified in navigator
                        // - hidden = true -> then the route is hidden
                        // In this cases we should treat the tab as protected
                        protectedScreens.add(child.props.name);
                    }
                }
                return;
            }
            if ((0, Protected_1.isProtectedReactElement)(child)) {
                const excludeChildren = exclude || !child.props.guard;
                react_1.Children.forEach(child.props.children, (protectedChild) => {
                    flattenChild(protectedChild, excludeChildren);
                });
                return;
            }
            if (isCustomNavigator) {
                customChildren.push(child);
                return null;
            }
            console.warn(`Layout children must be of type Screen, all other children are ignored. To use custom children, create a custom <Layout />. Update Layout Route at: "app${contextKey}/_layout"`);
            return null;
        }
        react_1.Children.forEach(children, (child) => flattenChild(child));
        // Add an assertion for development
        if (process.env.NODE_ENV !== 'production') {
            // Assert if names are not unique
            const names = screens?.map((screen) => screen && typeof screen === 'object' && 'name' in screen && screen.name);
            if (names && new Set(names).size !== names.length) {
                throw new Error('Screen names must be unique: ' + names);
            }
        }
        return {
            screens,
            children: customChildren,
            protectedScreens,
        };
    }, [children]);
}
/**
 * Returns a navigator that automatically injects matched routes and renders nothing when there are no children.
 * Return type with `children` prop optional.
 *
 * Enables use of other built-in React Navigation navigators and other navigators built with the React Navigation custom navigator API.
 *
 * @param Nav - The navigator component to wrap.
 * @param processor - A function that processes the screens before passing them to the navigator.
 * @param useOnlyUserDefinedScreens - If true, all screens not specified as navigator's children will be ignored.
 *
 *  @example
 * ```tsx app/_layout.tsx
 * import { ParamListBase, TabNavigationState } from "@react-navigation/native";
 * import {
 *   createMaterialTopTabNavigator,
 *   MaterialTopTabNavigationOptions,
 *   MaterialTopTabNavigationEventMap,
 * } from "@react-navigation/material-top-tabs";
 * import { withLayoutContext } from "expo-router";
 *
 * const MaterialTopTabs = createMaterialTopTabNavigator();
 *
 * const ExpoRouterMaterialTopTabs = withLayoutContext<
 *   MaterialTopTabNavigationOptions,
 *   typeof MaterialTopTabs.Navigator,
 *   TabNavigationState<ParamListBase>,
 *   MaterialTopTabNavigationEventMap
 * >(MaterialTopTabs.Navigator);

 * export default function TabLayout() {
 *   return <ExpoRouterMaterialTopTabs />;
 * }
 * ```
 */
function withLayoutContext(Nav, processor, useOnlyUserDefinedScreens = false) {
    return Object.assign((0, react_1.forwardRef)(({ children: userDefinedChildren, ...props }, ref) => {
        const contextKey = (0, Route_1.useContextKey)();
        const { screens, protectedScreens } = useFilterScreenChildren(userDefinedChildren, {
            contextKey,
        });
        const processed = processor ? processor(screens ?? []) : screens;
        const sorted = (0, useScreens_1.useSortedScreens)(processed ?? [], protectedScreens, useOnlyUserDefinedScreens);
        // Prevent throwing an error when there are no screens.
        if (!sorted.length) {
            return null;
        }
        return <Nav {...props} id={contextKey} ref={ref} children={sorted}/>;
    }), {
        Screen: Screen_1.Screen,
        Protected: Protected_1.Protected,
    });
}
//# sourceMappingURL=withLayoutContext.js.map

→ Read node_modules/@react-navigation/bottom-tabs/src/views/BottomTabItem.tsx [offset=225, limit=70]

$ node -e "
const g=require('./node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');
const want=['library','library-outline','swap-horizontal','swap-horizontal-outline','storefront','storefront-outline','people','people-outline','person-circle','person-circle-outline'];
for(const n of want) console.log(n, g[n]!==undefined ? 'OK code='+g[n] : 'MISSING');
" 2>&1 | head -20
library OK code=62389
library-outline OK code=62390
swap-horizontal OK code=62896
swap-horizontal-outline OK code=62897
storefront OK code=62887
storefront-outline OK code=62888
people OK code=62623
people-outline OK code=62627
person-circle OK code=62633
person-circle-outline OK code=62634

$ grep -rn "marketplace/cart\|/cart\|/requests\|book/\[\|store/\[storeId\]" src/features/marketplace/commerce/components/AddToCartButton.tsx src/features/marketplace/screens/MarketplaceSearchScreen.tsx src/features/marketplace/commerce/screens/CustomerRequestsScreen.tsx src/features/marketplace/components/GroupedBookCard.tsx "app/(tabs)/profile/notifications.tsx" 2>/dev/null | head -30
src/features/marketplace/commerce/components/AddToCartButton.tsx:21:            router.push('/(tabs)/marketplace/cart' as never);
src/features/marketplace/screens/MarketplaceSearchScreen.tsx:33:                    <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/marketplace/cart' as never)}>
src/features/marketplace/screens/MarketplaceSearchScreen.tsx:36:                    <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/marketplace/requests' as never)}>
src/features/marketplace/screens/MarketplaceSearchScreen.tsx:100:                                    pathname: '/marketplace/store/[storeId]',
src/features/marketplace/commerce/screens/CustomerRequestsScreen.tsx:20:                onPress={() => router.push(`/(tabs)/marketplace/requests/${item.request_id}` as never)}
src/features/marketplace/components/GroupedBookCard.tsx:80:                    pathname: '/marketplace/book/[listingId]',
app/(tabs)/profile/notifications.tsx:38:                router.push(`/(tabs)/marketplace/requests/${requestId}` as never);

$ node -e "const p=require('./package.json');console.log(JSON.stringify(p.scripts,null,2))"; echo "=== jest config ==="; ls jest.config* jest.setup* 2>/dev/null; cat jest.config.js 2>/dev/null || cat jest.config.ts 2>/dev/null
{
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
}
=== jest config ===
jest.setup.ts

$ cat jest.setup.ts
/**
 * Jest setup file for BookTalks Mobile
 * Runs after the test framework is installed — jest globals (describe, test, expect) are available.
 */

// Extended matchers from React Native Testing Library (replaces deprecated @testing-library/jest-native)
// Import matchers and extend expect manually (no convenience import in v13.x)
import * as matchers from '@testing-library/react-native/matchers';
expect.extend(matchers);

// Mock react-native-url-polyfill (imported for side effects in supabase.ts)
jest.mock('react-native-url-polyfill/auto', () => {});

// Mock react-native-reanimated (used internally by expo-router, react-native-screens)
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Set test environment variables so supabase.ts doesn't throw
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.EXPO_PUBLIC_DEV_SKIP_AUTH = 'false';
process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
process.env.EXPO_PUBLIC_APP_ENV = 'development';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setTags: jest.fn(),
  setTag: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  wrap: (Component: unknown) => Component,
}));

// Silence console warnings in tests (optional, uncomment if too noisy)
// const originalWarn = console.warn;
// console.warn = (...args: any[]) => {
//   if (typeof args[0] === 'string' && args[0].includes('Animated:')) return;
//   originalWarn(...args);
// };

$ node -e "const p=require('./package.json');console.log(JSON.stringify(p.jest,null,2))"
{
  "preset": "jest-expo",
  "setupFilesAfterEnv": [
    "./jest.setup.ts"
  ],
  "modulePathIgnorePatterns": [
    "<rootDir>/.worktrees",
    "<rootDir>/.wt"
  ],
  "testPathIgnorePatterns": [
    "\\\\node_modules\\\\",
    "<rootDir>/.worktrees",
    "<rootDir>/.wt",
    "[\\\\/]e2e[\\\\/]"
  ],
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/src/$1"
  }
}

$ npx jest "app/(tabs)/__tests__/_layout.test.tsx" --ci 2>&1 | tail -20
npm notice run booktalks-mobile@1.0.0 npx
npm notice run jest app/(tabs)/__tests__/_layout.test.tsx --ci
No tests found, exiting with code 1
Run with `--passWithNoTests` to exit with code 0
In C:\Users\LEGION\Desktop\Bookconnect4_fu1a
  1137 files checked.
  testMatch: **/__tests__/**/*.[jt]s?(x), **/?(*.)+(spec|test).[tj]s?(x) - 322 matches
  testPathIgnorePatterns: \\node_modules\\, C:\\Users\\LEGION\\Desktop\\Bookconnect4_fu1a\\.worktrees, C:\\Users\\LEGION\\Desktop\\Bookconnect4_fu1a\\.wt, [\\\\]e2e[\\\\] - 1127 matches
  testRegex:  - 0 matches
Pattern: app\\(tabs)\\__tests__\\_layout.test.tsx - 0 matches

$ npx jest --testPathPattern "app.\(tabs\).__tests__._layout" --ci 2>&1 | tail -20
npm notice run booktalks-mobile@1.0.0 npx
npm notice run jest --testPathPattern app.\(tabs\).__tests__._layout --ci
PASS app/(tabs)/__tests__/_layout.test.tsx
  TabsLayout
    √ registers primary tabs, omits legacy shims, and hides detail routes (22 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        2.16 s
Ran all test suites matching /app.\(tabs\).__tests__._layout/i.

→ Read src/hooks/__tests__/useTheme.test.ts [offset=60, limit=40]

$ grep -rln "FU-1a\|fu1a\|registry" .spec/*.md 2>/dev/null | head; echo "=== contrast helpers ==="; grep -rn "export function.*[Cc]ontrast\|export const.*[Cc]ontrast" src/ --include=*.ts --include=*.tsx | head -10
.spec/SDD-07-FLOW-A-PROTOTYPE.md
.spec/SDD-07-FOUNDATION-PLAN.md
.spec/SDD-07-TAB-BAR-UNIT.md
.spec/SDD-07-book-section-ui-overhaul.md
.spec/WAVE1-REVIEW.md
=== contrast helpers ===

$ grep -n "^export" src/features/books/utils/shelfLayout.ts | head -20; echo "=== routes ==="; find "app/(tabs)" -name "*.tsx" | sort
13:export function stableSeed(id: string, title: string): number {
18:export function seededJitter(seed: number): number {
24:export function spineMetrics(seed: number, pageCount?: number | null): { width: number; height: number } {
31:export function spineColorFromTitle(title: string): string {
38:export function spineTextColor(background: string): string {
52:export type ShelfPosture = { tiltDeg: number; isBookend: boolean };
56:export function computeShelfPosture(entries: LibraryBookEntry[]): Record<string, ShelfPosture> {
86:export type ShelfRow = 'top' | 'bottom';
87:export type SplitShelf<T> = { top: T[]; bottom: T[] };
89:export function splitShelfRows<T>(entries: T[]): SplitShelf<T> {
95:export type SweptSpineRowGeometry = { top: { y: number; height: number }; bottom: { y: number; height: number } };
96:export type SweptSpineBookLayout = { id: string; row: ShelfRow; offsetLeft: number; width: number; height: number; gapAfter?: number };
98:export const SHELF_SIDE_WIDTH = 12;
99:export const SHELF_BOOKEND_WIDTH = 20;
106:export function getShelfTrackLayout(top: LibraryBookEntry[], bottom: LibraryBookEntry[], viewportWidth: number) {
124:export type SweptSpineInput = {
132:export function resolveSweptSpine({ scrollX, touchX, touchY, rowGeometry, bookLayouts }: SweptSpineInput): string | null {
147:export type SpineDivider = { height: number; width: string; color: string } | null;
149:export function spineDividerVariant(seed: number): SpineDivider {
=== routes ===
app/(tabs)/__tests__/_layout.test.tsx
app/(tabs)/_layout.tsx
app/(tabs)/clubs/[clubId]/applications.tsx
app/(tabs)/clubs/[clubId]/discussion.tsx
app/(tabs)/clubs/[clubId]/discussion/[topicId].tsx
app/(tabs)/clubs/[clubId]/events.tsx
app/(tabs)/clubs/[clubId]/events/[eventId]/edit.tsx
app/(tabs)/clubs/[clubId]/events/create.tsx
app/(tabs)/clubs/[clubId]/index.tsx
app/(tabs)/clubs/[clubId]/invite.tsx
app/(tabs)/clubs/[clubId]/manage.tsx
app/(tabs)/clubs/[clubId]/nominate.tsx
app/(tabs)/clubs/[clubId]/reading.tsx
app/(tabs)/clubs/[clubId]/venues.tsx
app/(tabs)/clubs/__tests__/authors.test.tsx
app/(tabs)/clubs/__tests__/index.test.tsx
app/(tabs)/clubs/_layout.tsx
app/(tabs)/clubs/authors.tsx
app/(tabs)/clubs/create.tsx
app/(tabs)/clubs/index.tsx
app/(tabs)/clubs/invitations.tsx
app/(tabs)/clubs/venues.tsx
app/(tabs)/clubs/venues/[venueId].tsx
app/(tabs)/exchange/[listingId].tsx
app/(tabs)/exchange/__tests__/exchange-capabilities.test.tsx
app/(tabs)/exchange/__tests__/listing-detail.test.tsx
app/(tabs)/exchange/__tests__/transaction-detail.test.tsx
app/(tabs)/exchange/_layout.tsx
app/(tabs)/exchange/create.tsx
app/(tabs)/exchange/index.tsx
app/(tabs)/exchange/my-transactions.tsx
app/(tabs)/exchange/transaction/[transactionId].tsx
app/(tabs)/exchange/transaction/_layout.tsx
app/(tabs)/library/[bookId].tsx
app/(tabs)/library/__tests__/[bookId].test.tsx
app/(tabs)/library/__tests__/book-details-corrections.test.tsx
app/(tabs)/library/__tests__/index.test.tsx
app/(tabs)/library/__tests__/search.test.tsx
app/(tabs)/library/_layout.tsx
app/(tabs)/library/dev-flow-a.tsx
app/(tabs)/library/index.tsx
app/(tabs)/library/note-compose.tsx
app/(tabs)/library/note.tsx
app/(tabs)/library/notes.tsx
app/(tabs)/library/search.tsx
app/(tabs)/marketplace/book/[listingId].tsx
app/(tabs)/marketplace/cart.tsx
app/(tabs)/marketplace/index.tsx
app/(tabs)/marketplace/requests/[requestId].tsx
app/(tabs)/marketplace/requests/index.tsx
app/(tabs)/marketplace/store/[storeId].tsx
app/(tabs)/profile/__tests__/_layout.test.tsx
app/(tabs)/profile/__tests__/addresses.test.tsx
app/(tabs)/profile/__tests__/credit-history.test.tsx
app/(tabs)/profile/__tests__/edit-profile.test.tsx
app/(tabs)/profile/__tests__/notification-settings.test.tsx
app/(tabs)/profile/__tests__/notifications.test.tsx
app/(tabs)/profile/__tests__/profile.test.tsx
app/(tabs)/profile/__tests__/settings.test.tsx
app/(tabs)/profile/_layout.tsx
app/(tabs)/profile/addresses.tsx
app/(tabs)/profile/credit-history.tsx
app/(tabs)/profile/edit.tsx
app/(tabs)/profile/index.tsx
app/(tabs)/profile/notification-settings.tsx
app/(tabs)/profile/notifications.tsx
app/(tabs)/profile/settings.tsx

$ sed -n '1,60p' node_modules/expo-router/build/link/Link.js; echo "=== LinkClient ==="; ls node_modules/expo-router/build/link/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Redirect = exports.Link = void 0;
const ExpoLink_1 = require("./ExpoLink");
const elements_1 = require("./elements");
const href_1 = require("./href");
exports.Link = Object.assign(
/**
 * Component that renders a link using [`href`](#href) to another route.
 * By default, it accepts children and wraps them in a `<Text>` component.
 *
 * Uses an anchor tag (`<a>`) on web and performs a client-side navigation to preserve
 * the state of the website and navigate faster. The web-only attributes such as `target`,
 * `rel`, and `download` are supported and passed to the anchor tag on web. See
 * [`WebAnchorProps`](#webanchorprops) for more details.
 *
 * > **Note**: Client-side navigation works with both single-page apps,
 * and [static-rendering](/router/reference/static-rendering/).
 *
 * @example
 * ```tsx
 * import { Link } from 'expo-router';
 * import { View } from 'react-native';
 *
 * export default function Route() {
 *  return (
 *   <View>
 *    <Link href="/about">About</Link>
 *   </View>
 *  );
 *}
 * ```
 */
function Link(props) {
    // Re-exporting ExpoLink here so that Link.* can be used in server components.
    return <ExpoLink_1.ExpoLink {...props}/>;
}, {
    resolveHref: href_1.resolveHref,
    Menu: elements_1.LinkMenu,
    Trigger: elements_1.LinkTrigger,
    Preview: elements_1.LinkPreview,
    MenuAction: elements_1.LinkMenuAction,
});
var Redirect_1 = require("./Redirect");
Object.defineProperty(exports, "Redirect", { enumerable: true, get: function () { return Redirect_1.Redirect; } });
//# sourceMappingURL=Link.js.map=== LinkClient ===
BaseExpoRouterLink.d.ts
BaseExpoRouterLink.d.ts.map
BaseExpoRouterLink.js
BaseExpoRouterLink.js.map
ExpoLink.d.ts
ExpoLink.d.ts.map
ExpoLink.js
ExpoLink.js.map
InternalLinkPreviewContext.d.ts
InternalLinkPreviewContext.d.ts.map
InternalLinkPreviewContext.js
InternalLinkPreviewContext.js.map
Link.d.ts
Link.d.ts.map
Link.js
Link.js.map
LinkWithPreview.d.ts
LinkWithPreview.d.ts.map
LinkWithPreview.js
LinkWithPreview.js.map
Redirect.d.ts
Redirect.d.ts.map
Redirect.js
Redirect.js.map
elements.d.ts
elements.d.ts.map
elements.js
elements.js.map
href.d.ts
href.d.ts.map
href.js
href.js.map
linking.d.ts
linking.d.ts.map
linking.js
linking.js.map
preview
useLinkHooks.d.ts
useLinkHooks.d.ts.map
useLinkHooks.js
useLinkHooks.js.map
useLinkToPathProps.d.ts
useLinkToPathProps.d.ts.map
useLinkToPathProps.js
useLinkToPathProps.js.map
useLoadedNavigation.d.ts
useLoadedNavigation.d.ts.map
useLoadedNavigation.js
useLoadedNavigation.js.map

$ grep -n "accessibilityRole\|role\|aria-selected\|aria-current\|onPress\|href\|Text\|Pressable\|anchor" node_modules/expo-router/build/link/BaseExpoRouterLink.js | head -40
41:// Fork of @react-navigation/native Link.tsx with `href` and `replace` support added and
45:const href_1 = require("./href");
50:function BaseExpoRouterLink({ href, replace, push, dismissTo,
51:// TODO: This does not prevent default on the anchor tag.
55:    // If not passing asChild, we need to forward the props to the anchor tag using React Native Web's `hrefAttrs`.
56:    const hrefAttrs = (0, useLinkHooks_1.useHrefAttrs)({ asChild, rel, target, download });
58:        if (href == null) {
59:            throw new Error('Link: href is required');
61:        return (0, href_1.resolveHref)(href);
62:    }, [href]);
71:        href: resolvedHref,
77:    const onPress = (e) => {
78:        if ('onPress' in rest) {
79:            rest.onPress?.(e);
81:        props.onPress(e);
83:    const Component = asChild ? Slot_1.Slot : react_native_1.Text;
85:        throw new Error('Link: When using `asChild`, you must pass a single child element that will emit the `onPress` event.');
88:    const element = (<Component {...props} {...hrefAttrs} {...rest} style={style} {...react_native_1.Platform.select({
90:            onClick: onPress,
92:        default: { onPress },
95:      <Prefetch_1.Prefetch href={href}/>

## GOAL
Make the global tab bar show exactly five themed, accessible tabs (icons + 12px labels) that pass WCAG 2.2 AA in all three phases and never widen the page at 200% zoom, without breaking any of the seven §3 call sites.

## FILES
- `app/(tabs)/_layout.tsx` — hide `marketplace/cart`, `marketplace/book/[listingId]`, `marketplace/requests/index`, `marketplace/requests/[requestId]` with `href: null` (plus existing store route); add `backBehavior="history"`, `tabBarStyle`/`tabBarActiveTintColor`/`tabBarInactiveTintColor`/`tabBarLabelStyle`/`tabBarLabelPosition`/`tabBarItemStyle`, `tabBarIcon` per tab, `tabBarAccessibilityLabel` per tab, `tabBarAllowFontScaling`; rename library title to `Library`; export a pure `decideIconOnly()` seam for tests. Keep `headerShown:false` and `sceneStyle:{backgroundColor:'transparent'}`.
- `app/(tabs)/__tests__/_layout.test.tsx` — updated, never weakened.
- `app/(tabs)/__tests__/tabBarContrast.test.ts` — new. Nothing else changes.

## APPROACH
**Verified installed versions:** expo-router 6.0.24, @react-navigation/bottom-tabs 7.15.9, routers 7.5.3, @expo/vector-icons 15.0.3, RNW 0.21.2, RN 0.81.5. Baseline test passes today (`npx jest --testPathPattern "app.\(tabs\).__tests__._layout"`).

**Options are named exactly as installed** (all in `node_modules/@react-navigation/bottom-tabs/lib/typescript/src/types.d.ts`): `backBehavior` is a `TabRouter` prop, not a bottom-tab option (`@react-navigation/routers/lib/typescript/src/TabRouter.d.ts:22`; `history` branch `lib/module/TabRouter.js:51-56`, default `firstRoute` at `:33`) — so `backBehavior="history"` goes on `<Tabs>` and works. `tabBarIcon` `:99`, `tabBarLabelStyle` `:91`, `tabBarShowLabel` `:78`, `tabBarAccessibilityLabel` `:121`, `tabBarButton` `:130`, `tabBarActiveTintColor` `:134`, `tabBarInactiveTintColor` `:139`, `tabBarItemStyle` `:150`, `tabBarStyle` `:169`, `tabBarLabelPosition` `:88`, `tabBarAllowFontScaling` `:95`. There is **no** `tabBarSelectedIndicator` option — so the 3px accent bar is drawn by hand inside `tabBarIcon`: a `position:'absolute', top:0, width:24, height:3, borderRadius:2, backgroundColor: colors.accent` view rendered only when `focused`, wrapping the `Ionicons` glyph. Absolute + fixed size means the bar height and label baseline never move. All ten glyph names (`library`, `library-outline`, `swap-horizontal[-outline]`, `storefront[-outline]`, `people[-outline]`, `person-circle[-outline]`) exist in `glyphmaps/Ionicons.json`.

**role=tab and selected state are free — do not use `tabBarButton` for them.** `BottomTabItem.tsx:341` sets `'role': Platform.select({ios:'button', default:'tab'})` and `:342` `'aria-selected': focused`; these reach the DOM because `PlatformPressable` spreads `{...rest}` *after* its own default role (`@react-navigation/elements/src/PlatformPressable.tsx:121` then `:150`). Any custom `tabBarButton` would have to re-forward `role`, `aria-selected`, `aria-label` (`BottomTabItem.tsx:337`) or4.1.2 regresses.

**Focus ring on web.** Default tabs render as a non-focusable RNW `div`, so V4 needs a custom `tabBarButton` that renders `PlatformPressable` with `focusable`, forwarding `role`/`aria-selected`/`aria-label` from `props` and merging `style` with RNW 0.21 `outlineStyle:'solid', outlineWidth:2, outlineOffset:-2, outlineColor: colors.textPrimary` (web only). Because `textPrimary` on `bgCard` is ≥8.15:1 in every phase this clears 2.4.7/2.4.11. If an always-on ring is judged too loud under C-rules, the `:focus-visible`-only variant injects one `<style href precedence>` block (same pattern React Navigation already uses at `PlatformPressable.tsx:200`) keyed by phase. Do **not** add `href` to the five visible tabs: expo-router's `href` shortcut throws `Cannot use 'href' and 'tabBarButton' together` (`expo-router/build/layouts/TabsClient.js:28`) and swaps in its own `<Link>` (`:31-45`), which would also change browser Back/URL behaviour (V3).

**TB-D5 measured icon-only fallback.** `tabBarShowLabel` short-circuits before `tabBarLabel` is invoked (`BottomTabItem.tsx:235-237`), so measurement must live *inside* the shown label. Set `tabBarLabel` to a function that returns our own `<Text numberOfLines={1} onTextLayout={e => register(name, e.nativeEvent.lines[0].width)} style={labelStyle}>`. The bar renders all five items, so all five report on mount. Slot width = `useWindowDimensions().width −2×barHorizontalPadding`, ÷ 5 — measured on the device, no fixed 78px (closes R6). Once all five report, `maxLabelWidth > slot − 2×itemPadding` sets one `iconOnly` flag in `TabsLayout`; that single flag drives `tabBarShowLabel: !iconOnly` as `screenOptions`, so **all** labels hide together. Names survive because `tabBarAccessibilityLabel` is set unconditionally and is read independently of the label (`BottomTabBar.js:292`, which also suppresses the iOS `"label, tab, n of m"` string). Re-measure on width change by bumping a `measurePass` counter that forces `tabBarShowLabel:true` while the label renders at `opacity:0` — it still lays out and reports, so no flash and no layout shift; a ref keyed on `width` prevents a measure→hide→measure loop.

**Gotcha:** because `tabBarLabel` is a function, bottom-tabs returns early and **never applies `tabBarLabelStyle`** (`BottomTabItem.tsx:241-248`). The custom `Text` must apply `fontSize:12, lineHeight:16, fontWeight` and the tint itself, or RA-W01 is not closed.

## RISKS
1. **`THEME_COLORS` is not exported** — `src/hooks/useTheme.ts:22` is `const THEME_COLORS`, not `export const`, contradicting spec §3 line 53. §4 forbids touching that file, so `tabBarContrast.test.ts` cannot import it. Mitigation: harvest tokens by rendering `useTheme()` with fake system times per phase (the pattern already at `src/hooks/__tests__/useTheme.test.ts:86-98`).
2. **Custom `tabBarButton` regresses 4.1.2** if it drops `role`/`aria-selected`/`aria-label`. Mitigation: forward them explicitly and assert `props.role === 'tab'` in the unit test.
3. **Measurement loop / flash** in the TB-D5 check. Mitigation: width-keyed ref, `opacity:0` measuring pass, `decideIconOnly()` extracted as a pure function and tested directly.
4. **`tabBarLabel` as a function silently ignores `tabBarLabelStyle`** → 10px labels return and RA-W01 stays open. Mitigation: style the inner `Text` explicitly; assert the style in the test.
5. **Shared file with the clubs worktree** (R3) plus R7: renaming to "Library" breaks the FU-2 capture probe that matched the tab label. Mitigation: send §10 heads-up first, re-point the capture script at a screen heading.

## TESTS
- `_layout.test.tsx` — keep every existing assertion (name list, no credit-history/addresses, store `href: null`) and extend: visible order `library, exchange, marketplace/index, clubs, profile`; five hidden routes each `href === null`; `backBehavior === 'history'`; `headerShown === false`; `sceneStyle.backgroundColor === 'transparent'`; every visible screen has a `tabBarIcon` function and a non-empty `tabBarAccessibilityLabel`; library `title === 'Library'`. Per-phase: `jest.mock('@/hooks/useTheme')` returning a frozen `{ phase, colors }` fixture for daylight/golden/midnight, then assert `tabBarStyle.backgroundColor === colors.bgCard`, `tabBarActiveTintColor === colors.textPrimary`, `tabBarInactiveTintColor === colors.textSecondary`, `colors.border` used decoratively only, and `accent` never used as a label colour. Reachability: a literal array of the seven §3 targets must each appear in the screen names. Fit fallback: `decideIconOnly()` unit test. `useTheme` is mocked per phase (never `jest.setSystemTime` inside this file) so the three phases are deterministic.
- `tabBarContrast.test.ts` — local `luminance`/`contrast` copied from `src/features/books/utils/__tests__/shelfLayout.test.ts:260-269` (no shared helper exists; `shelfLayout.ts` exports none). For each of the three phases assert `textPrimary`/`bgCard` ≥ 4.5, `textSecondary`/`bgCard` ≥ 4.5, `accent`/`bgCard` ≥ 3, `textPrimary`/`bgCard` ≥ 3 (focus ring), and assert `textTertiary` and `accent`-as-text are never used.
- Note: `npx jest "app/(tabs)/..."` finds nothing — the parentheses are regex metacharacters. Use `npx jest --testPathPattern "app.\(tabs\).__tests__"`.
- Then the existing marketplace, clubs and profile suites.

## DONE CRITERIA
- Five tabs at 390px, no truncation, no "⏷" glyphs → §8 row 1 (K3).
- Labels ≥4.5:1, indicator ≥3:1, all three phases; RA-W01 closed → §8 row 2.
- Selected tab distinguished by filled-vs-outline icon, label weight and the accent bar, not colour alone → §8 row 3.
- `scrollWidth` equals viewport at 200% zoom on 390px; D07-15 closed → §8 row 4.
- ≥48dp items via `tabBarItemStyle`, visible ≥3:1 focus ring, `role="tab"` + `aria-selected`, DOM order = visual order → §8 row 5.
- Bar follows `useTheme`, no badges → §8 row 6.
- All seven §3 call sites reach their routes; Back returns to the previous screen → §8 row 7 (covered by the reachability assertion + V3).
- §7 tests pass, evidence README + SDD-07/TRACKER/roadmap updated → §8 row 8.

## QUESTIONS
1. **Blocking:** `THEME_COLORS` is not exported and §4 forbids editing `useTheme.ts`. May I harvest tokens by rendering the hook per phase (no source change), or do you authorise adding `export` to `src/hooks/useTheme.ts:22`?
2. **Blocking:** `V4` (keyboard focus) appears unreachable without a custom `tabBarButton`, which then forbids `href` on visible tabs. Confirm the custom `tabBarButton` is in scope for TB-1, or defer V4 and record it as not run?
3. Non-blocking: always-visible 2px outline vs `:focus-visible`-only (needs an injected `<style>`)? I default to `:focus-visible`-only.
