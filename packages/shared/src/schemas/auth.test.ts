import { describe, expect, it } from "vitest";

import {
  authenticationCookiesSchema,
  loginSchema,
  publicUserSchema,
  refreshCookieSchema,
  registerSchema,
  updateProfileSchema,
} from "./auth.js";

const registration = {
  name: "A Farmer",
  phone: "01712345678",
  password: "harvest123",
  division: "dhaka",
  district: "dhaka",
};

describe("auth schemas", () => {
  it("normalizes phone and accepts farmer registration with optional upazila", () => {
    expect(registerSchema.parse({ ...registration, role: "FARMER" })).toMatchObject({
      ...registration,
      phone: "+8801712345678",
      role: "FARMER",
    });
  });

  it("allows organization for buyers and rejects it for farmers", () => {
    expect(registerSchema.safeParse({ ...registration, role: "BUYER", organization: "Co-op" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...registration, role: "FARMER", organization: "Co-op" }).success).toBe(false);
  });

  it("requires a valid role, location, and minimum password length", () => {
    expect(registerSchema.safeParse({ ...registration, role: "ADMIN" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...registration, role: "FARMER", district: "not-a-district" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...registration, role: "FARMER", password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...registration, role: "FARMER", password: "Password1" }).success).toBe(false);
  });

  it("validates login and requires at least one profile update", () => {
    expect(loginSchema.parse({ phone: "+8801712345678", password: "x" }).phone).toBe("+8801712345678");
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
    expect(updateProfileSchema.safeParse({ language: "bn" }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ division: "dhaka", district: "sylhet" }).success).toBe(false);
  });

  it("requires a non-empty refresh cookie", () => {
    expect(refreshCookieSchema.safeParse({ refreshToken: "signed-token" }).success).toBe(true);
    expect(refreshCookieSchema.safeParse({}).success).toBe(false);
  });

  it("validates access cookies and permits a missing refresh cookie during logout", () => {
    expect(authenticationCookiesSchema.safeParse({ accessToken: "signed-access" }).success).toBe(true);
    expect(authenticationCookiesSchema.safeParse({ refreshToken: "signed-refresh" }).success).toBe(false);
  });

  it("rejects password hashes from the safe public-user shape", () => {
    const safeUser = {
      id: "user-id",
      role: "FARMER",
      name: "A Farmer",
      division: "dhaka",
      district: "dhaka",
      language: "en",
    };
    expect(publicUserSchema.safeParse({ ...safeUser, passwordHash: "secret" }).success).toBe(false);
    expect(publicUserSchema.parse(safeUser)).not.toHaveProperty("passwordHash");
  });
});
