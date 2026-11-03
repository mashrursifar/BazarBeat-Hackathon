import { type PublicUser } from "@bazarbeat/shared";
import { type ReactElement, type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";

import * as authApi from "./auth-api.js";
import { i18n } from "../../lib/i18n.js";

type AuthState = {
  user: PublicUser | null;
  loading: boolean;
  error: string | null;
  signIn: (phone: string, password: string) => Promise<PublicUser>;
  signOut: () => Promise<void>;
  setUser: (user: PublicUser) => void;
  retry: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void authApi.getCurrentUser().then((currentUser) => {
      if (active) {
        setUser(currentUser);
        void i18n.changeLanguage(currentUser.language);
        setError(null);
      }
    }).catch((reason: unknown) => {
      if (!active) return;
      const message = reason instanceof Error ? reason.message : "NETWORK_ERROR";
      if (message === "UNAUTHENTICATED") {
        setUser(null);
        setError(null);
      } else {
        setError(message);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return (): void => { active = false; };
  }, [attempt]);

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    error,
    signIn: async (phone, password): Promise<PublicUser> => {
      const nextUser = await authApi.login({ phone, password });
      setUser(nextUser);
      void i18n.changeLanguage(nextUser.language);
      setError(null);
      return nextUser;
    },
    signOut: async (): Promise<void> => {
      await authApi.logout();
      setUser(null);
    },
    setUser,
    retry: (): void => setAttempt((value) => value + 1),
  }), [error, loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (state === null) throw new Error("useAuth must be used inside AuthProvider");
  return state;
}
