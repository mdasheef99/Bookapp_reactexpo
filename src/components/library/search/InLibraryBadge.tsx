import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LIBRARY_SPACING, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { ICON_SIZE } from '@/components/library/bookDetails/bookDetailsTokens';

export const InLibraryBadge = () => {
    const colors = useLibraryAppearance();
    return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: LIBRARY_SPACING.xxs }}>
        <Ionicons name="checkmark-circle" size={ICON_SIZE} color={colors.textSecondary} />
        <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>In your library</Text>
    </View>;
};
