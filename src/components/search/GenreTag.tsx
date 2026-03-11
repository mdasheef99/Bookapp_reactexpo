import { View, Text } from 'react-native';
import { GENRE_COLORS } from '@/lib/constants';

interface GenreTagProps {
    genre: string;
}

export const GenreTag = ({ genre }: GenreTagProps) => {
    const color = GENRE_COLORS[genre] || GENRE_COLORS['default'];
    return (
        <View style={{
            backgroundColor: color + '20',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: color + '40',
            marginRight: 6,
            marginBottom: 4,
        }}>
            <Text style={{ color, fontSize: 10, fontWeight: '600' }}>{genre}</Text>
        </View>
    );
};
