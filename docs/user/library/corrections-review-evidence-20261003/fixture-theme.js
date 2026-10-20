import React from 'react';
export const FixtureTheme = React.createContext({ phase: 'daylight' });
export const useTheme = () => React.useContext(FixtureTheme);
