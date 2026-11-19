import {
  BANGLADESH_DISTRICTS,
  BANGLADESH_DIVISIONS,
  UserRole,
  registerSchema,
} from "@bazarbeat/shared";
import { type FormEvent, type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { LanguageSwitcher } from "../../components/language-switcher.js";
import { DemoModeBadge } from "../../components/demo-mode-badge.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Select } from "../../components/ui/select.js";
import { useAuth } from "./auth-context.js";
import * as authApi from "./auth-api.js";

const BANGLADESH_COUNTRY_CALLING_CODE = "+880";

function toInternationalPhone(phone: string): string {
  const compact = phone.trim().replace(/[\s()-]/g, "");
  if (compact.startsWith("+")) return compact;
  return `${BANGLADESH_COUNTRY_CALLING_CODE}${compact.startsWith("0") ? compact.slice(1) : compact}`;
}

function registrationIssueKey(field: string, code: string, message: string): string {
  if (field === "password") {
    if (message === "Choose a less common password") return "validation.passwordCommon";
    if (code === "too_small") return "validation.passwordMin";
    if (code === "too_big") return "validation.passwordMax";
  }
  if (field === "phone") return "validation.phoneInvalid";
  if (field === "name")
    return code === "too_small" ? "validation.nameRequired" : "validation.nameMax";
  if (field === "division" || field === "district") return "validation.locationRequired";
  if (field === "organization") return "validation.organizationInvalid";
  if (field === "upazila") return "validation.upazilaInvalid";
  return "validation.fieldInvalid";
}

function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | undefined;
}): ReactElement | null {
  if (message === undefined) return null;
  return (
    <p id={id} className="mt-1 rounded-md bg-red-50 px-2 py-1 text-sm text-red-800">
      {message}
    </p>
  );
}

function AuthFrame({ children }: { children: React.ReactNode }): ReactElement {
  const { t } = useTranslation();
  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="text-lg font-extrabold tracking-tight text-primary" to="/">
            {t("appName")}
          </Link>
          <DemoModeBadge />
        </div>
        <LanguageSwitcher />
      </header>
      <section className="mx-auto my-8 max-w-xl rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:my-12 sm:p-9">
        {children}
      </section>
    </main>
  );
}

export function ServerError({ code }: { code: string }): ReactElement {
  const { t } = useTranslation();
  const known = [
    "CONFLICT",
    "RATE_LIMITED",
    "VALIDATION_ERROR",
    "UNAUTHENTICATED",
    "INVALID_CREDENTIALS",
    "NETWORK_ERROR",
    "INTERNAL",
  ];
  return (
    <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
      {t(known.includes(code) ? `errors.${code}` : "errors.API_ERROR")}
    </p>
  );
}

export function LoginPage(): ReactElement {
  const { t } = useTranslation();
  const { user, signIn, error: authError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (user !== null)
    return (
      <Navigate
        to={user.role === UserRole.FARMER ? "/farmer/dashboard" : "/buyer/dashboard"}
        replace
      />
    );

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const signedInUser = await signIn(toInternationalPhone(phone), password);
      await navigate(
        signedInUser.role === UserRole.FARMER ? "/farmer/dashboard" : "/buyer/dashboard",
      );
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "NETWORK_ERROR";
      setError(code === "UNAUTHENTICATED" ? "INVALID_CREDENTIALS" : code);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame>
      <h1 className="text-3xl font-bold">{t("login.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("login.description")}</p>
      {searchParams.get("registered") === "1" && (
        <p role="status" className="mt-5 rounded-md bg-green-50 p-3 text-sm text-green-800">
          {t("login.registered")}
        </p>
      )}
      <form className="mt-6 space-y-5" onSubmit={(event) => void submit(event)}>
        <div className="block text-sm font-medium">
          <label htmlFor="login-phone">{t("form.phone")}</label>
          <span className="mt-1 flex gap-2">
            <Select
              aria-label={t("form.countryCode")}
              defaultValue={BANGLADESH_COUNTRY_CALLING_CODE}
              className="shrink-0"
              style={{ width: "9.5rem" }}
            >
              <option value={BANGLADESH_COUNTRY_CALLING_CODE}>{t("form.bangladeshCode")}</option>
            </Select>
            <Input
              id="login-phone"
              type="tel"
              autoComplete="tel-national"
              inputMode="tel"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </span>
        </div>
        <label className="block text-sm font-medium">
          {t("form.password")}
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error !== null ? (
          <ServerError code={error} />
        ) : authError === "SESSION_EXPIRED" ? (
          <ServerError code="UNAUTHENTICATED" />
        ) : null}
        <Button disabled={pending}>{pending ? t("form.working") : t("login.submit")}</Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        {t("login.noAccount")}{" "}
        <Link className="font-semibold text-primary underline" to="/register">
          {t("login.createAccount")}
        </Link>
      </p>
    </AuthFrame>
  );
}

export function RegisterPage(): ReactElement {
  const { t, i18n } = useTranslation();
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole =
    searchParams.get("role")?.toUpperCase() === UserRole.BUYER
      ? UserRole.BUYER
      : UserRole.FARMER;
  const [role, setRole] = useState<UserRole>(initialRole);
  const [division, setDivision] = useState("");
  const [district, setDistrict] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function clearFieldError(field: string): void {
    setFieldErrors((current) => {
      if (current[field] === undefined) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  if (user !== null)
    return (
      <Navigate
        to={user.role === UserRole.FARMER ? "/farmer/dashboard" : "/buyer/dashboard"}
        replace
      />
    );
  const availableDistricts = BANGLADESH_DISTRICTS.filter((item) => item.divisionId === division);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const common = {
      role,
      name: String(form.get("name") ?? ""),
      phone: toInternationalPhone(String(form.get("phone") ?? "")),
      password: String(form.get("password") ?? ""),
      division,
      district,
      ...(String(form.get("upazila") ?? "").trim() === ""
        ? {}
        : { upazila: String(form.get("upazila")) }),
    };
    const candidate =
      role === UserRole.BUYER
        ? {
            ...common,
            role,
            ...(String(form.get("organization") ?? "").trim() === ""
              ? {}
              : { organization: String(form.get("organization")) }),
          }
        : { ...common, role };
    const parsed = registerSchema.safeParse(candidate);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]?.toString();
        if (field !== undefined)
          nextErrors[field] = registrationIssueKey(field, issue.code, issue.message);
      }
      setFieldErrors(nextErrors);
      setError(null);
      return;
    }
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      await authApi.register(parsed.data);
      const signedInUser = await signIn(parsed.data.phone, parsed.data.password);
      await navigate(
        signedInUser.role === UserRole.FARMER ? "/farmer/dashboard" : "/buyer/dashboard",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "NETWORK_ERROR");
    } finally {
      setPending(false);
    }
  }

  const locationName = (item: { nameEn: string; nameBn: string }): string =>
    i18n.language === "bn" ? item.nameBn : item.nameEn;
  return (
    <AuthFrame>
      <h1 className="text-3xl font-bold">{t("register.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("register.description")}</p>
      <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("register.role")}</legend>
          <div className="grid grid-cols-2 gap-3">
            {([UserRole.FARMER, UserRole.BUYER] as const).map((value) => (
              <label
                key={value}
                className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-md border p-3 ${role === value ? "border-primary bg-green-50" : "border-stone-300"}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                />
                <span className="text-sm font-medium">{t(`roles.${value}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-medium">
          {t("form.name")}
          <Input
            name="name"
            autoComplete="name"
            required
            maxLength={100}
            aria-invalid={fieldErrors.name !== undefined}
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
            onChange={() => clearFieldError("name")}
          />
          <FieldError
            id="name-error"
            message={fieldErrors.name ? t(fieldErrors.name) : undefined}
          />
        </label>
        {role === UserRole.BUYER && (
          <label className="block text-sm font-medium">
            {t("form.organizationOptional")}
            <Input
              name="organization"
              autoComplete="organization"
              maxLength={160}
              aria-invalid={fieldErrors.organization !== undefined}
              aria-describedby={fieldErrors.organization ? "organization-error" : undefined}
              onChange={() => clearFieldError("organization")}
            />
            <FieldError
              id="organization-error"
              message={fieldErrors.organization ? t(fieldErrors.organization) : undefined}
            />
          </label>
        )}
        <div className="block text-sm font-medium">
          <label htmlFor="register-phone">{t("form.phone")}</label>
          <span className="mt-1 flex gap-2">
            <Select
              name="countryCode"
              aria-label={t("form.countryCode")}
              defaultValue={BANGLADESH_COUNTRY_CALLING_CODE}
              className="shrink-0"
              style={{ width: "9.5rem" }}
            >
              <option value={BANGLADESH_COUNTRY_CALLING_CODE}>{t("form.bangladeshCode")}</option>
            </Select>
            <Input
              id="register-phone"
              name="phone"
              type="tel"
              autoComplete="tel-national"
              inputMode="tel"
              required
              aria-invalid={fieldErrors.phone !== undefined}
              aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
              onChange={() => clearFieldError("phone")}
            />
          </span>
          <FieldError
            id="phone-error"
            message={fieldErrors.phone ? t(fieldErrors.phone) : undefined}
          />
        </div>
        <div className="block text-sm font-medium">
          <label htmlFor="register-password">{t("form.password")}</label>
          <Input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            aria-invalid={fieldErrors.password !== undefined}
            aria-describedby={`password-hint${fieldErrors.password ? " password-error" : ""}`}
            onChange={() => clearFieldError("password")}
          />
          <span id="password-hint" className="mt-1 block text-xs text-muted-foreground">
            {t("register.passwordHint")}
          </span>
          <FieldError
            id="password-error"
            message={fieldErrors.password ? t(fieldErrors.password) : undefined}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {t("form.division")}
            <Select
              value={division}
              required
              onChange={(event) => {
                setDivision(event.target.value);
                setDistrict("");
                setFieldErrors((current) => {
                  const next = { ...current };
                  delete next.division;
                  delete next.district;
                  return next;
                });
              }}
              aria-invalid={fieldErrors.division !== undefined}
              aria-describedby={fieldErrors.division ? "division-error" : undefined}
            >
              <option value="">{t("form.choose")}</option>
              {BANGLADESH_DIVISIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {locationName(item)}
                </option>
              ))}
            </Select>
            <FieldError
              id="division-error"
              message={fieldErrors.division ? t(fieldErrors.division) : undefined}
            />
          </label>
          <label className="block text-sm font-medium">
            {t("form.district")}
            <Select
              value={district}
              required
              disabled={division === ""}
              onChange={(event) => {
                setDistrict(event.target.value);
                setFieldErrors((current) => {
                  const next = { ...current };
                  delete next.district;
                  return next;
                });
              }}
              aria-invalid={fieldErrors.district !== undefined}
              aria-describedby={fieldErrors.district ? "district-error" : undefined}
            >
              <option value="">{t("form.choose")}</option>
              {availableDistricts.map((item) => (
                <option key={item.id} value={item.id}>
                  {locationName(item)}
                </option>
              ))}
            </Select>
            <FieldError
              id="district-error"
              message={fieldErrors.district ? t(fieldErrors.district) : undefined}
            />
          </label>
        </div>
        <label className="block text-sm font-medium">
          {t("form.upazilaOptional")}
          <Input
            name="upazila"
            maxLength={100}
            aria-invalid={fieldErrors.upazila !== undefined}
            aria-describedby={fieldErrors.upazila ? "upazila-error" : undefined}
            onChange={() => clearFieldError("upazila")}
          />
          <FieldError
            id="upazila-error"
            message={fieldErrors.upazila ? t(fieldErrors.upazila) : undefined}
          />
        </label>
        {error !== null && <ServerError code={error} />}
        {Object.keys(fieldErrors).length > 0 && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {t("validation.checkFields")}
          </p>
        )}
        <Button disabled={pending}>{pending ? t("form.working") : t("register.submit")}</Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        {t("register.haveAccount")}{" "}
        <Link className="font-semibold text-primary underline" to="/login">
          {t("register.signIn")}
        </Link>
      </p>
    </AuthFrame>
  );
}
