import { describe, expect, it, vi } from "vitest";

import { type PublicUser, UserRole } from "@bazarbeat/shared";

import { requireRole } from "./auth.middleware.js";

const farmer: PublicUser = {
  id: "farmer-id",
  role: UserRole.FARMER,
  name: "Farmer",
  division: "dhaka",
  district: "dhaka",
  language: "en",
};

describe("requireRole", () => {
  it("allows a matching role", () => {
    const next = vi.fn();
    const handler = requireRole(UserRole.FARMER);
    const request = {} as unknown as Parameters<typeof handler>[0];
    const response = { locals: { currentUser: farmer } } as unknown as Parameters<typeof handler>[1];
    const nextHandler = next as unknown as Parameters<typeof handler>[2];

    handler(request, response, nextHandler);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("forbids a role that is not allowed", () => {
    const next = vi.fn();
    const handler = requireRole(UserRole.BUYER);
    const request = {} as unknown as Parameters<typeof handler>[0];
    const response = { locals: { currentUser: farmer } } as unknown as Parameters<typeof handler>[1];
    const nextHandler = next as unknown as Parameters<typeof handler>[2];

    handler(request, response, nextHandler);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }));
  });
});
