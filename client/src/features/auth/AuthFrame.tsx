import type { ReactNode } from "react";
import { LibraryArt } from "../../components/LibraryArt";
import { useTranslation } from "../../i18n/language";
export function AuthFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="auth-scene">
      <aside className="auth-story" aria-hidden="true">
        <p className="eyebrow">BookFlow</p>
        <p className="auth-story-heading">
          {t("Good books.")}
          <br />
          <span>{t("Simple borrowing.")}</span>
        </p>
        <LibraryArt />
        <p className="auth-story-note">
          {t("Find something worth turning the page for.")}
        </p>
      </aside>
      {children}
    </div>
  );
}
