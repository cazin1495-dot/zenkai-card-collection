import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/lovable/index", () => ({
  lovable: { auth: { signInWithOAuth: vi.fn() } },
}));

import { lovable } from "@/integrations/lovable/index";
import { isLocalGuestMode, isOAuthCallbackPath, setLocalGuestMode, signInWithGoogle } from "./auth";

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("Google sign-in", () => {
  it("uses Lovable Cloud OAuth and redirects to the current origin", () => {
    void signInWithGoogle();

    expect(lovable.auth.signInWithOAuth).toHaveBeenCalledWith("google", {
      redirect_uri: window.location.origin,
    });
  });
});

describe("local guest mode", () => {
  it("persists only the development guest flag", () => {
    setLocalGuestMode(true);
    expect(isLocalGuestMode()).toBe(import.meta.env.DEV);

    setLocalGuestMode(false);
    expect(isLocalGuestMode()).toBe(false);
  });
});

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
