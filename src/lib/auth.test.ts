import { describe, expect, it } from "vitest";
import { isOAuthCallbackPath } from "./auth";

describe("OAuth callback paths", () => {
  it.each(["/auth/callback", "/auth/callback/", "/oauth/callback", "/~oauth"])(
    "recognizes %s",
    (pathname) => {
      expect(isOAuthCallbackPath(pathname)).toBe(true);
    },
  );

  it("does not redirect unrelated routes", () => {
    expect(isOAuthCallbackPath("/collection")).toBe(false);
  });
});
