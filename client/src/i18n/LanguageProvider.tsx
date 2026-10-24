import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  LanguageContext,
  LANGUAGE_STORAGE_KEY,
  readLanguage,
  translators,
} from "./language";
import type { Language, LanguageState } from "./language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readLanguage);
  const value = useMemo<LanguageState>(
    () => ({
      ...translators(language),
      language,
      locale: language === "vi" ? "vi-VN" : "en-GB",
      setLanguage: (next) => {
        setLanguageState(next);
        try {
          localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
        } catch {
          // Storage can be disabled. Switching still works for the current visit.
        }
      },
    }),
    [language],
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === "vi" ? "BookFlow · Thư viện" : "BookFlow · Library";
  }, [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
