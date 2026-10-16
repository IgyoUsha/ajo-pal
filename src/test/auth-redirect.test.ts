import { describe, expect, it } from "vitest";
import { safeAuthRedirect } from "@/lib/auth-redirect";

describe("Demo sign-in destination", () => {
  it("preserves a local group page with query and hash", () => {
    expect(safeAuthRedirect("/g/demo/me?payment=return#history")).toBe("/g/demo/me?payment=return#history");
  });
  it("rejects external destinations and auth loops", () => {
    for (const destination of ["https://example.com", "//example.com", "/\\example.com", "/auth?redirect=/auth", "/api/public/paystack-webhook", undefined]) {
      expect(safeAuthRedirect(destination)).toBe("/");
    }
  });
});