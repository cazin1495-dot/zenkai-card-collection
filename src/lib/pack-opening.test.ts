import { describe, expect, it } from "vitest";
import { bestOpeningRarity, openingEffects, packSealToken } from "./pack-opening";

describe("pack seal rarity cues", () => {
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