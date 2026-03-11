/**
 * Mock for @expo/vector-icons
 *
 * Used across many components: Ionicons
 * API: <Ionicons name="search" size={24} color="#000" />
 */
import React from 'react';
import { Text } from 'react-native';

const createIconMock = (displayName: string) => {
  const IconComponent = ({ name, testID, ...props }: any) => (
    <Text testID={testID} {...props}>
      {name}
    </Text>
  );
  IconComponent.displayName = displayName;
  return IconComponent;
};

export const Ionicons = createIconMock('Ionicons');
export const MaterialIcons = createIconMock('MaterialIcons');
export const MaterialCommunityIcons = createIconMock('MaterialCommunityIcons');
export const FontAwesome = createIconMock('FontAwesome');
export const FontAwesome5 = createIconMock('FontAwesome5');
export const Feather = createIconMock('Feather');
export const AntDesign = createIconMock('AntDesign');
export const Entypo = createIconMock('Entypo');

