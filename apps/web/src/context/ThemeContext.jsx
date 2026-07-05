import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage?.getItem('garnish_dark_mode') === 'true';
  });

  useEffect(() => {
    const theme = dark ? 'dark' : 'light';
    try {
      window.localStorage?.setItem('garnish_dark_mode', String(dark));
    } catch {
      // Storage can be unavailable in private/test contexts; the DOM theme still applies.
    }
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
  }, [dark]);

  const toggleDark = () => setDark(!dark);

  return (
    <ThemeContext.Provider value={{ dark, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
