import { describe, expect, it } from "vitest";
import { boosterStock, bestRarity, cardIdentity, GOKU_CARD_ID, TRANSCEND_CHANCE_PERCENT, CARDS_PER_BOOSTER, DROP_RATES, STOCK_CAP, PITY_LIMIT, formatCountdown, inPack, type Card } from "./cards";
import { readFileSync } from "node:fs";

const t0 = new Date("2026-11-19T12:00:00Z");
const min = 60_000;

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

describe("temporary Goku test rules", () => {
  const migration = readFileSync("drizzle/migrations/0002_temporary_goku_guaranteed_tests.sql", "utf8");
  it("keeps Goku in the card catalogue", () => {
    expect(GOKU_CARD_ID).toBe("al-246");
  });
  it("guarantees successful transcendence during testing", () => {
    expect(TRANSCEND_CHANCE_PERCENT).toBe(100);
    expect(migration).toContain("'_ok := true;");
  });
  it("evolves Goku into Ultra Instinct without renaming the base card", () => {
    const card = { id: "al-246", name: "Son Goku", title: "Guerrier Saiyan" } as Card;
    expect(cardIdentity(card, true).name).toBe("Son Goku (Ultra Instinct)");
    expect(cardIdentity(card, false).name).toBe("Son Goku");
  });
});

describe("booster content", () => {
  const migration = readFileSync("drizzle/migrations/0005_booster_rates_and_mythic_pity.sql", "utf8");
  const thresholds = [...migration.matchAll(/WHEN _roll < ([\d.]+) THEN '(\w+)'/g)].map((match) => ({ upper: Number(match[1]), rarity: match[2] }));
  for (const [rarity, rate] of Object.entries({ commune: 50, non_commune: 26, rare: 15, epique: 6, legendaire: 2.4, mythique: 0.6 })) {
    it(`${rarity} has ${rate}% in both client and SQL`, () => {
      expect(DROP_RATES[rarity as keyof typeof DROP_RATES]).toBe(rate);
      const index = thresholds.findIndex((t) => t.rarity === rarity);
      const actual = rarity === "commune" ? 100 - (thresholds.at(-1)?.upper ?? 0) : (thresholds[index]?.upper ?? 0) - (thresholds[index - 1]?.upper ?? 0);
      expect(actual).toBeCloseTo(rate);
    });
  }
  it("removes the guaranteed Goku override", () => expect(migration).not.toContain("al-246"));
  it("guarantees Mythique on booster 200 and advances per booster, not per card", () => {
    expect(PITY_LIMIT).toBe(200);
    expect(migration).toContain("_pity >= 199 AND i=5 AND NOT _mythic");
    expect(migration).toMatch(/FOR b IN 1\.\._count LOOP[\s\S]*FOR i IN 1\.\.5 LOOP[\s\S]*END LOOP;\s*_pity:=public.booster_pity_after\(_pity,_mythic\);\s*END LOOP;/);
  });
  it("resets on any Mythique and blocks client counter writes", () => {
    expect(migration).toContain("WHEN _mythic THEN 0 ELSE _counter + 1 END");
    expect(migration).toContain("GRANT SELECT ON public.booster_pity TO authenticated;");
    expect(migration).not.toMatch(/GRANT (?:ALL|.*UPDATE).*booster_pity TO authenticated/);
    expect(migration).toContain("WHERE p.user_id=_uid FOR UPDATE");
  });
  it("ranks Non Commune between Commune and Rare", () => {
    expect(bestRarity(["commune", "non_commune"])).toBe("non_commune");
    expect(bestRarity(["non_commune", "rare"])).toBe("rare");
  });
  it("contains 5 cards", () => expect(CARDS_PER_BOOSTER).toBe(5));
  it("never drops transcendance and totals 100%", () => {
    expect("transcendance" in DROP_RATES).toBe(false);
    expect(Object.values(DROP_RATES).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });
  it("ranks transcendance above mythique", () => {
    expect(bestRarity(["rare", "mythique", "transcendance"])).toBe("transcendance");
    expect(bestRarity(["rare", "legendaire", "mythique"])).toBe("mythique");
  });
});

describe("packs", () => {
  const villain = { category: "shonen", role: "antagoniste" } as Card;
  it("puts villains in the Antagoniste and their genre packs only", () => {
    expect(inPack(villain, "antagoniste")).toBe(true);
    expect(inPack(villain, "shonen")).toBe(true);
    expect(inPack(villain, "protagoniste")).toBe(false);
    expect(inPack(villain, "seinen")).toBe(false);
  });
});
