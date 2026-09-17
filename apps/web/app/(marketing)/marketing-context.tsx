'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Locale = 'ar' | 'en';
type Theme = 'light' | 'dark';
type MarketingContextValue = {
  locale: Locale;
  theme: Theme;
  ar: boolean;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  toggleTheme: () => void;
};

const MarketingContext = createContext<MarketingContextValue | null>(null);

export function MarketingProvider({ children }: { children: React.ReactNode }) {
  const [locale, updateLocale] = useState<Locale>('ar');
  const [theme, updateTheme] = useState<Theme>('light');

  useEffect(() => {
    updateLocale(localStorage.getItem('locale') === 'en' ? 'en' : 'ar');
    updateTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  const setLocale = (next: Locale) => {
    localStorage.setItem('locale', next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    updateLocale(next);
    window.dispatchEvent(new CustomEvent('system-locale-changed', { detail: next }));
  };

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    document.documentElement.dataset.theme = next;
    updateTheme(next);
  };

  const value = useMemo(() => ({
    locale,
    theme,
    ar: locale === 'ar',
    setLocale,
    toggleLocale: () => setLocale(locale === 'ar' ? 'en' : 'ar'),
    toggleTheme,
  }), [locale, theme]);

  return <MarketingContext.Provider value={value}>{children}</MarketingContext.Provider>;
}

export function useMarketing() {
  const context = useContext(MarketingContext);
  if (!context) throw new Error('useMarketing must be used inside MarketingProvider');
  return context;
}
