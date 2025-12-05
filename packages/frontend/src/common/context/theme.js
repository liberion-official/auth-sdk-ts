import { createContext, useContext, useState } from "react";
import { ThemeProvider as StyledThemeProvider } from "styled-components";
import { lightTheme, darkTheme } from "@/common/theme/themes";
import { THEME_MODES } from "@/common/constants";

const ThemeContext = createContext();

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState(THEME_MODES.DARK);

  const setTheme = (mode) => {
    if (mode === THEME_MODES.LIGHT || mode === THEME_MODES.DARK) {
      setThemeMode(mode);
    }
  };

  const currentTheme = themeMode === THEME_MODES.LIGHT ? lightTheme : darkTheme;

  const value = {
    theme: currentTheme,
    themeMode,
    setTheme,
    isDark: themeMode === THEME_MODES.DARK,
    isLight: themeMode === THEME_MODES.LIGHT,
  };

  return (
    <ThemeContext.Provider value={value}>
      <StyledThemeProvider theme={currentTheme}>{children}</StyledThemeProvider>
    </ThemeContext.Provider>
  );
};
