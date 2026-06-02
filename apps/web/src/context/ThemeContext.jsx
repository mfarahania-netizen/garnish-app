import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    return localStorage.getItem('garnish_dark_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('garnish_dark_mode', dark);
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