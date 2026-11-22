import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/lovable/index", () => ({
  lovable: { auth: { signInWithOAuth: vi.fn() } },
}));

import { lovable } from "@/integrations/lovable/index";
import { canUseLocalGuestMode, isLocalGuestMode, isOAuthCallbackPath, setLocalGuestMode, signInWithGoogle } from "./auth";
import { BETA_ACCESS_KEY, BETA_END } from "./beta";

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("Google sign-in", () => {
  it("uses Lovable Cloud OAuth and redirects to the current origin", () => {
    void signInWithGoogle();

    expect(lovable.auth.signInWithOAuth).toHaveBeenCalledWith("google", {
      redirect_uri: window.location.origin,
    });
  });
});

describe("local guest mode", () => {
  it("persists the development guest flag", () => {
    setLocalGuestMode(true);
    expect(isLocalGuestMode()).toBe(import.meta.env.DEV);

    setLocalGuestMode(false);
    expect(isLocalGuestMode()).toBe(false);
  });

  it("allows beta guests in production only after access and before expiry", () => {
    vi.stubEnv("DEV", false);
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(BETA_END) - 1000);
    expect(canUseLocalGuestMode()).toBe(false);
    setLocalGuestMode(true);
    expect(isLocalGuestMode()).toBe(false);
    localStorage.setItem(BETA_ACCESS_KEY, "granted");
    setLocalGuestMode(true);
    expect(isLocalGuestMode()).toBe(true);
    vi.setSystemTime(Date.parse(BETA_END));
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
