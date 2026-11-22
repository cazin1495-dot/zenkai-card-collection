import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BETA_ACCESS_KEY, BETA_END, BETA_WIPE_KEY, betaCountdown, betaEnded, claimBetaAccess, hasBetaWelcome, resetGuestBetaProgress, wipeBetaProgress } from "./beta";
import { getGuestBalance, getGuestState } from "./guest-collection";
import { profileTitles } from "./player-profile";

describe("bêta locale", () => {
  const end = Date.parse(BETA_END);
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("uses the fixed deadline and counts down to zero", () => {
    expect(betaCountdown(end - 168 * 3600 * 1000)).toBe("7j 00h 00m 00s");
    expect(betaCountdown(end - 1000)).toBe("0j 00h 00m 01s");
    expect(betaEnded(end - 1)).toBe(false);
    expect(betaEnded(end)).toBe(true);
    expect(betaCountdown(end + 1)).toBe("0j 00h 00m 00s");
  });

  it("credits each browser once and unlocks the profile title for either code", () => {
    expect(() => claimBetaAccess("incorrect", end - 1)).toThrow("Code bêta invalide");
    expect(getGuestBalance()).toBe(500);
    claimBetaAccess(" zenkai-beta7 ", end - 1);
    expect(getGuestBalance()).toBe(1000);
    expect(hasBetaWelcome()).toBe(true);
    expect(localStorage.getItem(BETA_ACCESS_KEY)).toBe("granted");
    claimBetaAccess("zenkai7", end - 1);
    expect(getGuestBalance()).toBe(1000);
    expect(profileTitles(1, [], { unlocked: [], claimed: [], recycled: 0 }, [], hasBetaWelcome()).find((title) => title.name === "Pionnier Bêta")?.unlocked).toBe(true);
    expect(() => claimBetaAccess("ZENKAI7", end)).toThrow("terminée");
  });

  it("removes progression only after expiry and leaves unrelated storage intact", () => {
    const keys = ["zenkai_guest_collection", "zenkai_guest_zen", "zenkai_player_xp", "zenkai_daily_login", "zenkai_market_auctions", "zenkai_player_profile", "zenkai:favorite-cards", "zenkai:plus:account", "zenkai:friends:account", BETA_ACCESS_KEY];
    for (const key of keys) localStorage.setItem(key, "test");
    localStorage.setItem("other-app", "keep");
    localStorage.setItem("zenkai_admin_rarity_overrides", "keep");
    expect(() => wipeBetaProgress(end - 1)).toThrow("pas terminée");
    expect(localStorage.getItem(keys[0]!)).toBe("test");
    wipeBetaProgress(end);
    for (const key of keys) expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem("other-app")).toBe("keep");
    expect(localStorage.getItem("zenkai_admin_rarity_overrides")).toBe("keep");
    expect(localStorage.getItem(BETA_WIPE_KEY)).toBe("done");
    localStorage.setItem("zenkai_guest_zen", "admin");
    wipeBetaProgress(end + 1);
    expect(localStorage.getItem("zenkai_guest_zen")).toBe("admin");
  });

  it("resets guest progress to 500 Zen while preserving access and unrelated data", () => {
    const keys = ["zenkai_guest_collection", "zenkai_guest_zen", "zenkai_player_xp", "zenkai_daily_login", "zenkai_market_auctions", "zenkai_player_profile", "zenkai:favorite-cards", "zenkai_quests", "zenkai_secrets", "zenkai_beta_welcomed"];
    for (const key of keys) localStorage.setItem(key, "old progress");
    localStorage.setItem(BETA_ACCESS_KEY, "granted");
    localStorage.setItem("zenkai:local-guest", "true");
    localStorage.setItem("other-app", "keep");
    resetGuestBetaProgress(end - 1);
    for (const key of keys.slice(1)) expect(localStorage.getItem(key)).toBeNull();
    expect(getGuestState()).toMatchObject({ rows: [], zen: 500, xp: 0, betaWelcomeClaimed: true });
    expect(localStorage.getItem(BETA_ACCESS_KEY)).toBe("granted");
    expect(localStorage.getItem("zenkai:local-guest")).toBe("true");
    expect(localStorage.getItem("other-app")).toBe("keep");
    claimBetaAccess("ZENKAI7", end - 1);
    expect(getGuestBalance()).toBe(500);
  });

  it("refuses a guest reset after the beta ends", () => {
    localStorage.setItem("zenkai_guest_zen", "900");
    expect(() => resetGuestBetaProgress(end)).toThrow("terminée");
    expect(localStorage.getItem("zenkai_guest_zen")).toBe("900");
  });

  it("allows retry after an incomplete wipe", () => {
    localStorage.setItem("zenkai_player_profile", "test");
    const remove = vi.spyOn(Storage.prototype, "removeItem").mockImplementationOnce(() => { throw new Error("storage"); });
    expect(() => wipeBetaProgress(end)).toThrow("storage");
    expect(localStorage.getItem(BETA_WIPE_KEY)).toBeNull();
    remove.mockRestore();
    wipeBetaProgress(end);
    expect(localStorage.getItem("zenkai_player_profile")).toBeNull();
  });
});
