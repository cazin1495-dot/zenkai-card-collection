import { afterEach, describe, expect, it } from "vitest";
import { applyRemoteRarityOverrides, characterRarity, getUserRarityOverrides, normalizeCatalogCard, type Card } from "./cards";

const card: Card = { id: "nami-1", name: "Nami", title: "", description: "", rarity: "rare", sort_order: 0 };

describe("user rarity overrides", () => {
  afterEach(() => {
    applyRemoteRarityOverrides({});
    localStorage.removeItem("zenkai_admin_rarity_overrides");
  });

  it.each([
    ["al-12464", "legendaire"], ["al-12465", "legendaire"],
    ["ds-muichiro", "legendaire"], ["ds-obanai", "legendaire"],
    ["ds-sanemi", "legendaire"], ["ds-gyomei", "legendaire"],
    ["hsr-1", "legendaire"], ["hsr-6", "epique"],
    ["hsr-7", "epique"], ["hsr-8", "legendaire"],
  ] as const)("applies the official default for %s despite stale local and server values", (id, rarity) => {
    localStorage.setItem("zenkai_admin_rarity_overrides", JSON.stringify({ [id]: "commune" }));
    expect(normalizeCatalogCard({ ...card, id, rarity: "mythique" }).rarity).toBe(rarity);
  });

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

  it("keeps remote choices above defaults and the fixed list", () => {
    const fixedCard = { ...card, id: "al-245" };
    applyRemoteRarityOverrides({ Nami: "epique" });
    expect(normalizeCatalogCard(fixedCard).rarity).toBe("epique");
    applyRemoteRarityOverrides({ Nami: "epique", [fixedCard.id]: "commune", "hsr-1": "rare" });
    expect(normalizeCatalogCard(fixedCard).rarity).toBe("commune");
    expect(normalizeCatalogCard({ ...card, id: "hsr-1" }).rarity).toBe("rare");
    applyRemoteRarityOverrides({});
    expect(normalizeCatalogCard(fixedCard).rarity).toBe("mythique");
    expect(normalizeCatalogCard({ ...card, id: "hsr-1" }).rarity).toBe("legendaire");
  });

  it("prioritizes ids over names and built-in overrides without losing server rarity", () => {
    applyRemoteRarityOverrides({ "  Nami  ": "epique" });
    expect(characterRarity(" Nami ", "rare")).toBe("epique");
    expect(normalizeCatalogCard(card)).toMatchObject({ rarity: "epique", serverRarity: "rare" });
    applyRemoteRarityOverrides({ Nami: "epique", [card.id]: "commune" });
    const normalized = normalizeCatalogCard(card);
    expect(normalized).toMatchObject({ rarity: "commune", serverRarity: "rare" });
    applyRemoteRarityOverrides({ Nami: "epique", [card.id]: "legendaire" });
    expect(normalizeCatalogCard(normalized)).toMatchObject({ rarity: "legendaire", serverRarity: "rare" });
    expect(getUserRarityOverrides()).toEqual({ Nami: "epique", "nami-1": "legendaire" });
  });

  it("does not override evolved or exclusive cards and rejects invalid stored values", () => {
    applyRemoteRarityOverrides({ nami: "epique" });
    expect(characterRarity("Nami", "transcendance")).toBe("transcendance");
    expect(normalizeCatalogCard({ ...card, id: "nami-TR" }).rarity).toBe("rare");
    expect(normalizeCatalogCard({ ...card, transcendance_series_number: "001" }).rarity).toBe("rare");
    expect(normalizeCatalogCard({ ...card, id: "al-245", transcendance_series_number: "001" }).rarity).toBe("rare");
    expect(characterRarity("Nami", "transcendance", "al-245")).toBe("transcendance");
    localStorage.setItem("zenkai_admin_rarity_overrides", '{"nami":"transcendance"}');
    expect(getUserRarityOverrides()).toEqual({ nami: "epique" });
  });
});
