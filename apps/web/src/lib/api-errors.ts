import type { TFunction } from "i18next";

export function getLocalizedApiError(
  code: string | undefined,
  t: TFunction,
): string {
  if (!code) {
    return t("apiErrors.DEFAULT", "An unexpected error occurred. Please try again.");
  }

  const key = `apiErrors.${code}`;
  const translated = t(key);
  if (translated && translated !== key) {
    return translated;
  }

  return t("apiErrors.DEFAULT", "An unexpected error occurred. Please try again.");
}
