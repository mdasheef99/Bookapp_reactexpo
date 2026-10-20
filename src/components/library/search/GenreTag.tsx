import { Text } from 'react-native';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';

export const GenreTag = ({ genre }: { genre: string }) => {
    const colors = useLibraryAppearance();
    return <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{genre}</Text>;
};
