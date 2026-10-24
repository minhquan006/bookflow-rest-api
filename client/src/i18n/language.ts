import { createContext, useContext } from "react";
import { vi } from "./vi";

export type Language = "en" | "vi";
export type TranslationKey = keyof typeof vi;
type Values = Record<string, string | number>;
export const LANGUAGE_STORAGE_KEY = "bookflow.language";

export function translateText(
  language: Language,
  text: string,
  values?: Values,
) {
  let translated =
    language === "vi" && Object.hasOwn(vi, text)
      ? vi[text as TranslationKey]
      : text;
  if (language === "vi" && translated === text) {
    // Validation details come from the API. Keep unrecognized messages intact.
    const minimum =
      /^Too small: expected string to have >=(\d+) characters$/.exec(text);
    const loanLimit = /^A member may hold at most (\d+) active loans\.$/.exec(
      text,
    );
    const maximum =
      /^Too big: expected string to have <=(\d+) characters$/.exec(text);
    if (loanLimit)
      translated = `Bạn chỉ được mượn tối đa ${loanLimit[1]} cuốn sách cùng lúc.`;
    else if (minimum) translated = `Vui lòng nhập ít nhất ${minimum[1]} ký tự.`;
    else if (maximum) translated = `Vui lòng nhập tối đa ${maximum[1]} ký tự.`;
    else if (text === "Invalid email address")
      translated = "Địa chỉ email không hợp lệ.";
    else if (text === "Invalid UUID") translated = "Mã UUID không hợp lệ.";
    else if (/^Request failed \(HTTP \d+\)$/.test(text))
      translated = text.replace("Request failed", "Yêu cầu thất bại");
  }
  // Replace only placeholders supplied by the caller; values remain plain React text.
  return translated.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    values && Object.hasOwn(values, key) ? String(values[key]) : placeholder,
  );
}

export function readLanguage(): Language {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "vi" ? "vi" : "en";
  } catch {
    return "en";
  }
}

export function translators(language: Language) {
  return {
    t: (key: TranslationKey, values?: Values) =>
      translateText(language, key, values),
    translate: (text: string) => translateText(language, text),
  };
}

export type LanguageState = ReturnType<typeof translators> & {
  language: Language;
  locale: "en-GB" | "vi-VN";
  setLanguage: (language: Language) => void;
};
// Isolated shared components can render in English without an application provider.
export const LanguageContext = createContext<LanguageState>({
  ...translators("en"),
  language: "en",
  locale: "en-GB",
  setLanguage: () => {},
});

export function useTranslation() {
  return useContext(LanguageContext);
}
