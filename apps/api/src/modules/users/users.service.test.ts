import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUserByIdMock } = vi.hoisted(() => ({ findUserByIdMock: vi.fn() }));
vi.mock("./user.model.js", () => ({ User: { findById: findUserByIdMock } }));

import { UserRole } from "@bazarbeat/shared";

import { updateUserProfile } from "./users.service.js";

function makeUser(role: UserRole, organization?: string): {
  data: Record<string, unknown>;
  user: { set: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
} {
  const data: Record<string, unknown> = {
    id: "user-id",
    role,
    name: "Market User",
    division: "dhaka",
    district: "dhaka",
    language: "en",
    isActive: true,
    ...(organization === undefined ? {} : { organization }),
  };
  const set = vi.fn((updates: object): void => {
    Object.assign(data, updates);
  });
  const save = vi.fn(async () => ({ ...data }));
  const user = Object.assign({}, data, { set, save });
  return { data, user };
}

describe("updateUserProfile", () => {
  beforeEach(() => findUserByIdMock.mockReset());

  it("updates permitted profile fields and returns a safe response", async () => {
    const { data, user } = makeUser(UserRole.FARMER);
    findUserByIdMock.mockResolvedValue(user);

    const result = await updateUserProfile("user-id", { language: "bn", name: "Updated Farmer" });

    expect(findUserByIdMock).toHaveBeenCalledWith("user-id");
    expect(data).toMatchObject({ language: "bn", name: "Updated Farmer" });
    expect(result).toMatchObject({ id: "user-id", language: "bn", name: "Updated Farmer" });
    expect(result).not.toHaveProperty("phone");
    expect(result).not.toHaveProperty("passwordHash");
  });

  it("allows buyers to update their organization", async () => {
    const { data, user } = makeUser(UserRole.BUYER, "Old Co-op");
    findUserByIdMock.mockResolvedValue(user);

    const result = await updateUserProfile("user-id", { organization: "New Co-op" });

    expect(data.organization).toBe("New Co-op");
    expect(result.organization).toBe("New Co-op");
  });

  it("forbids farmers from updating buyer-only organization data", async () => {
    const { user } = makeUser(UserRole.FARMER);
    findUserByIdMock.mockResolvedValue(user);

    await expect(updateUserProfile("user-id", { organization: "Not allowed" })).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
    expect(user.set).not.toHaveBeenCalled();
    expect(user.save).not.toHaveBeenCalled();
  });

  it("rejects a district that does not belong to the stored division", async () => {
    const { user } = makeUser(UserRole.FARMER);
    findUserByIdMock.mockResolvedValue(user);

    await expect(updateUserProfile("user-id", { district: "sylhet" })).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
    expect(user.set).not.toHaveBeenCalled();
  });

  it("rejects missing users", async () => {
    findUserByIdMock.mockResolvedValue(null);

    await expect(updateUserProfile("missing-user", { language: "bn" })).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHENTICATED",
    });
  });
});
