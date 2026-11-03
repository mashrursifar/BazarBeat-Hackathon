import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createRefreshSessionMock,
  createUserMock,
  deleteRefreshSessionMock,
  findRefreshSessionMock,
  findUserByIdMock,
  findUserMock,
  updateRefreshSessionMock,
  updateRefreshSessionsMock,
} = vi.hoisted(() => ({
  createRefreshSessionMock: vi.fn(),
  createUserMock: vi.fn(),
  deleteRefreshSessionMock: vi.fn(),
  findRefreshSessionMock: vi.fn(),
  findUserByIdMock: vi.fn(),
  findUserMock: vi.fn(),
  updateRefreshSessionMock: vi.fn(),
  updateRefreshSessionsMock: vi.fn(),
}));
vi.mock("../users/user.model.js", () => ({
  User: { create: createUserMock, findById: findUserByIdMock, findOne: findUserMock },
}));
vi.mock("./refresh-session.model.js", () => ({
  RefreshSession: {
    create: createRefreshSessionMock,
    deleteOne: deleteRefreshSessionMock,
    findOne: findRefreshSessionMock,
    findOneAndUpdate: updateRefreshSessionMock,
    updateMany: updateRefreshSessionsMock,
  },
}));

import { User } from "../users/user.model.js";
import { loginUser, refreshUserSession, registerUser } from "./auth.service.js";
import { createSessionTokens, hashRefreshToken } from "./tokens.js";

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
    findUserMock.mockReset();
    findUserByIdMock.mockReset();
    createRefreshSessionMock.mockReset();
    createRefreshSessionMock.mockResolvedValue({});
    findRefreshSessionMock.mockReset();
    updateRefreshSessionMock.mockReset();
    deleteRefreshSessionMock.mockReset();
    updateRefreshSessionsMock.mockReset();
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

  it("verifies the password, stores only a refresh-token hash, and returns session tokens", async () => {
    const passwordHash = await bcrypt.hash(registration.password, 12);
    const user = {
      ...savedUser,
      _id: { toString: (): string => "user-id" },
      passwordHash,
      isActive: true,
    };
    const selectPasswordHash = vi.fn().mockResolvedValue(user);
    findUserMock.mockReturnValue({ select: selectPasswordHash });

    const result = await loginUser({ phone: registration.phone, password: registration.password });

    expect(selectPasswordHash).toHaveBeenCalledWith("+passwordHash");
    expect(result.user).toMatchObject({ id: "user-id", role: "FARMER" });
    expect(result.accessToken.split(".")).toHaveLength(3);
    expect(result.refreshToken.split(".")).toHaveLength(3);
    const sessionArgument: unknown = createRefreshSessionMock.mock.calls[0]?.[0];
    expect(sessionArgument).toMatchObject({ tokenHash: hashRefreshToken(result.refreshToken) });
    expect(sessionArgument).not.toHaveProperty("refreshToken");
  });

  it("rejects unknown users with the same generic credentials error", async () => {
    findUserMock.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });

    await expect(loginUser({ phone: registration.phone, password: "wrong-password" })).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHENTICATED",
    });
  });

  it("atomically rotates a refresh token within the same session family", async () => {
    const oldToken = createSessionTokens("user-id").refreshToken;
    const oldSession = {
      _id: "session-id",
      userId: { toString: (): string => "user-id" },
      tokenHash: hashRefreshToken(oldToken),
      familyId: "family-id",
      expiresAt: new Date(Date.now() + 60_000),
    };
    const user = { ...savedUser, _id: { toString: (): string => "user-id" }, isActive: true };
    findRefreshSessionMock.mockReturnValue({ lean: vi.fn().mockResolvedValue(oldSession) });
    findUserByIdMock.mockResolvedValue(user);
    createRefreshSessionMock.mockResolvedValue({});
    updateRefreshSessionMock.mockResolvedValue(oldSession);

    const result = await refreshUserSession(oldToken);

    expect(result.user).toMatchObject({ id: "user-id", role: "FARMER" });
    expect(result.refreshToken).not.toBe(oldToken);
    expect(createRefreshSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      familyId: "family-id",
      tokenHash: hashRefreshToken(result.refreshToken),
    }));
    expect(updateRefreshSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: hashRefreshToken(oldToken), revokedAt: { $exists: false } }),
      expect.objectContaining({ $set: expect.objectContaining({ replacedByTokenHash: hashRefreshToken(result.refreshToken) }) }),
      { new: false },
    );
  });

  it("revokes a token family when a rotated token is reused", async () => {
    const token = createSessionTokens("user-id").refreshToken;
    const familyId = "family-id";
    findRefreshSessionMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "session-id",
        tokenHash: hashRefreshToken(token),
        familyId,
        userId: { toString: (): string => "user-id" },
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
      }),
    });
    updateRefreshSessionsMock.mockResolvedValue({ modifiedCount: 1 });

    await expect(refreshUserSession(token)).rejects.toMatchObject({ statusCode: 401, code: "UNAUTHENTICATED" });
    expect(updateRefreshSessionsMock).toHaveBeenCalledWith(
      { familyId, revokedAt: { $exists: false } },
      { $set: { revokedAt: expect.any(Date) } },
    );
  });

  it("revokes the family if the conditional rotation loses a concurrent race", async () => {
    const token = createSessionTokens("user-id").refreshToken;
    const familyId = "family-id";
    findRefreshSessionMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "session-id",
        tokenHash: hashRefreshToken(token),
        familyId,
        userId: { toString: (): string => "user-id" },
        expiresAt: new Date(Date.now() + 60_000),
      }),
    });
    findUserByIdMock.mockResolvedValue({ ...savedUser, _id: { toString: (): string => "user-id" }, isActive: true });
    updateRefreshSessionMock.mockResolvedValue(null);
    updateRefreshSessionsMock.mockResolvedValue({ modifiedCount: 1 });

    await expect(refreshUserSession(token)).rejects.toMatchObject({ statusCode: 401, code: "UNAUTHENTICATED" });
    expect(deleteRefreshSessionMock).toHaveBeenCalledWith(expect.objectContaining({ tokenHash: expect.any(String) }));
    expect(updateRefreshSessionsMock).toHaveBeenCalledWith(
      { familyId, revokedAt: { $exists: false } },
      { $set: { revokedAt: expect.any(Date) } },
    );
  });
});
