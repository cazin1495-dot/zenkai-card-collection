import { describe, expect, it } from "vitest";
import {
  boosterStock,
  bestRarity,
  cardIdentity,
  effectiveDropRate,
  GOKU_CARD_ID,
  CARDS_PER_BOOSTER,
  CUSTOM_RARITY,
  DROP_RATES,
  STOCK_CAP,
  PITY_LIMIT,
  TRANSCEND_CHANCE_LABEL,
  TRANSCEND_CHANCE_PERCENT,
  formatCountdown,
  getPackCardBack,
  getCardMarketPrice,
  getCardPopularityFactor,
  getCardRecycleValue,
  inPack,
  isTranscendanceCatalogCard,
  normalizeCatalogCard,
  PACKS,
  rarityFromRoll,
  type Card,
} from "./cards";

const t0 = new Date("2026-11-19T12:00:00Z");
const min = 60_000;

describe("local card economics", () => {
  it("prices each rarity and clamps and rounds popularity adjustments", () => {
    expect(["commune", "non_commune", "rare", "epique", "legendaire", "mythique", "transcendance"].map(
      (rarity) => getCardMarketPrice({ rarity: rarity as import("./cards").Rarity }),
    )).toEqual([10, 25, 60, 150, 400, 1200, 5000]);
    expect(getCardMarketPrice({ rarity: "rare", popularity: -100 })).toBe(60);
    expect(getCardMarketPrice({ rarity: "rare", popularity: 32000 })).toBe(85);
    expect(getCardMarketPrice({ rarity: "rare", popularity: 100000 })).toBe(120);
    expect(getCardPopularityFactor({ popularity: 31999 })).toBeLessThan(1.4);
    expect(getCardPopularityFactor({ popularity: 32000 })).toBeGreaterThanOrEqual(1.4);
  });
  it("protects Transcendance and computes standard recycling from market value", () => {
    expect(getCardRecycleValue({ rarity: "transcendance", popularity: 80000 })).toBe(0);
    expect(getCardRecycleValue({ rarity: "rare", popularity: 32000 })).toBe(34);
    expect(getCardRecycleValue({ rarity: "commune" })).toBe(4);
  });
});

describe("booster stock", () => {
  it("gains +1 booster every 10 minutes", () => {
    expect(boosterStock(3, t0, t0.getTime()).count).toBe(3);
    expect(boosterStock(3, t0, t0.getTime() + 9 * min).count).toBe(3);
    expect(boosterStock(3, t0, t0.getTime() + 10 * min).count).toBe(4);
    expect(boosterStock(3, t0, t0.getTime() + 35 * min).count).toBe(6);
  });
  it("shows time left before the next booster", () => {
    const remaining = boosterStock(3, t0, t0.getTime() + 1 * min).nextInMs;
    expect(remaining).not.toBeNull();
    if (remaining === null) throw new Error("Expected countdown");
    expect(formatCountdown(remaining)).toBe("09:00");
  });
  it("never exceeds 15 boosters", () => {
    expect(STOCK_CAP).toBe(15);
    const s = boosterStock(14, t0, t0.getTime() + 300 * min);
    expect(s.count).toBe(15);
    expect(s.nextInMs).toBeNull();
  });
});

describe("card identity", () => {
  it("keeps Goku in the card catalogue", () => {
    expect(GOKU_CARD_ID).toBe("al-246");
  });
  it("evolves Goku into Ultra Instinct without renaming the base card", () => {
    const card = { id: "al-246", name: "Son Goku", title: "Guerrier Saiyan" } as Card;
    expect(cardIdentity(card, true).name).toBe("Son Goku (Ultra Instinct)");
    expect(cardIdentity(card, false).name).toBe("Son Goku");
  });
});

describe("booster content", () => {
  const rates = {
    commune: 54,
    non_commune: 26.5,
    rare: 14,
    epique: 4,
    legendaire: 1.2,
    mythique: 0.25,
    transcendance: 0.05,
  } as const;
  it("uses the requested per-card rates and totals 100%", () => {
    expect(DROP_RATES).toEqual(rates);
    expect(Object.values(DROP_RATES).reduce((total, rate) => total + rate, 0)).toBe(100);
    for (const [rarity, rate] of Object.entries(rates)) {
      expect(effectiveDropRate(rarity as keyof typeof rates)).toBe(rate);
      expect(effectiveDropRate(rarity as keyof typeof rates, "shonen")).toBe(rate);
    }
    expect(effectiveDropRate("mythique", "zenkai")).toBe(2.5);
    expect(effectiveDropRate("transcendance", "zenkai")).toBe(0.5);
  });
  it.each([
    [0, "commune"],
    [53.9999, "commune"],
    [54, "non_commune"],
    [80.4999, "non_commune"],
    [80.5, "rare"],
    [94.4999, "rare"],
    [94.5, "epique"],
    [98.4999, "epique"],
    [98.5, "legendaire"],
    [99.6999, "legendaire"],
    [99.7, "mythique"],
    [99.9499, "mythique"],
    [99.95, "transcendance"],
  ] as const)("maps roll %s to %s", (roll, rarity) => {
    expect(rarityFromRoll(roll)).toBe(rarity);
  });
  it("keeps the Mythique pity limit at 200 boosters", () => expect(PITY_LIMIT).toBe(200));
  it("uses the dedicated 0.05% Transcendance drop rate", () => {
    expect(TRANSCEND_CHANCE_PERCENT).toBe(0.05);
    expect(TRANSCEND_CHANCE_LABEL).toBe("0.05 %");
  });
  it("filters Transcendance rarity and TR-suffixed codes from the standard catalog", () => {
    expect(isTranscendanceCatalogCard({ id: "al-123", rarity: "Transcendance" })).toBe(true);
    expect(isTranscendanceCatalogCard({ id: "al-123-TR", rarity: "mythique" })).toBe(true);
    expect(isTranscendanceCatalogCard({ id: "al-123", name: "Son Goku (Ultra Instinct)", rarity: "mythique" })).toBe(true);
    expect(isTranscendanceCatalogCard({ id: "al-123", rarity: "mythique" })).toBe(false);
    expect(isTranscendanceCatalogCard({ id: "goku-black-TR", name: "Goku Black", rarity: "Transcendance" })).toBe(true);
  });
  it("normalizes the existing Goku Black catalog card to Mythique in both requested packs", () => {
    const gokuBlack = normalizeCatalogCard({
      id: "goku-black",
      name: "Goku Black",
      title: "Dragon Ball Super",
      rarity: "rare",
      description: "",
      sort_order: 2,
      category: "seinen",
      role: null,
    });

    expect(gokuBlack.rarity).toBe("mythique");
    expect(inPack(gokuBlack, "antagoniste")).toBe(true);
    expect(inPack(gokuBlack, "shonen")).toBe(true);
  });
  it.each([
    ["Hancock", "Boa Hancock", "Hancock Boa", "Whitebeard", "Edward Newgate", "Newgate Edward", "Barbe Blanche", "Pain", "Nagato",
      "Shikamaru", "Shikamaru Nara", "Yamato", "Nami", "Hinata", "Hinata Hyuga", "Hinata Hyuuga", "Trunks",
      "Mirai Trunks", "Future Trunks", "Hashirama", "Hashirama Senju", "Mei Mei", "Tobirama",
      "Tobirama Senju", "Kawaki", "Kenjaku", "Minato", "Minato Namikaze"],
    ["Grimmjow", "Grimmjow Jaegerjaquez", "Zaraki", "Kenpachi Zaraki", "Orihime", "Orihime Inoue",
      "Hitsugaya", "Toshiro Hitsugaya", "Byakuya", "Byakuya Kuchiki", "Rock Lee", "Lee", "Tobi",
      "Choso", "Chousou", "Mahito", "Doflamingo", "Donquixote Doflamingo", "Doflamingo Donquixote", "Franky", "Jinbe",
      "Jinbei", "Renji", "Renji Abarai", "Beerus", "Neji", "Neji Hyuga", "Neji Hyuuga", "Kurama", "Kyubi", "Sabo",
      "Bardock", "Whis", "Sarada", "Sarada Uchiha", "Mitsuki", "Killer Bee", "Killer B"],
  ])("normalizes every requested name and case variant", (...names) => {
    const rarity = names[0] === "Hancock" ? "mythique" : "legendaire";
    for (const name of names) {
      const card: Card = { id: name, name: `  ${name.toUpperCase()}  `, title: "", description: "", rarity: "rare", sort_order: 0 };
      expect(normalizeCatalogCard(card).rarity, name).toBe(rarity);
      expect(card.rarity).toBe("rare");
    }
  });
  it("uses whole names and preserves unrelated and Transcendance cards", () => {
    const card: Card = { id: "x", name: "Ruan Mei", title: "", description: "", rarity: "rare", sort_order: 0 };
    for (const name of ["Ruan Mei", "Seele", "Leeann", "Sabo Jr", "constructor"]) {
      expect(normalizeCatalogCard({ ...card, name }).rarity).toBe("rare");
    }
    expect(normalizeCatalogCard({ ...card, name: "Tōshirō Hitsugaya" }).rarity).toBe("legendaire");
    expect(normalizeCatalogCard({ ...card, name: "Nami", id: "nami-TR" }).rarity).toBe("rare");
    expect(normalizeCatalogCard({ ...card, name: "Nami", transcendance_series_number: "001" }).rarity).toBe("rare");
  });
  it.each(["shonen", "Shonen Mix", "shonen-mix", "SHONEN-MIX", "shonen_mix", "all", "all-star"])(
    "includes the full catalogue in Shonen Mix aliases (%s)",
    (pack) => {
      const card: Card = {
        id: "seinen-card",
        name: "Seinen",
        title: "",
        description: "",
        rarity: "rare",
        sort_order: 0,
        category: "seinen",
      };
      expect(inPack(card, pack)).toBe(true);
    },
  );
  it("applies custom lowercase name overrides before existing rules without changing Transcendance", () => {
    const card: Card = { id: "nami", name: "NAMI", title: "", description: "", rarity: "rare", sort_order: 0 };
    CUSTOM_RARITY["nami"] = "legendaire";
    CUSTOM_RARITY["goku black"] = "legendaire";
    CUSTOM_RARITY["méi"] = "mythique";
    try {
      expect(normalizeCatalogCard(card)).toMatchObject({ rarity: "legendaire", serverRarity: "rare" });
      expect(normalizeCatalogCard({ ...card, id: "goku-black", name: "Goku Black" }))
        .toMatchObject({ rarity: "legendaire", category: "shonen", role: "antagoniste" });
      expect(normalizeCatalogCard({ ...card, name: "MÉI" }).rarity).toBe("mythique");
      expect(normalizeCatalogCard({ ...card, id: "nami-TR" }).rarity).toBe("rare");
      expect(normalizeCatalogCard({ ...card, name: "Namiko" }).rarity).toBe("rare");
    } finally {
      delete CUSTOM_RARITY["nami"];
      delete CUSTOM_RARITY["goku black"];
      delete CUSTOM_RARITY["méi"];
    }
  });
  it("ranks Non Commune between Commune and Rare", () => {
    expect(bestRarity(["commune", "non_commune"])).toBe("non_commune");
    expect(bestRarity(["non_commune", "rare"])).toBe("rare");
  });
  it("contains 5 cards", () => expect(CARDS_PER_BOOSTER).toBe(5));
  it("ranks transcendance above mythique", () => {
    expect(bestRarity(["rare", "mythique", "transcendance"])).toBe("transcendance");
    expect(bestRarity(["rare", "legendaire", "mythique"])).toBe("mythique");
  });
});

describe("packs", () => {
  const villain = { category: "shonen", role: "antagoniste" } as Card;
  it("uses themed card backs for Seinen, Shojo, Sport, Antagoniste and Protagoniste", () => {
    expect(getPackCardBack("seinen")).toBe("/card-back-seinen.png");
    expect(getPackCardBack("shojo")).toBe("/card-back-shojo.png");
    expect(getPackCardBack("sport")).toBe("/carte%20sport.jpg");
    expect(getPackCardBack("antagoniste")).toBe("/card-back-antagoniste.png");
    expect(getPackCardBack("protagoniste")).toBe("/card-back-protagoniste.png");
    for (const pack of ["shonen", "zenkai"] as const) {
      expect(getPackCardBack(pack)).toBe("/image_39f4fe98.jpg");
    }
  });
  it("keeps the six original packs alongside the Zenkai pack", () => {
    expect(PACKS.map((pack) => pack.id)).toEqual([
      "shonen",
      "seinen",
      "shojo",
      "sport",
      "antagoniste",
      "protagoniste",
      "zenkai",
    ]);
  });
  it("includes all categories and roles in both universal packs", () => {
    for (const pack of ["shonen", "zenkai"] as const) {
      for (const category of ["shonen", "seinen", "shojo", "sport", null] as const) {
        for (const role of ["antagoniste", "protagoniste", null] as const) {
          expect(inPack({ category, role } as Card, pack)).toBe(true);
        }
      }
    }
  });
  it("puts villains in the Antagoniste and their genre packs only", () => {
    expect(inPack(villain, "antagoniste")).toBe(true);
    expect(inPack(villain, "shonen")).toBe(true);
    expect(inPack(villain, "protagoniste")).toBe(false);
    expect(inPack(villain, "seinen")).toBe(false);
  });
});
