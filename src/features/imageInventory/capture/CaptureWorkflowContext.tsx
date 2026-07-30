import {
    createContext,
    type ReactNode,
    use,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import type { SelectedScanMedia } from './captureState';
import { registerCaptureCancellation } from './captureCancellation';

type CaptureWorkflow = Readonly<{
    selected: SelectedScanMedia | null;
    select: (media: SelectedScanMedia) => void;
    clear: () => void;
}>;

const Context = createContext<CaptureWorkflow | null>(null);

export function CaptureWorkflowProvider({ children }: { children: ReactNode }) {
    const [selected, setSelected] = useState<SelectedScanMedia | null>(null);
    const clear = useCallback(() => setSelected(null), []);
    useEffect(() => registerCaptureCancellation(clear), [clear]);
    const value = useMemo(() => ({ selected, select: setSelected, clear }), [clear, selected]);
    return <Context value={value}>{children}</Context>;
}

export function useCaptureWorkflow(): CaptureWorkflow {
    const value = use(Context);
    if (!value) throw new Error('Capture workflow provider is missing.');
    return value;
}
