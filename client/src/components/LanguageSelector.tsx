import { useId } from "react";
import { useTranslation } from "../i18n/language";

export function LanguageSelector() {
  const id = useId();
  const { language, setLanguage, t } = useTranslation();
  return (
    <div className="language-selector">
      <label htmlFor={id}>{t("Language")}</label>
      <select
        id={id}
        value={language}
        onChange={(event) =>
          setLanguage(event.target.value === "vi" ? "vi" : "en")
        }
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="vi" lang="vi">
          Tiếng Việt
        </option>
      </select>
    </div>
  );
}
