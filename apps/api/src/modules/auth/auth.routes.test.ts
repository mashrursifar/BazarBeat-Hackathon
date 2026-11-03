import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LoginInput, PublicUser, RegisterInput } from "@bazarbeat/shared";

const { authenticateAccessTokenMock, loginUserMock, logoutUserMock, refreshUserSessionMock, registerUserMock } = vi.hoisted(() => ({
  authenticateAccessTokenMock: vi.fn(async (token: string): Promise<PublicUser> => {
    void token;
    return {
      id: "user-id",
      role: "FARMER",
      name: "Farmer One",
      division: "dhaka",
      district: "dhaka",
      language: "en",
    };
  }),
  loginUserMock: vi.fn(async (input: LoginInput): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> => {
    void input;
    return {
      user: {
        id: "user-id",
        role: "FARMER",
        name: "Farmer One",
        division: "dhaka",
        district: "dhaka",
        language: "en",
      },
      accessToken: "signed-access-token",
      refreshToken: "signed-refresh-token",
    };
  }),
  refreshUserSessionMock: vi.fn(async (token: string): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> => {
    void token;
    return {
      user: {
        id: "user-id",
        role: "FARMER",
        name: "Farmer One",
        division: "dhaka",
        district: "dhaka",
        language: "en",
      },
      accessToken: "rotated-access-token",
      refreshToken: "rotated-refresh-token",
    };
  }),
  logoutUserMock: vi.fn(async (_userId: string, token?: string): Promise<void> => {
    void _userId;
    void token;
  }),
  registerUserMock: vi.fn(async (input: RegisterInput): Promise<PublicUser> => {
    void input;
    return {
      id: "user-id",
      role: "FARMER",
      name: "Farmer One",
      division: "dhaka",
      district: "dhaka",
      language: "en",
    };
  }),
}));

vi.mock("./auth.service.js", () => ({
  authenticateAccessToken: authenticateAccessTokenMock,
  loginUser: loginUserMock,
  logoutUser: logoutUserMock,
  refreshUserSession: refreshUserSessionMock,
  registerUser: registerUserMock,
}));

import { AppError } from "../../shared/errors.js";
import { app } from "../../app.js";

const validRegistration = {
  role: "FARMER",
  name: "Farmer One",
  phone: "01712345678",
  password: "GoodHarvest!58",
  division: "dhaka",
  district: "dhaka",
};

describe("POST /api/v1/auth/register", () => {
  beforeEach(() => {
    registerUserMock.mockClear();
    loginUserMock.mockClear();
    refreshUserSessionMock.mockClear();
    authenticateAccessTokenMock.mockClear();
    logoutUserMock.mockClear();
  });

  it("requires the CSRF header", async () => {
    const response = await request(app).post("/api/v1/auth/register").send(validRegistration);

    expect(response.status).toBe(403);
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it("creates an account and returns only the safe public-user shape", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("X-CSRF-Protection", "1")
      .send(validRegistration);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        id: "user-id",
        role: "FARMER",
        name: "Farmer One",
        division: "dhaka",
        district: "dhaka",
        language: "en",
      },
    });
    expect(registerUserMock).toHaveBeenCalledOnce();
  });

  it("rejects invalid input and does not call the service", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("X-CSRF-Protection", "1")
      .send({ ...validRegistration, role: "ADMIN", extra: "not allowed" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it("returns a conflict when the phone number is already registered", async () => {
    registerUserMock.mockRejectedValueOnce(new AppError(409, "CONFLICT", "Account already exists"));

    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("X-CSRF-Protection", "1")
      .send(validRegistration);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });
});

describe("POST /api/v1/auth/login", () => {
  beforeEach(() => {
    loginUserMock.mockClear();
  });

  it("returns the public user and sets secure HttpOnly session cookies", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("X-CSRF-Protection", "1")
      .send({ phone: "01712345678", password: "GoodHarvest!58" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        id: "user-id",
        role: "FARMER",
        name: "Farmer One",
        division: "dhaka",
        district: "dhaka",
        language: "en",
      },
    });
    const cookies = response.headers["set-cookie"];
    expect(cookies).toHaveLength(2);
    expect(cookies?.[0]).toContain("accessToken=signed-access-token");
    expect(cookies?.[0]).toContain("HttpOnly");
    expect(cookies?.[0]).toContain("SameSite=Lax");
    expect(cookies?.[1]).toContain("refreshToken=signed-refresh-token");
    expect(cookies?.[1]).toContain("Path=/api/v1/auth");
  });

  it("requires the CSRF header and validates login input", async () => {
    const csrfResponse = await request(app).post("/api/v1/auth/login").send({});
    const validationResponse = await request(app)
      .post("/api/v1/auth/login")
      .set("X-CSRF-Protection", "1")
      .send({ phone: "bad", password: "" });

    expect(csrfResponse.status).toBe(403);
    expect(validationResponse.status).toBe(400);
    expect(loginUserMock).not.toHaveBeenCalled();
  });

  it("returns a generic unauthorized response for invalid credentials", async () => {
    loginUserMock.mockRejectedValueOnce(new AppError(401, "UNAUTHENTICATED", "Phone number or password is incorrect"));

    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("X-CSRF-Protection", "1")
      .send({ phone: "01712345678", password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/v1/auth/refresh", () => {
  beforeEach(() => {
    refreshUserSessionMock.mockClear();
  });

  it("rotates the refresh cookie and returns the public user", async () => {
    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("X-CSRF-Protection", "1")
      .set("Cookie", "refreshToken=old-refresh-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: "user-id", role: "FARMER" });
    expect(response.headers["set-cookie"]?.[1]).toContain("refreshToken=rotated-refresh-token");
    expect(refreshUserSessionMock).toHaveBeenCalledWith("old-refresh-token");
  });

  it("rejects requests without a refresh cookie or CSRF header", async () => {
    const missingCookie = await request(app).post("/api/v1/auth/refresh").set("X-CSRF-Protection", "1");
    const missingCsrf = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", "refreshToken=old-refresh-token");

    expect(missingCookie.status).toBe(401);
    expect(missingCsrf.status).toBe(403);
    expect(refreshUserSessionMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/auth/logout", () => {
  beforeEach(() => {
    logoutUserMock.mockClear();
  });

  it("revokes the refresh cookie and clears both session cookies", async () => {
    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("X-CSRF-Protection", "1")
      .set("Cookie", "accessToken=valid-access; refreshToken=valid-refresh");

    expect(response.status).toBe(204);
    expect(logoutUserMock).toHaveBeenCalledWith("user-id", "valid-refresh");
    const cookies = response.headers["set-cookie"];
    expect(cookies).toHaveLength(2);
    expect(cookies?.[0]).toContain("accessToken=");
    expect(cookies?.[0]).toContain("Path=/");
    expect(cookies?.[1]).toContain("refreshToken=");
    expect(cookies?.[1]).toContain("Path=/api/v1/auth");
    expect(cookies?.[0]).toContain("Expires=Thu, 01 Jan 1970");
  });

  it("requires authentication and the CSRF header", async () => {
    const missingSession = await request(app).post("/api/v1/auth/logout").set("X-CSRF-Protection", "1");
    const missingCsrf = await request(app).post("/api/v1/auth/logout").set("Cookie", "accessToken=valid-access");

    expect(missingSession.status).toBe(401);
    expect(missingCsrf.status).toBe(403);
    expect(logoutUserMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/me", () => {
  beforeEach(() => {
    authenticateAccessTokenMock.mockClear();
  });

  it("returns the authenticated public user without private fields", async () => {
    const response = await request(app).get("/api/v1/me").set("Cookie", "accessToken=valid-access");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: "user-id", role: "FARMER", name: "Farmer One" });
    expect(response.body.data).not.toHaveProperty("phone");
    expect(response.body.data).not.toHaveProperty("passwordHash");
    expect(authenticateAccessTokenMock).toHaveBeenCalledWith("valid-access");
  });

  it("rejects requests without an access cookie", async () => {
    const response = await request(app).get("/api/v1/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });
});
