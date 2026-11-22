import { describe, expect, it } from "vitest";
import { collectionEntries, sortCollectionEntries } from "./collection-view";
import { normalizeCatalogCard, type Card, type CatalogRarity } from "./cards";

function card(id: string, rarity: CatalogRarity): Card {
  return { id, name: id, title: "", description: "", rarity, sort_order: 0 };
}

describe("collection view", () => {
  it("separates the updated base rarity from an already awakened copy", () => {
    const nami = normalizeCatalogCard({ ...card("nami", "rare"), name: "Nami" });
    const entries = collectionEntries([nami], [
      { card_id: "nami", obtained_at: "2025-01-01", transcended: false },
      { card_id: "nami", obtained_at: "2025-01-02", transcended: true },
    ], new Set());
    expect(entries.map((entry) => [entry.rarity, entry.count])).toEqual([
      ["mythique", 1], ["transcendance", 1],
    ]);
  });
  it("separates base, awakened and custom forms while retaining copy counts and dates", () => {
    const cards = [card("goku", "mythique"), card("custom", "mythique"), card("missing", "rare")];
    const copies = [
      { card_id: "goku", obtained_at: "2025-01-03T00:00:00Z", transcended: false },
      { card_id: "goku", obtained_at: "2025-01-01T00:00:00Z", transcended: true },
      { card_id: "goku", obtained_at: "2025-01-02T00:00:00Z", transcended: false },
      { card_id: "custom", obtained_at: "2025-01-04T00:00:00Z", transcended: false },
    ];
    const entries = collectionEntries(cards, copies, new Set(["custom"]));
    expect(entries.map((entry) => [entry.card.id, entry.rarity, entry.count])).toEqual([
      ["goku", "mythique", 2],
      ["goku", "transcendance", 1],
      ["custom", "transcendance", 1],
      ["missing", "rare", 0],
    ]);
    expect(sortCollectionEntries(entries, "recent").map((entry) => entry.card.id)).toEqual([
      "custom",
      "goku",
      "goku",
      "missing",
    ]);
    expect(sortCollectionEntries(entries, "duplicates").map((entry) => entry.count)).toEqual([
      2, 1, 1, 0,
    ]);
  });

  it("sorts the entire catalogue in both rarity directions", () => {
    const cards = [
      card("rare", "rare"),
      card("common", "commune"),
      card("epic", "epique"),
      card("mythic", "mythique"),
      card("legendary", "legendaire"),
      card("uncommon", "non_commune"),
      card("custom", "mythique"),
    ];
    const entries = collectionEntries(cards, [], new Set(["custom"]));
    expect(sortCollectionEntries(entries, "rarest").map((entry) => entry.rarity)).toEqual([
      "transcendance",
      "mythique",
      "legendaire",
      "epique",
      "rare",
      "non_commune",
      "commune",
    ]);
    expect(sortCollectionEntries(entries, "commonest").map((entry) => entry.rarity)).toEqual([
      "commune",
      "non_commune",
      "rare",
      "epique",
      "legendaire",
      "mythique",
      "transcendance",
    ]);
  });

  it("sorts owned forms first and orders each ownership group by effective rarity", () => {
    const cards = [
      card("common-owned", "commune"),
      card("mythic-missing", "mythique"),
      card("legendary-owned", "legendaire"),
      card("rare-missing", "rare"),
      card("awakened", "rare"),
    ];
    const copies = [
      { card_id: "common-owned", obtained_at: "2025-01-03", transcended: false },
      { card_id: "common-owned", obtained_at: "2025-01-04", transcended: false },
      { card_id: "legendary-owned", obtained_at: "2025-01-01", transcended: false },
      { card_id: "awakened", obtained_at: "2025-01-02", transcended: true },
    ];
    const entries = collectionEntries(cards, copies, new Set());
    expect(sortCollectionEntries(entries, "owned-rarest").map((entry) => entry.card.id)).toEqual([
      "awakened", "legendary-owned", "common-owned", "mythic-missing", "rare-missing",
    ]);
  });

  it("breaks rarity ties by popularity and ranks value using effective copy rarity", () => {
    const cards = [
      { ...card("less-popular", "rare"), popularity: 1000 },
      { ...card("popular", "rare"), popularity: 32000 },
      card("evolved", "commune"),
    ];
    const entries = collectionEntries(cards, [
      { card_id: "evolved", obtained_at: "2025-01-01", transcended: true },
    ], new Set());
    expect(sortCollectionEntries(entries, "rarest").map((entry) => entry.card.id)).toEqual([
      "evolved", "popular", "less-popular",
    ]);
    expect(sortCollectionEntries(entries, "commonest").map((entry) => entry.card.id)).toEqual([
      "popular", "less-popular", "evolved",
    ]);
    expect(sortCollectionEntries(entries, "value").map((entry) => entry.card.id)).toEqual([
      "evolved", "popular", "less-popular",
    ]);
  });
});
