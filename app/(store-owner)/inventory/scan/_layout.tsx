import { Stack } from 'expo-router';
import { CaptureWorkflowProvider } from '@/features/imageInventory/capture/CaptureWorkflowContext';

export default function InventoryScanLayout() {
    return (
        <CaptureWorkflowProvider>
            <Stack>
                <Stack.Screen name="index" options={{ title: 'Scan book spines' }} />
                <Stack.Screen name="preview" options={{ title: 'Image preview' }} />
                <Stack.Screen name="[sessionId]" options={{ headerShown: false }} />
            </Stack>
        </CaptureWorkflowProvider>
    );
}
