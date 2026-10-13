import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { authStorage } from '@/services/auth-storage';

export type AppLanguage = 'en' | 'my';

const STORAGE_KEY = 'clinify.language';

const LanguageContext = createContext<{
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}>({
  language: 'en',
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('en');

  useEffect(() => {
    const stored = authStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'my') {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    authStorage.setItem(STORAGE_KEY, next);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
