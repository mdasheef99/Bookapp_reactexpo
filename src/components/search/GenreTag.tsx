import { View, Text } from 'react-native';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { useLibraryTypography } from '@/components/library/LibraryTypography';

interface GenreTagProps {
    genre: string;
}

export const GenreTag = ({ genre }: GenreTagProps) => {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();
    return (
        <View style={{
            backgroundColor: colors.tagBackground,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            marginRight: 6,
            marginBottom: 4,
        }}>
            <Text style={{ color: colors.tagText, fontSize: 10, fontFamily: fonts.label }}>{genre}</Text>
        </View>
    );
};
