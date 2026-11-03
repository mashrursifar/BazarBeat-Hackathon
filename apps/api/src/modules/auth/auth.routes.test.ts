import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicUser, RegisterInput } from "@bazarbeat/shared";

const { registerUserMock } = vi.hoisted(() => ({
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

vi.mock("./auth.service.js", () => ({ registerUser: registerUserMock }));

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
  });

  it("creates an account and returns only the safe public-user shape", async () => {
    const response = await request(app).post("/api/v1/auth/register").send(validRegistration);

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
      .send({ ...validRegistration, role: "ADMIN", extra: "not allowed" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it("returns a conflict when the phone number is already registered", async () => {
    registerUserMock.mockRejectedValueOnce(new AppError(409, "CONFLICT", "Account already exists"));

    const response = await request(app).post("/api/v1/auth/register").send(validRegistration);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });
});
