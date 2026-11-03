import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactElement, type ReactNode, useState } from "react";

import "../lib/i18n.js";
import { AuthProvider } from "../features/auth/auth-context.js";

export function AppProviders({ children }: { children: ReactNode }): ReactElement {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
}
