import { Tabs } from 'expo-router';

export default function TabsLayout() {
    return (
        <Tabs screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: 'transparent' },
        }}>
            <Tabs.Screen name="library" options={{ title: 'My Library' }} />
            <Tabs.Screen name="exchange" options={{ title: 'Exchange' }} />
            <Tabs.Screen name="marketplace/index" options={{ title: 'Marketplace' }} />
            <Tabs.Screen name="clubs" options={{ title: 'Clubs' }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
            <Tabs.Screen name="credit-history" options={{ href: null }} />
            <Tabs.Screen name="addresses" options={{ href: null }} />
            <Tabs.Screen name="marketplace/store/[storeId]" options={{ href: null }} />
        </Tabs>
    );
}
