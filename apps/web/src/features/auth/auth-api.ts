import {
  type LoginInput,
  type PublicUser,
  type RegisterInput,
  type UpdateProfileInput,
  publicUserSchema,
  updateProfileSchema,
} from "@bazarbeat/shared";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

type Envelope<T> = { data: T };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(init.method === "GET" || init.method === undefined ? {} : { "X-CSRF-Protection": "1" }),
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(await readError(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body) {
      const error = body.error;
      if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
        return error.code;
      }
    }
  } catch {
    return "NETWORK_ERROR";
  }
  return response.status === 401 ? "UNAUTHENTICATED" : "NETWORK_ERROR";
}

function parseUser(envelope: Envelope<unknown>): PublicUser {
  return publicUserSchema.parse(envelope.data);
}

export async function getCurrentUser(): Promise<PublicUser> {
  try {
    return parseUser(await request<Envelope<unknown>>("/me"));
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "UNAUTHENTICATED") throw error;
    await request("/auth/refresh", { method: "POST" });
    return parseUser(await request<Envelope<unknown>>("/me"));
  }
}

export async function login(input: LoginInput): Promise<PublicUser> {
  return parseUser(await request<Envelope<unknown>>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function register(input: RegisterInput): Promise<void> {
  await request("/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export async function logout(): Promise<void> {
  try {
    await request("/auth/logout", { method: "POST" });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "UNAUTHENTICATED") throw error;
    await request("/auth/refresh", { method: "POST" });
    await request("/auth/logout", { method: "POST" });
  }
}

export async function updateProfile(input: UpdateProfileInput): Promise<PublicUser> {
  const safeInput = updateProfileSchema.parse(input);
  return parseUser(await request<Envelope<unknown>>("/me", {
    method: "PATCH",
    body: JSON.stringify(safeInput),
  }));
}
