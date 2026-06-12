/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('anivault-theme') || 'luxury-gold';
  });

  const [defaultServer, setDefaultServerState] = useState(() => {
    return localStorage.getItem('anivault-default-server') || 'koto';
  });

  const [nsfw, setNsfwState] = useState(() => {
    return localStorage.getItem('anivault-nsfw') === 'true';
  });

  // Apply theme class/attribute on load or change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('anivault-theme', theme);
  }, [theme]);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
  };

  const setDefaultServer = (newServer) => {
    setDefaultServerState(newServer);
    localStorage.setItem('anivault-default-server', newServer);
  };

  const setNsfw = (val) => {
    setNsfwState(val);
    localStorage.setItem('anivault-nsfw', val);
  };

  const value = {
    theme,
    defaultServer,
    nsfw,
    setTheme,
    setDefaultServer,
    setNsfw
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export default SettingsContext;
