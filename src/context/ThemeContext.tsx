/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Theme } from '../theme';

interface ThemeContextType {
  theme: any; // Using any to avoid strict typing issues with dynamic theme switching
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  const theme = {
    colors: isDark ? {
      ...Theme.colors,
      background: Theme.colors.backgroundDark,
      backgroundSecondary: Theme.colors.backgroundSecondaryDark,
      text: Theme.colors.textDark,
      textSecondary: Theme.colors.textSecondaryDark,
      textMuted: Theme.colors.textMutedDark,
      border: Theme.colors.borderDark,
      divider: Theme.colors.dividerDark,
      shadow: Theme.colors.shadowDark,
      userMessage: Theme.colors.userMessageDark,
      agentMessage: Theme.colors.agentMessageDark,
    } : Theme.colors,
    typography: Theme.typography,
    spacing: Theme.spacing,
    borderRadius: Theme.borderRadius,
    iconSizes: Theme.iconSizes,
  };

  const value: ThemeContextType = {
    theme,
    isDark,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};