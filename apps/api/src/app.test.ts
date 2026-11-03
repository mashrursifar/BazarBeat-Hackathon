import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "./app.js";

describe("health route", () => {
  it("returns an OK status and database status", async () => {
    const response = await request(app).get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: { status: "ok", database: expect.any(String) } });
  });
});
