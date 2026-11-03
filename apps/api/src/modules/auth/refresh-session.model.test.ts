import { describe, expect, it } from "vitest";

import { RefreshSession } from "./refresh-session.model.js";

describe("RefreshSession model", () => {
  it("indexes token hashes uniquely and expires records at expiresAt", () => {
    const indexes = RefreshSession.schema.indexes();

    expect(indexes).toContainEqual([{ tokenHash: 1 }, { unique: true, background: true }]);
    expect(indexes).toContainEqual([{ expiresAt: 1 }, { expireAfterSeconds: 0, background: true }]);
    expect(indexes).toContainEqual([{ userId: 1 }, { background: true }]);
    expect(indexes).toContainEqual([{ familyId: 1 }, { background: true }]);
  });
});
