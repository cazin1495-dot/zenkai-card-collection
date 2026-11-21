import { afterEach, describe, expect, it } from "vitest";
import { characterRarity, getUserRarityOverrides, normalizeCatalogCard, setUserRarityOverride, type Card } from "./cards";

const card: Card = { id: "nami-1", name: "Nami", title: "", description: "", rarity: "rare", sort_order: 0 };

describe("user rarity overrides", () => {
  afterEach(() => localStorage.removeItem("zenkai_admin_rarity_overrides"));

  it.each([
    ["al-245", "mythique"],
    ["al-167444", "legendaire"],
    ["al-169394", "epique"],
    ["hsr-20", "legendaire"],
  ] as const)("uses the fixed id rarity for %s before name rules", (id, rarity) => {
    const result = normalizeCatalogCard({ ...card, id });
    expect(result).toMatchObject({ rarity, serverRarity: "rare" });
    expect(characterRarity("Nami", "rare", id)).toBe(rarity);
  });

  it("applies the newly configured ids over name rules", () => {
    const additions = {
      "al-12300": "mythique", "al-5833": "legendaire", "al-20594": "legendaire",
      "al-13898": "mythique", "al-678": "legendaire", "al-4318": "legendaire",
      "al-1900": "legendaire", "al-1902": "legendaire", "al-7302": "legendaire",
      "al-52425": "legendaire", "al-26": "epique", "al-5835": "rare",
      "al-29809": "rare", "al-41135": "rare",
    };
    for (const [id, rarity] of Object.entries(additions)) {
      expect(normalizeCatalogCard({ ...card, id, rarity: "commune" })).toMatchObject({
        rarity,
        serverRarity: "commune",
      });
    }
  });

  it("keeps local editor choices above the fixed list", () => {
    const fixedCard = { ...card, id: "al-245" };
    setUserRarityOverride("Nami", "epique");
    expect(normalizeCatalogCard(fixedCard).rarity).toBe("epique");
    setUserRarityOverride(fixedCard.id, "commune");
    expect(normalizeCatalogCard(fixedCard).rarity).toBe("commune");
    localStorage.removeItem("zenkai_admin_rarity_overrides");
    expect(normalizeCatalogCard(fixedCard).rarity).toBe("mythique");
  });

  it("prioritizes ids over names and built-in overrides without losing server rarity", () => {
    setUserRarityOverride("  Nami  ", "epique");
    expect(characterRarity(" Nami ", "rare")).toBe("epique");
    expect(normalizeCatalogCard(card)).toMatchObject({ rarity: "epique", serverRarity: "rare" });
    setUserRarityOverride(card.id, "commune");
    const normalized = normalizeCatalogCard(card);
    expect(normalized).toMatchObject({ rarity: "commune", serverRarity: "rare" });
    setUserRarityOverride(card.id, "legendaire");
    expect(normalizeCatalogCard(normalized)).toMatchObject({ rarity: "legendaire", serverRarity: "rare" });
    expect(getUserRarityOverrides()).toEqual({ Nami: "epique", "nami-1": "legendaire" });
  });

  it("does not override evolved or exclusive cards and rejects invalid stored values", () => {
    setUserRarityOverride("nami", "epique");
    expect(characterRarity("Nami", "transcendance")).toBe("transcendance");
    expect(normalizeCatalogCard({ ...card, id: "nami-TR" }).rarity).toBe("rare");
    expect(normalizeCatalogCard({ ...card, transcendance_series_number: "001" }).rarity).toBe("rare");
    expect(normalizeCatalogCard({ ...card, id: "al-245", transcendance_series_number: "001" }).rarity).toBe("rare");
    expect(characterRarity("Nami", "transcendance", "al-245")).toBe("transcendance");
    localStorage.setItem("zenkai_admin_rarity_overrides", '{"nami":"transcendance"}');
    expect(getUserRarityOverrides).toThrow("Configuration des raretés locales invalide");
  });
});
