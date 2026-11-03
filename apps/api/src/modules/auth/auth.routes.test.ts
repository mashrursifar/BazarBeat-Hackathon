import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LoginInput, PublicUser, RegisterInput } from "@bazarbeat/shared";

const { loginUserMock, registerUserMock } = vi.hoisted(() => ({
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

vi.mock("./auth.service.js", () => ({ loginUser: loginUserMock, registerUser: registerUserMock }));

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
