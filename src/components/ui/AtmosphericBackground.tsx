import { View, StyleSheet, Image } from 'react-native';
import { useAtmosphericTheme } from '@/hooks/useAtmosphericTheme';

interface Props {
    children: React.ReactNode;
}

export const AtmosphericBackground: React.FC<Props> = ({ children }) => {
    const phase = useAtmosphericTheme();

    // Map phases to background images
    return (
        <View style={styles.container} className={`${phase} bg-[--bg-primary]`}>
            {/* Background Image REMOVED as per user request */}

            {/* Main Content */}
            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    overlay: {
        opacity: 0.85, // Restored to original value for contrast
    },
    content: {
        flex: 1,
    }
});
