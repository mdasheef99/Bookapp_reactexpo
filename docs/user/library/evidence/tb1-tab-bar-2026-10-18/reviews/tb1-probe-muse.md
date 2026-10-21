
> plan · muse-spark-1.3-contributor

Probing TB1 per your spec — gathering read-only evidence.
→ Read .spec/TB1-PROBE.md
→ Read .spec/SDD-07-TAB-BAR-UNIT.md
→ Read app/(tabs)/_layout.tsx
→ Read src/hooks/useTheme.ts
→ Read app/(tabs)/__tests__/_layout.test.tsx
✱ Glob "app/(tabs)/__tests__/*" 1 match

$ ls node_modules/@react-navigation/bottom-tabs/lib/module/ 2>&1; ls node_modules/expo-router/build/layouts/ 2>&1 | head -n 50
TransitionConfigs
index.js
index.js.map
navigators
package.json
types.js
types.js.map
unstable
utils
views
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

Spec and current tab code mapped — now verifying the exact navigator options in your installed versions.
✱ Grep "backBehavior" in node_modules/@react-navigation/routers/lib/module · 16 matches

$ node -p "require('./node_modules/@react-navigation/bottom-tabs/package.json').version + ' | ' + require('./node_modules/expo-router/package.json').version + ' | ' + require('./node_modules/@react-navigation/routers/package.json').version"
7.15.9 | 6.0.24 | 7.5.3

✱ Grep "tabBarShowLabel|tabBarLabelStyle|tabBarAccessibilityLabel|tabBarButton|tabBarIcon" in node_modules/@react-navigation/bottom-tabs/lib/module · 15 matches

$ rg -n "tabBarShowLabel|tabBarLabelStyle|tabBarAccessibilityLabel|tabBarButton|tabBarIcon|backBehavior" node_modules/@react-navigation/bottom-tabs/lib/typescript/src/types.tsx node_modules/expo-router/build/layouts/Tabs.tsx node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabItem.tsx node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabBar.tsx 2>&1 | head -n 80
rg: node_modules/@react-navigation/bottom-tabs/lib/typescript/src/types.tsx: The system cannot find the file specified. (os error 2)
rg: node_modules/expo-router/build/layouts/Tabs.tsx: The system cannot find the file specified. (os error 2)
rg: node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabItem.tsx: The system cannot find the file specified. (os error 2)
rg: node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabBar.tsx: The system cannot find the file specified. (os error 2)

→ Read src/features/marketplace/commerce/components/AddToCartButton.tsx [limit=40]

$ rg -n "role=|role:|accessibilityRole|selected|onLayout|useWindowDimensions|onTextLayout|numberOfLines|tabBarItemLabelVisibilityMode" node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabItem.tsx 2>&1 | head -n 60; echo ---; rg -n "backBehavior" node_modules/expo-router/build/layouts/withLayoutContext.tsx node_modules/expo-router/build/layouts/TabRouter.tsx 2>&1 | head -n 20
rg: node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabItem.tsx: IO error for operation on node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabItem.tsx: The system cannot find the file specified. (os error 2)
---
rg: node_modules/expo-router/build/layouts/withLayoutContext.tsx: The system cannot find the file specified. (os error 2)
rg: node_modules/expo-router/build/layouts/TabRouter.tsx: The system cannot find the file specified. (os error 2)

$ ls node_modules/@react-navigation/bottom-tabs/lib/module/views/; echo ---TABS---; ls node_modules/expo-router/build/ | head -n 30
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
---TABS---
ExpoRoot.d.ts
ExpoRoot.d.ts.map
ExpoRoot.js
ExpoRoot.js.map
LocationProvider.d.ts
LocationProvider.d.ts.map
LocationProvider.js
LocationProvider.js.map
Prefetch.d.ts
Prefetch.d.ts.map
Prefetch.js
Prefetch.js.map
Route.d.ts
Route.d.ts.map
Route.js
Route.js.map
constants.d.ts
constants.d.ts.map
constants.js
constants.js.map
doctor
domComponents
exports.d.ts
exports.d.ts.map
exports.js
exports.js.map
fast-refresh.d.ts
fast-refresh.d.ts.map
fast-refresh.js
fast-refresh.js.map

$ ls node_modules/expo-router/build/layouts/; echo ---; ls node_modules/@react-navigation/bottom-tabs/lib/typescript/src/ 2>&1; echo ---; grep -n "backBehavior\|tabBarIcon\|tabBarLabelStyle\|tabBarAccessibilityLabel\|tabBarButton\|tabBarShowLabel" node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabBar.js | head -n 20; echo ---ROUTER---; grep -n "backBehavior" node_modules/@react-navigation/routers/lib/module/TabRouter.js | head -n 10
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
---
TransitionConfigs
index.d.ts
index.d.ts.map
navigators
types.d.ts
types.d.ts.map
unstable
utils
views
---
123:    tabBarShowLabel,
292:        const accessibilityLabel = options.tabBarAccessibilityLabel !== undefined ? options.tabBarAccessibilityLabel : typeof label === 'string' && Platform.OS === 'ios' ? `${label}, tab, ${index + 1} of ${routes.length}` : undefined;
308:            testID: options.tabBarButtonTestID,
314:            button: options.tabBarButton,
315:            icon: options.tabBarIcon ?? (({
325:            showLabel: tabBarShowLabel,
326:            labelStyle: options.tabBarLabelStyle,
327:            iconStyle: options.tabBarIconStyle,
---ROUTER---
18:const getRouteHistory = (routes, index, backBehavior, initialRouteName) => {
24:  switch (backBehavior) {
58:const changeIndex = (state, index, backBehavior, initialRouteName) => {
60:  if (backBehavior === 'history' || backBehavior === 'fullHistory') {
62:    if (backBehavior === 'history') {
65:    } else if (backBehavior === 'fullHistory') {
77:      params: backBehavior === 'fullHistory' ? currentRoute.params : undefined
80:    history = getRouteHistory(state.routes, index, backBehavior, initialRouteName);
90:  backBehavior = 'firstRoute'
105:      const history = getRouteHistory(routes, index, backBehavior, initialRouteName);

Core navigator props confirmed — now checking icons, accessibility, and web focus behavior.
$ grep -n "tabBarIcon\|tabBarLabelStyle\|tabBarAccessibilityLabel\|tabBarButton\|tabBarShowLabel\|tabBarActiveTintColor\|tabBarInactiveTintColor\|tabBarStyle" node_modules/@react-navigation/bottom-tabs/lib/typescript/src/types.d.ts | head -n 30; echo ---TABSJS---; grep -n "backBehavior\|screenOptions\|tabBarShowLabel" node_modules/expo-router/build/layouts/Tabs.js | head -n 20; echo ---ITEM---; grep -n "accessibilityRole\|accessibilityState\|selected\|onFocus\|outline\|tab\b\|role" node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabItem.js | head -n 40
67:     * When undefined, scene title is used. Use `tabBarShowLabel` to hide the label.
78:    tabBarShowLabel?: boolean;
91:    tabBarLabelStyle?: StyleProp<TextStyle>;
99:    tabBarIcon?: (props: {
107:    tabBarIconStyle?: StyleProp<TextStyle>;
121:    tabBarAccessibilityLabel?: string;
125:    tabBarButtonTestID?: string;
130:    tabBarButton?: (props: BottomTabBarButtonProps) => React.ReactNode;
134:    tabBarActiveTintColor?: string;
138:    tabBarInactiveTintColor?: string;
169:    tabBarStyle?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
174:     * When using `BlurView`, make sure to set `position: 'absolute'` in `tabBarStyle` as well.
---TABSJS---
---ITEM---
136:      // FIXME: role: 'tab' doesn't seem to work as expected on iOS
137:      'role': Platform.select({
139:        default: 'tab'
141:      'aria-selected': focused,
149:      'style': [styles.tab, {
161:  tab: {

$ cat node_modules/expo-router/build/layouts/Tabs.js; echo ---TABS-D---; cat node_modules/expo-router/build/layouts/Tabs.d.ts | head -n 60; echo ---ITEM-FULL---; sed -n '100,220p' node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabItem.js
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
//# sourceMappingURL=Tabs.js.map---TABS-D---
import Tabs from './TabsClient';
export { Tabs };
export default Tabs;
//# sourceMappingURL=Tabs.d.ts.map---ITEM-FULL---
      size: compact ? 'compact' : 'regular',
      badge: badge,
      badgeStyle: badgeStyle,
      activeOpacity: activeOpacity,
      allowFontScaling: allowFontScaling,
      inactiveOpacity: inactiveOpacity,
      activeTintColor: activeTintColor,
      inactiveTintColor: iconInactiveTintColor,
      renderIcon: icon,
      style: iconStyle
    });
  };
  const scene = {
    route,
    focused
  };
  const backgroundColor = focused ? activeBackgroundColor : inactiveBackgroundColor;
  const {
    flex
  } = StyleSheet.flatten(style || {});
  const borderRadius = variant === 'material' ? horizontal ? 56 : 16 : sidebar && horizontal ? 10 : 0;
  return /*#__PURE__*/_jsx(View, {
    style: [
    // Clip ripple effect on Android
    {
      borderRadius,
      overflow: variant === 'material' ? 'hidden' : 'visible'
    }, style],
    children: button({
      href,
      onPress,
      onLongPress,
      testID,
      'aria-label': accessibilityLabel,
      'accessibilityLargeContentTitle': labelString,
      'accessibilityShowsLargeContentViewer': true,
      // FIXME: role: 'tab' doesn't seem to work as expected on iOS
      'role': Platform.select({
        ios: 'button',
        default: 'tab'
      }),
      'aria-selected': focused,
      'android_ripple': {
        borderless: true
      },
      'hoverEffect': variant === 'material' || sidebar && horizontal ? {
        color: colors.text
      } : undefined,
      'pressOpacity': 1,
      'style': [styles.tab, {
        flex,
        backgroundColor,
        borderRadius
      }, sidebar ? variant === 'material' ? horizontal ? styles.tabBarSidebarMaterial : styles.tabVerticalMaterial : horizontal ? styles.tabBarSidebarUiKit : styles.tabVerticalUiKit : variant === 'material' ? styles.tabVerticalMaterial : horizontal ? styles.tabHorizontalUiKit : styles.tabVerticalUiKit],
      'children': /*#__PURE__*/_jsxs(React.Fragment, {
        children: [renderIcon(scene), renderLabel(scene)]
      })
    })
  });
}
const styles = StyleSheet.create({
  tab: {
    alignItems: 'center',
    // Roundness for iPad hover effect
    borderRadius: 10,
    borderCurve: 'continuous'
  },
  tabVerticalUiKit: {
    justifyContent: 'flex-start',
    flexDirection: 'column',
    padding: 5
  },
  tabVerticalMaterial: {
    padding: 10
  },
  tabHorizontalUiKit: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    padding: 5
  },
  tabBarSidebarUiKit: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 5
  },
  tabBarSidebarMaterial: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 15,
    paddingStart: 16,
    paddingEnd: 24
  },
  labelSidebarMaterial: {
    marginStart: 12
  },
  labelSidebarUiKit: {
    fontSize: 17,
    marginStart: 10
  },
  labelBeneath: {
    fontSize: 10
  },
  labelBeside: {
    marginEnd: 12,
    lineHeight: 24
  },
  labelBesideUikit: {
    fontSize: 13,
    marginStart: 5
  },
  labelBesideUikitCompact: {
    fontSize: 12,
    marginStart: 5
  }
});
//# sourceMappingURL=BottomTabItem.js.map

$ grep -n "tabBarLabel\|renderLabel\|showLabel\|allowFontScaling\|tabBarIconStyle" node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabItem.js | head -n 30; echo ---; sed -n '1,100p' node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabItem.js; echo ---BAR120---; sed -n '115,135p;285,335p' node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabBar.js
36:  showLabel = true,
40:  allowFontScaling = SUPPORTS_LARGE_CONTENT_VIEWER ? false : undefined,
56:    label: typeof options.tabBarLabel === 'string' ? options.tabBarLabel : undefined,
65:  const renderLabel = ({
68:    if (showLabel === false) {
84:      allowFontScaling: allowFontScaling,
104:      allowFontScaling: allowFontScaling,
155:        children: [renderIcon(scene), renderLabel(scene)]
---
"use strict";

import { getLabel, Label, PlatformPressable } from '@react-navigation/elements';
import { useTheme } from '@react-navigation/native';
import Color from 'color';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { TabBarIcon } from "./TabBarIcon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const renderButtonDefault = props => /*#__PURE__*/_jsx(PlatformPressable, {
  ...props
});
const SUPPORTS_LARGE_CONTENT_VIEWER = Platform.OS === 'ios' && parseInt(Platform.Version, 10) >= 13;
export function BottomTabItem({
  route,
  href,
  focused,
  descriptor,
  label,
  icon,
  badge,
  badgeStyle,
  button = renderButtonDefault,
  accessibilityLabel,
  testID,
  onPress,
  onLongPress,
  horizontal,
  compact,
  sidebar,
  variant,
  activeTintColor: customActiveTintColor,
  inactiveTintColor: customInactiveTintColor,
  activeBackgroundColor: customActiveBackgroundColor,
  inactiveBackgroundColor = 'transparent',
  showLabel = true,
  // On iOS 13+, we use `largeContentTitle` for accessibility
  // So we don't need the font to scale up
  // https://developer.apple.com/documentation/uikit/uiview/3183939-largecontenttitle
  allowFontScaling = SUPPORTS_LARGE_CONTENT_VIEWER ? false : undefined,
  labelStyle,
  iconStyle,
  style
}) {
  const {
    colors,
    fonts
  } = useTheme();
  const activeTintColor = customActiveTintColor ?? (variant === 'uikit' && sidebar && horizontal ? Color(colors.primary).isDark() ? 'white' : Color(colors.primary).darken(0.71).string() : colors.primary);
  const inactiveTintColor = customInactiveTintColor === undefined ? variant === 'material' ? Color(colors.text).alpha(0.68).rgb().string() : Color(colors.text).mix(Color(colors.card), 0.5).hex() : customInactiveTintColor;
  const activeBackgroundColor = customActiveBackgroundColor ?? (variant === 'material' ? Color(activeTintColor).alpha(0.12).rgb().string() : sidebar && horizontal ? colors.primary : 'transparent');
  const {
    options
  } = descriptor;
  const labelString = getLabel({
    label: typeof options.tabBarLabel === 'string' ? options.tabBarLabel : undefined,
    title: options.title
  }, route.name);
  let labelInactiveTintColor = inactiveTintColor;
  let iconInactiveTintColor = inactiveTintColor;
  if (variant === 'uikit' && sidebar && horizontal && customInactiveTintColor === undefined) {
    iconInactiveTintColor = colors.primary;
    labelInactiveTintColor = colors.text;
  }
  const renderLabel = ({
    focused
  }) => {
    if (showLabel === false) {
      return null;
    }
    const color = focused ? activeTintColor : labelInactiveTintColor;
    if (typeof label !== 'string') {
      return label({
        focused,
        color,
        position: horizontal ? 'beside-icon' : 'below-icon',
        children: labelString
      });
    }
    return /*#__PURE__*/_jsx(Label, {
      style: [horizontal ? [styles.labelBeside, variant === 'material' ? styles.labelSidebarMaterial : sidebar ? styles.labelSidebarUiKit : compact ? styles.labelBesideUikitCompact : styles.labelBesideUikit, icon == null && {
        marginStart: 0
      }] : styles.labelBeneath, compact || variant === 'uikit' && sidebar && horizontal ? fonts.regular : fonts.medium, labelStyle],
      allowFontScaling: allowFontScaling,
      tintColor: color,
      children: label
    });
  };
  const renderIcon = ({
    focused
  }) => {
    if (icon === undefined) {
      return null;
    }
    const activeOpacity = focused ? 1 : 0;
    const inactiveOpacity = focused ? 0 : 1;
    return /*#__PURE__*/_jsx(TabBarIcon, {
      route: route,
      variant: variant,
      size: compact ? 'compact' : 'regular',
---BAR120---
  const {
    buildHref
  } = useLinkBuilder();
  const focusedRoute = state.routes[state.index];
  const focusedDescriptor = descriptors[focusedRoute.key];
  const focusedOptions = focusedDescriptor.options;
  const {
    tabBarPosition = 'bottom',
    tabBarShowLabel,
    tabBarLabelPosition,
    tabBarHideOnKeyboard = false,
    tabBarVisibilityAnimationConfig,
    tabBarVariant = 'uikit',
    tabBarStyle,
    tabBarBackground,
    tabBarActiveTintColor,
    tabBarInactiveTintColor,
    tabBarActiveBackgroundColor,
    tabBarInactiveBackgroundColor
  } = focusedOptions;
  if (tabBarVariant === 'material' && tabBarPosition !== 'left' && tabBarPosition !== 'right') {
            target: route.key
          });
        };
        const label = typeof options.tabBarLabel === 'function' ? options.tabBarLabel : getLabel({
          label: options.tabBarLabel,
          title: options.title
        }, route.name);
        const accessibilityLabel = options.tabBarAccessibilityLabel !== undefined ? options.tabBarAccessibilityLabel : typeof label === 'string' && Platform.OS === 'ios' ? `${label}, tab, ${index + 1} of ${routes.length}` : undefined;
        return /*#__PURE__*/_jsx(NavigationProvider, {
          route: route,
          navigation: descriptors[route.key].navigation,
          children: /*#__PURE__*/_jsx(BottomTabItem, {
            href: buildHref(route.name, route.params),
            route: route,
            descriptor: descriptors[route.key],
            focused: focused,
            horizontal: hasHorizontalLabels,
            compact: compact,
            sidebar: sidebar,
            variant: tabBarVariant,
            onPress: onPress,
            onLongPress: onLongPress,
            accessibilityLabel: accessibilityLabel,
            testID: options.tabBarButtonTestID,
            allowFontScaling: options.tabBarAllowFontScaling,
            activeTintColor: tabBarActiveTintColor,
            inactiveTintColor: tabBarInactiveTintColor,
            activeBackgroundColor: tabBarActiveBackgroundColor,
            inactiveBackgroundColor: tabBarInactiveBackgroundColor,
            button: options.tabBarButton,
            icon: options.tabBarIcon ?? (({
              color,
              size
            }) => /*#__PURE__*/_jsx(MissingIcon, {
              color: color,
              size: size
            })),
            badge: options.tabBarBadge,
            badgeStyle: options.tabBarBadgeStyle,
            label: label,
            showLabel: tabBarShowLabel,
            labelStyle: options.tabBarLabelStyle,
            iconStyle: options.tabBarIconStyle,
            style: [sidebar ? {
              marginVertical: hasHorizontalLabels ? tabBarVariant === 'material' ? 0 : 1 : spacing / 2
            } : styles.bottomItem, options.tabBarItemStyle]
          })
        }, route.key);
      })
    })]
  });

$ grep -o "\"library\"\|\"swap-horizontal\"\|\"storefront\"\|\"people\"\|\"person-circle\"" node_modules/@expo/vector-icons/build/Ionicons.js | sort -u | head -n 10; echo ---; grep -n "tabBarAllowFontScaling\|tabBarLabel\b" node_modules/@react-navigation/bottom-tabs/lib/typescript/src/types.d.ts | head -n 10
---
69:    tabBarLabel?: string | ((props: {
95:    tabBarAllowFontScaling?: boolean;

## GOAL
Five readable labelled tabs with real icons pass WCAG AA in all three theme phases with no 200%-zoom overflow; every §3 route stays reachable via `router.push` and Back returns to origin.
Build TB-D1..TB-D5 exactly as recommended in SDD-07-TB-1 §5 (hide+history, theme tokens, Ionicons, "Library" 12/16, measured icon-only fallback).
## FILES
`app/(tabs)/_layout.tsx` — add 4× `href:null`, `backBehavior="history"`, `useTheme` colours, 5× `tabBarIcon`+indicator, rename to Library, fit-check fallback.
`app/(tabs)/__tests__/_layout.test.tsx` — update screen list/order, new assertions for hidden routes, icons, labels, colours (§7); no existing assertion removed.
`app/(tabs)/__tests__/tabBarContrast.test.ts` (new) — per-phase contrast over bar colour pairs; only new file.
## APPROACH
`Tabs backBehavior="history"` (routers 7.5.3 `TabRouter.js:90` default `firstRoute`, `:60-62` history branch); `screenOptions tabBarShowLabel` (types `types.d.ts:78`, `BottomTabBar.js:123,325`), `tabBarLabelStyle` (`:91`, `:326`), `tabBarIcon` (`:99`, `:315`), `tabBarActive/InactiveTintColor` (`:134,138`), `tabBarStyle`, per-screen `tabBarAccessibilityLabel` (`:121`, `:292`) + `tabBarButton` (`:130`, `:314`) (bottom-tabs 7.15.9, expo-router 6.0.24).
TB-D5: single `showLabels` state in layout; measure bar width via `useWindowDimensions`/`onLayout` and longest label (Marketplace 12px) via hidden `Text onTextLayout`; if any label width > `barWidth/5`, set `tabBarShowLabel=false` for all (`BottomTabItem.js:68-70` returns null); each screen keeps `tabBarAccessibilityLabel` so SR names persist; bar `maxWidth:100%` so `scrollWidth` never exceeds viewport.
Indicator: `tabBarIcon({focused})` returns column with 3px `View height:3 backgroundColor: focused?colors.accent:'transparent'` above 24px Ionicon (outline/focused-filled per TB-D3); accent used only as 3:1 UI part, never text.
Web focus/role: default `BottomTabItem.js:137-141` already sets `role:tab` (iOS `button`) + `aria-selected=focused`; custom `tabBarButton` wraps `PlatformPressable` passing through role/props and adds web `:focus-visible outline:2px solid colors.textPrimary` (≥3:1 on `bgCard` all phases); order = route order.
## RISKS
R1 hidden cart/listing/request shows no selected tab — accepted for TB-1, fixed later by marketplace Stack.
R2 `history` changes Back on all tabs incl. clubs — verify V3 on all five tabs; today it wrongly jumps to Library.
R3 shared file with clubs worktree — clubs heads-up §10, library owns file until merge.
R4 CRLF vs LF working copies — index is LF/identical, merge clean; check `git diff --stat` content-only.
R5 label widths differ native vs web — measure on-device, never fixed pixel threshold.
## TESTS
`_layout.test` asserts 5 visible in order + 5 hidden with `href:null`, `backBehavior==='history'`, transparent `sceneStyle`, per-tab `tabBarIcon`+accessible name, Library title, tint/bg equal TB-D2 tokens; `useTheme` mocked per phase (`jest.mock('@/hooks/useTheme')` returning daylight/golden/midnight `THEME_COLORS`).
`tabBarContrast.test` asserts selected/inactive label ≥4.5 and accent + focus-ring ≥3:1 on `bgCard` per phase with FU-1a contrast fn.
Reachability test asserts every §3 push target is a declared screen; fit test asserts over-wide label hides all labels but keeps accessible names.
## DONE CRITERIA
5 tabs/390px no truncation/⏷ glyphs (K3); text ≥4.5 indicator ≥3:1 all phases, RA-W01 closed (1.4.3/1.4.11); selected by filled icon+bold+indicator not colour alone (1.4.1); 200% zoom `scrollWidth`=viewport, D07-15 closed; 48dp targets, visible ring, role=tab+selected, order=visual (2.5.8/2.4.7/4.1.2); bar follows phase, quiet/unbadged (DP-04); §3 routes reachable + Back-to-origin; §7 tests pass + evidence recorded.
## QUESTIONS
none
