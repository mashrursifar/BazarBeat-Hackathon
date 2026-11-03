import { Language } from "@bazarbeat/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../features/auth/auth-context.js";
import { updateProfile } from "../features/auth/auth-api.js";

export function LanguageSwitcher(): React.ReactElement {
  const { i18n, t } = useTranslation();
  const { user, setUser } = useAuth();
  const [saveError, setSaveError] = useState(false);
  async function changeLanguage(language: Language): Promise<void> {
    setSaveError(false);
    await i18n.changeLanguage(language);
    if (user === null) return;
    try {
      setUser(await updateProfile({ language }));
    } catch {
      setSaveError(true);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1" aria-label={t("language") }>
        <button type="button" className="min-h-11 rounded px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2" aria-pressed={i18n.language === Language.EN} onClick={() => void changeLanguage(Language.EN)}>{t("english")}</button>
        <button type="button" className="min-h-11 rounded px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2" aria-pressed={i18n.language === Language.BN} onClick={() => void changeLanguage(Language.BN)}>{t("bangla")}</button>
      </div>
      {saveError && <span className="sr-only" role="status">{t("languageSaveFailed")}</span>}
    </div>
  );
}
