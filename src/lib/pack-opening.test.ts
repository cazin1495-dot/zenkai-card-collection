import { describe, expect, it } from "vitest";
import { bestOpeningRarity, normalizeOpeningRarity, openingEffects, packSealToken } from "./pack-opening";

describe("pack seal rarity cues", () => {
  it.each([["Commun", "commune"], ["COMMON", "commune"], ["Peu commun", "non_commune"], ["Uncommon", "non_commune"], ["RARE", "rare"], ["Épique", "epique"], ["EPIC", "epique"], ["Légendaire", "legendaire"], ["Legendary", "legendaire"], ["Mythique", "mythique"], ["MYTHIC", "mythique"]])("normalizes %s", (input, expected) => expect(normalizeOpeningRarity(input)).toBe(expected));
  it("detects maximum across French and English names", () => expect(bestOpeningRarity(["Épique", "common", "MYTHIC", "Rare"])).toBe("mythique"));
  it("falls back to a valid white token for unknown names", () => expect(packSealToken("unknown")).toBe("var(--opening-commune)"));
  it.each(["commune", "non_commune", "rare", "epique", "legendaire", "mythique"] as const)("uses the dedicated opening token for %s", (r) => expect(packSealToken(r)).toBe(`var(--opening-${r})`));
  it("detects Mythique regardless of card order", () => expect(bestOpeningRarity(["rare", "mythique", "commune", "epique"])).toBe("mythique"));
  it("ranks Non Commune between Commune and Rare", () => {
    expect(bestOpeningRarity(["commune", "non_commune"])).toBe("non_commune");
    expect(bestOpeningRarity(["non_commune", "rare"])).toBe("rare");
  });
  it("has no rarity before the draw arrives", () => expect(bestOpeningRarity([])).toBeNull());
  it("keeps common openings calm", () => expect(openingEffects("commune")).toEqual({ sparks: 0, rays: 0, jackpot: false, suspense: false }));
  it("gives Rare seam sparks", () => expect(openingEffects("rare").sparks).toBe(8));
  it("gives Épique particles and suspense", () => expect(openingEffects("epique")).toEqual({ sparks: 14, rays: 0, jackpot: false, suspense: true }));
  it("gives Légendaire golden rays and suspense", () => expect(openingEffects("legendaire")).toEqual({ sparks: 0, rays: 7, jackpot: false, suspense: true }));
  it("reserves particle explosion and flash for Mythique", () => expect(openingEffects("mythique")).toEqual({ sparks: 30, rays: 0, jackpot: true, suspense: true }));
});