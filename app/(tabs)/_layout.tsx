import { Tabs } from 'expo-router';

export default function TabsLayout() {
    return (
        <Tabs screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: 'transparent' },
        }}>
            <Tabs.Screen name="library" options={{ title: 'My Library' }} />
            <Tabs.Screen name="exchange" options={{ title: 'Exchange' }} />
            <Tabs.Screen name="clubs" options={{ title: 'Clubs' }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        </Tabs>
    );
}
