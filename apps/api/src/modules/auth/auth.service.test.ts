import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createUserMock } = vi.hoisted(() => ({ createUserMock: vi.fn() }));
vi.mock("../users/user.model.js", () => ({ User: { create: createUserMock } }));

import { User } from "../users/user.model.js";
import { registerUser } from "./auth.service.js";

import type { RegisterInput } from "@bazarbeat/shared";

const registration: RegisterInput = {
  role: "FARMER",
  name: "Farmer One",
  phone: "+8801712345678",
  password: "GoodHarvest!58",
  division: "dhaka",
  district: "dhaka",
};

const savedUser = {
  id: "user-id",
  role: "FARMER",
  name: "Farmer One",
  division: "dhaka",
  district: "dhaka",
  language: "en",
} as unknown as Awaited<ReturnType<typeof User.create>>;

describe("registerUser", () => {
  beforeEach(() => {
    createUserMock.mockReset();
    createUserMock.mockResolvedValue(savedUser);
  });

  it("stores a bcrypt cost-12 hash and returns the safe user response", async () => {
    const result = await registerUser(registration);

    expect(result).toEqual({
      id: "user-id",
      role: "FARMER",
      name: "Farmer One",
      division: "dhaka",
      district: "dhaka",
      language: "en",
    });
    const createArgument: unknown = createUserMock.mock.calls[0]?.[0];
    expect(createArgument).toMatchObject({ passwordHash: expect.stringMatching(/^\$2[aby]\$12\$/) });
    expect(createArgument).not.toHaveProperty("password");
    const passwordHash = (createArgument as { passwordHash: string }).passwordHash;
    await expect(bcrypt.compare(registration.password, passwordHash)).resolves.toBe(true);
  });

  it("converts duplicate-key errors into a conflict", async () => {
    createUserMock.mockRejectedValueOnce({ code: 11000 });

    await expect(registerUser(registration)).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
  });
});
