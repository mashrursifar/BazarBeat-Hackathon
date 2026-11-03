import { BANGLADESH_DISTRICTS, BANGLADESH_DIVISIONS, UserRole, registerSchema } from "@bazarbeat/shared";
import { type FormEvent, type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { LanguageSwitcher } from "../../components/language-switcher.js";
import { useAuth } from "./auth-context.js";
import * as authApi from "./auth-api.js";

function AuthFrame({ children }: { children: React.ReactNode }): ReactElement {
  const { t } = useTranslation();
  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Link className="text-lg font-extrabold tracking-tight text-primary" to="/">{t("appName")}</Link>
        <LanguageSwitcher />
      </header>
      <section className="mx-auto my-8 max-w-xl rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:my-12 sm:p-9">{children}</section>
    </main>
  );
}

function ServerError({ code }: { code: string }): ReactElement {
  const { t } = useTranslation();
  const known = ["CONFLICT", "RATE_LIMITED", "VALIDATION_ERROR", "UNAUTHENTICATED", "NETWORK_ERROR"];
  return <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{t(known.includes(code) ? `errors.${code}` : "errors.NETWORK_ERROR")}</p>;
}

export function LoginPage(): ReactElement {
  const { t } = useTranslation();
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (user !== null) return <Navigate to={user.role === UserRole.FARMER ? "/farmer/dashboard" : "/buyer/dashboard"} replace />;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const signedInUser = await signIn(phone, password);
      await navigate(signedInUser.role === UserRole.FARMER ? "/farmer/dashboard" : "/buyer/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "NETWORK_ERROR");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame>
      <h1 className="text-3xl font-bold">{t("login.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("login.description")}</p>
      {searchParams.get("registered") === "1" && <p role="status" className="mt-5 rounded-md bg-green-50 p-3 text-sm text-green-800">{t("login.registered")}</p>}
      <form className="mt-6 space-y-5" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm font-medium">{t("form.phone")}
          <input className="mt-1 min-h-12 w-full rounded-md border border-stone-300 px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" type="tel" autoComplete="tel" inputMode="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="block text-sm font-medium">{t("form.password")}
          <input className="mt-1 min-h-12 w-full rounded-md border border-stone-300 px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error !== null && <ServerError code={error} />}
        <button className="min-h-12 w-full rounded-md bg-primary px-4 font-semibold text-white disabled:opacity-60" disabled={pending}>{pending ? t("form.working") : t("login.submit")}</button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">{t("login.noAccount")} <Link className="font-semibold text-primary underline" to="/register">{t("login.createAccount")}</Link></p>
    </AuthFrame>
  );
}

export function RegisterPage(): ReactElement {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>(UserRole.FARMER);
  const [division, setDivision] = useState("");
  const [district, setDistrict] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (user !== null) return <Navigate to={user.role === UserRole.FARMER ? "/farmer/dashboard" : "/buyer/dashboard"} replace />;
  const availableDistricts = BANGLADESH_DISTRICTS.filter((item) => item.divisionId === division);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const common = {
      role,
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      password: String(form.get("password") ?? ""),
      division,
      district,
      ...(String(form.get("upazila") ?? "").trim() === "" ? {} : { upazila: String(form.get("upazila")) }),
    };
    const candidate = role === UserRole.BUYER
      ? { ...common, role, ...(String(form.get("organization") ?? "").trim() === "" ? {} : { organization: String(form.get("organization")) }) }
      : { ...common, role };
    const parsed = registerSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message === "Enter a valid Bangladesh mobile number" ? "INVALID_PHONE" : "INVALID_FORM");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await authApi.register(parsed.data);
      await navigate("/login?registered=1");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "NETWORK_ERROR");
    } finally {
      setPending(false);
    }
  }

  const locationName = (item: { nameEn: string; nameBn: string }): string => i18n.language === "bn" ? item.nameBn : item.nameEn;
  return (
    <AuthFrame>
      <h1 className="text-3xl font-bold">{t("register.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("register.description")}</p>
      <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("register.role")}</legend>
          <div className="grid grid-cols-2 gap-3">
            {([UserRole.FARMER, UserRole.BUYER] as const).map((value) => <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-md border p-3 ${role === value ? "border-primary bg-green-50" : "border-stone-300"}`}>
              <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} />
              <span className="text-sm font-medium">{t(`roles.${value}`)}</span>
            </label>)}
          </div>
        </fieldset>
        <label className="block text-sm font-medium">{t("form.name")}<input className="form-input" name="name" autoComplete="name" required maxLength={100} /></label>
        {role === UserRole.BUYER && <label className="block text-sm font-medium">{t("form.organizationOptional")}<input className="form-input" name="organization" autoComplete="organization" maxLength={160} /></label>}
        <label className="block text-sm font-medium">{t("form.phone")}<input className="form-input" name="phone" type="tel" autoComplete="tel" inputMode="tel" required /></label>
        <label className="block text-sm font-medium">{t("form.password")}<input className="form-input" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /><span className="mt-1 block text-xs text-muted-foreground">{t("register.passwordHint")}</span></label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">{t("form.division")}<select className="form-input" value={division} required onChange={(event) => { setDivision(event.target.value); setDistrict(""); }}><option value="">{t("form.choose")}</option>{BANGLADESH_DIVISIONS.map((item) => <option key={item.id} value={item.id}>{locationName(item)}</option>)}</select></label>
          <label className="block text-sm font-medium">{t("form.district")}<select className="form-input" value={district} required disabled={division === ""} onChange={(event) => setDistrict(event.target.value)}><option value="">{t("form.choose")}</option>{availableDistricts.map((item) => <option key={item.id} value={item.id}>{locationName(item)}</option>)}</select></label>
        </div>
        <label className="block text-sm font-medium">{t("form.upazilaOptional")}<input className="form-input" name="upazila" maxLength={100} /></label>
        {error !== null && <ServerError code={error} />}
        <button className="min-h-12 w-full rounded-md bg-primary px-4 font-semibold text-white disabled:opacity-60" disabled={pending}>{pending ? t("form.working") : t("register.submit")}</button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">{t("register.haveAccount")} <Link className="font-semibold text-primary underline" to="/login">{t("register.signIn")}</Link></p>
    </AuthFrame>
  );
}
