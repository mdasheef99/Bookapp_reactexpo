import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { useLibraryTypography } from '@/components/library/LibraryTypography';

export const InLibraryBadge = () => {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();
    return (
        <View style={{
            backgroundColor: colors.tagBackground,
            paddingHorizontal: 9,
            minHeight: 24,
            borderRadius: 9,
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            borderWidth: 1,
            borderColor: colors.border,
        }}>
            <Ionicons name="checkmark-circle" size={14} color={colors.tagText} />
            <Text style={{ color: colors.tagText, fontSize: 11, fontFamily: fonts.label, marginLeft: 4 }}>In Library</Text>
        </View>
    );
};
