import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function StoreOwnerLayout() {
    return (
        <Tabs screenOptions={{ headerShown: false }}>
            <Tabs.Screen
                name="index"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="onboarding"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="status"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="setup"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                        <Ionicons name="grid-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="inventory"
                options={{
                    title: 'Inventory',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                        <Ionicons name="book-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="storefront"
                options={{
                    title: 'Storefront',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                        <Ionicons name="storefront-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="orders"
                options={{
                    title: 'Orders',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                        <Ionicons name="receipt-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="orders/[requestId]"
                options={{ href: null }}
            />
            <Tabs.Screen
                name="subscription"
                options={{
                    title: 'Subscription',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                        <Ionicons name="card-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
