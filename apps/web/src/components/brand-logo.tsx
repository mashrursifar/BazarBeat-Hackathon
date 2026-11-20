import { type ImgHTMLAttributes, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

export interface BrandLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  alt?: string;
}

export function BrandLogo({
  className = "h-9 w-9 rounded-lg object-contain",
  alt,
  ...props
}: BrandLogoProps): ReactElement {
  const { i18n, t } = useTranslation();
  const isBangla = i18n.language?.startsWith("bn");
  const logoSrc = isBangla ? "/BazarBeat_Bng.svg" : "/BazarBeat_Eng.svg";
  const defaultAlt = t("appName");

  return (
    <img
      src={logoSrc}
      alt={alt ?? defaultAlt}
      data-testid="brand-logo"
      className={className}
      {...props}
    />
  );
}
