import { Redirect } from 'expo-router';

// FA-P1 prototype: dev builds only. In release bundles __DEV__ is false, so the require below is dead code and is stripped.
const Prototype: React.ComponentType | null = __DEV__
    ? require('@/prototypes/flowA/BookDetailsPrototypeRoute').default
    : null;

export default function DevFlowAPrototype() {
    if (!__DEV__ || !Prototype) return <Redirect href="/(tabs)/library" />;
    return <Prototype />;
}
