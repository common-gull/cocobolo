import { useMantineColorScheme, MantineColorScheme } from '@mantine/core';
import { useAtom, useAtomValue } from 'jotai';
import { useEffect } from 'react';

import { themeAtom, effectiveThemeAtom } from '../stores/notesStore';

export function useTheme() {
  const [theme, setTheme] = useAtom(themeAtom);
  const effectiveTheme = useAtomValue(effectiveThemeAtom);
  const { setColorScheme } = useMantineColorScheme();

  // Listen for system theme changes and update the atom directly
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      // Force re-evaluation of systemThemeAtom by triggering a re-render
      // The atom will automatically pick up the new system preference
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Apply theme to document and Mantine
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.className = effectiveTheme;
    
    // Update Mantine color scheme
    const mantineColorScheme: MantineColorScheme = theme === 'system' ? 'auto' : theme;
    setColorScheme(mantineColorScheme);
  }, [effectiveTheme, theme, setColorScheme]);

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  return { 
    theme, 
    effectiveTheme, 
    setTheme, 
    toggleTheme 
  };
} 