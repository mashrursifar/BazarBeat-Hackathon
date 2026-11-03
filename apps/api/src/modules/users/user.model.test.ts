import { describe, expect, it } from "vitest";

import { User } from "./user.model.js";

const validUser = {
  role: "FARMER",
  name: "Farmer One",
  phone: "01712345678",
  passwordHash: "argon2-hash",
  division: "dhaka",
  district: "dhaka",
};

describe("User model", () => {
  it("normalizes phone, defaults language and status, and hides password hash by default", () => {
    const user = new User(validUser);

    expect(user.phone).toBe("+8801712345678");
    expect(user.language).toBe("en");
    expect(user.isActive).toBe(true);
    expect(User.schema.paths["passwordHash"]?.options.select).toBe(false);
  });

  it("requires buyer role for organization and validates role and language enums", async () => {
    const farmerWithOrganization = new User({ ...validUser, organization: "Farm Co-op" });
    const invalidEnums = new User({ ...validUser, role: "ADMIN", language: "fr" });

    await expect(farmerWithOrganization.validate()).rejects.toThrow("Only buyers can have an organization");
    const validationError = await invalidEnums.validate().catch((error: unknown) => error);
    expect(validationError).toMatchObject({ errors: { role: expect.anything(), language: expect.anything() } });
  });

  it("declares unique phone and sparse unique email indexes", () => {
    const indexes = User.schema.indexes();

    expect(indexes).toContainEqual([{ phone: 1 }, { unique: true, background: true }]);
    expect(indexes).toContainEqual([{ email: 1 }, { unique: true, sparse: true, background: true }]);
    expect(indexes).toContainEqual([{ role: 1 }, { background: true }]);
  });

  it("rejects invalid phone numbers", async () => {
    await expect(new User({ ...validUser, phone: "12345" }).validate()).rejects.toThrow();
  });
});
