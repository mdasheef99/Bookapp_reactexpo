import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const InLibraryBadge = () => (
    <View style={{
        backgroundColor: '#6366F1',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
    }}>
        <Ionicons name="checkmark-circle" size={14} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>In Library</Text>
    </View>
);
