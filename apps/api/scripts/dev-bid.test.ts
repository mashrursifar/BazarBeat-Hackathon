import { describe, expect, it, vi } from "vitest";

import { main, runDevBid } from "./dev-bid.js";

describe("dev-bid CLI tool (Task 4.8)", () => {
  const defaultListingId = "6788f4b5c92842f1b0a81123";
  const defaultPhone = "01712345678";
  const defaultPassword = "buyerpassword123";

  it("refuses to run when NODE_ENV is production", async () => {
    const stderrMock = vi.fn();
    const stdoutMock = vi.fn();

    const result = await runDevBid({
      listingId: defaultListingId,
      amountPerKg: 4600,
      phone: defaultPhone,
      password: defaultPassword,
      nodeEnv: "production",
      stderr: stderrMock,
      stdout: stdoutMock,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("PRODUCTION_ENV_FORBIDDEN");
    expect(stderrMock).toHaveBeenCalledWith(
      expect.stringContaining("Refusing to run dev:bid script in production environment"),
    );
  });

  it("rejects when listing ID is missing or empty", async () => {
    const stderrMock = vi.fn();

    const result = await runDevBid({
      listingId: "   ",
      amountPerKg: 4600,
      phone: defaultPhone,
      password: defaultPassword,
      nodeEnv: "development",
      stderr: stderrMock,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("MISSING_LISTING_ID");
    expect(stderrMock).toHaveBeenCalledWith(expect.stringContaining("Missing listing ID"));
  });

  it("rejects invalid bid amounts (non-integer, zero, negative)", async () => {
    const stderrMock = vi.fn();

    const resultFloat = await runDevBid({
      listingId: defaultListingId,
      amountPerKg: 46.5,
      phone: defaultPhone,
      password: defaultPassword,
      nodeEnv: "development",
      stderr: stderrMock,
    });
    expect(resultFloat.success).toBe(false);
    expect(resultFloat.error).toBe("INVALID_BID_AMOUNT");

    const resultNegative = await runDevBid({
      listingId: defaultListingId,
      amountPerKg: -100,
      phone: defaultPhone,
      password: defaultPassword,
      nodeEnv: "development",
      stderr: stderrMock,
    });
    expect(resultNegative.success).toBe(false);
    expect(resultNegative.error).toBe("INVALID_BID_AMOUNT");

    const resultZero = await runDevBid({
      listingId: defaultListingId,
      amountPerKg: 0,
      phone: defaultPhone,
      password: defaultPassword,
      nodeEnv: "development",
      stderr: stderrMock,
    });
    expect(resultZero.success).toBe(false);
    expect(resultZero.error).toBe("INVALID_BID_AMOUNT");
  });

  it("rejects when buyer credentials are missing", async () => {
    const stderrMock = vi.fn();

    const result = await runDevBid({
      listingId: defaultListingId,
      amountPerKg: 4600,
      phone: "",
      password: "",
      nodeEnv: "development",
      stderr: stderrMock,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("MISSING_CREDENTIALS");
    expect(stderrMock).toHaveBeenCalledWith(expect.stringContaining("Missing buyer credentials"));
  });

  it("handles sign-in failure with clear error details", async () => {
    const stderrMock = vi.fn();
    const stdoutMock = vi.fn();

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: "UNAUTHENTICATED", message: "Invalid phone or password" },
        }),
        {
          status: 401,
          statusText: "Unauthorized",
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await runDevBid({
      listingId: defaultListingId,
      amountPerKg: 4600,
      phone: defaultPhone,
      password: defaultPassword,
      nodeEnv: "development",
      fetchFn: mockFetch,
      stderr: stderrMock,
      stdout: stdoutMock,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(stderrMock).toHaveBeenCalledWith(
      expect.stringContaining("Sign-in failed (UNAUTHENTICATED: Invalid phone or password)"),
    );
  });

  it("rejects if authenticated user is not a BUYER", async () => {
    const stderrMock = vi.fn();
    const stdoutMock = vi.fn();

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { id: "user-1", role: "FARMER", name: "Farmer Roy" },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "set-cookie": "accessToken=mock-token; Path=/;",
          },
        },
      ),
    );

    const result = await runDevBid({
      listingId: defaultListingId,
      amountPerKg: 4600,
      phone: defaultPhone,
      password: defaultPassword,
      nodeEnv: "development",
      fetchFn: mockFetch,
      stderr: stderrMock,
      stdout: stdoutMock,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("ROLE_NOT_BUYER");
    expect(stderrMock).toHaveBeenCalledWith(
      expect.stringContaining('has role "FARMER", not "BUYER"'),
    );
  });

  it("handles server bid rejection (e.g. BID_TOO_LOW) with clear error output", async () => {
    const stderrMock = vi.fn();
    const stdoutMock = vi.fn();

    const mockFetch = vi
      .fn<typeof fetch>()
      // Login response
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { id: "buyer-1", role: "BUYER", name: "Buyer Kabir" },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "set-cookie": "accessToken=token-123; Path=/;",
            },
          },
        ),
      )
      // Bid response (rejected)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "BID_TOO_LOW",
              message: "Bid must be at least the current bid plus minimum increment",
            },
          }),
          {
            status: 400,
            statusText: "Bad Request",
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const result = await runDevBid({
      listingId: defaultListingId,
      amountPerKg: 4200,
      phone: defaultPhone,
      password: defaultPassword,
      nodeEnv: "development",
      fetchFn: mockFetch,
      stderr: stderrMock,
      stdout: stdoutMock,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(stderrMock).toHaveBeenCalledWith(
      expect.stringContaining("Bid rejected by server (HTTP 400)"),
    );
    expect(stderrMock).toHaveBeenCalledWith(expect.stringContaining("BID_TOO_LOW"));
  });

  it("places a valid bid, passes CSRF and auth cookies, and outputs server answer", async () => {
    const stderrMock = vi.fn();
    const stdoutMock = vi.fn();

    const bidData = {
      id: "bid-123",
      listingId: defaultListingId,
      buyerId: "buyer-1",
      amountPerKg: 4600,
      totalAmount: 230000,
      status: "ACCEPTED",
      placedAt: "2026-11-14T14:00:00.000Z",
      seq: 1,
    };

    const mockFetch = vi
      .fn<typeof fetch>()
      // Login response
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { id: "buyer-1", role: "BUYER", name: "Buyer Kabir" },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "set-cookie": "accessToken=auth-token-xyz; Path=/;",
            },
          },
        ),
      )
      // Bid response (accepted)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: bidData,
            meta: { serverTime: "2026-11-14T14:00:00.000Z" },
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const result = await runDevBid({
      listingId: defaultListingId,
      amountPerKg: 4600,
      phone: defaultPhone,
      password: defaultPassword,
      nodeEnv: "development",
      fetchFn: mockFetch,
      stderr: stderrMock,
      stdout: stdoutMock,
    });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(201);
    expect(result.data).toEqual({
      data: bidData,
      meta: { serverTime: "2026-11-14T14:00:00.000Z" },
    });

    // Check fetch calls
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const [loginUrl, loginInit] = mockFetch.mock.calls[0]!;
    expect(loginUrl).toBe("http://localhost:4000/api/v1/auth/login");
    expect(loginInit?.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
        "X-CSRF-Protection": "1",
      }),
    );

    const [bidUrl, bidInit] = mockFetch.mock.calls[1]!;
    expect(bidUrl).toBe(`http://localhost:4000/api/v1/listings/${defaultListingId}/bids`);
    expect(bidInit?.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
        "X-CSRF-Protection": "1",
        Cookie: "accessToken=auth-token-xyz",
      }),
    );
    expect(JSON.parse(bidInit?.body as string)).toEqual({ amountPerKg: 4600 });

    expect(stdoutMock).toHaveBeenCalledWith(
      expect.stringContaining("Bid accepted successfully (HTTP 201)"),
    );
  });

  it("handles network connectivity errors cleanly", async () => {
    const stderrMock = vi.fn();
    const stdoutMock = vi.fn();

    const mockFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:4000"));

    const result = await runDevBid({
      listingId: defaultListingId,
      amountPerKg: 4600,
      phone: defaultPhone,
      password: defaultPassword,
      nodeEnv: "development",
      fetchFn: mockFetch,
      stderr: stderrMock,
      stdout: stdoutMock,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
    expect(stderrMock).toHaveBeenCalledWith(expect.stringContaining("Network error"));
  });

  it("main() exits with code 1 when arguments are missing", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const exitCode = await main([]);
    expect(exitCode).toBe(1);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Usage: npm run dev:bid"));

    stderrSpy.mockRestore();
  });
});
