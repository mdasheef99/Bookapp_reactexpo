export function showWebEventPicker(input: { showPicker?: () => void }) {
    try {
        input.showPicker?.();
    } catch (error) {
        // Keyboard/programmatic focus can lack the browser's required user activation.
        // The input remains editable through its normal keyboard and calendar controls.
        if (error && typeof error === 'object' && 'name' in error && error.name === 'NotAllowedError') return;
        throw error;
    }
}
