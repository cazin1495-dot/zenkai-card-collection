import { describe, expect, it } from "vitest";
import { boosterStock, bestRarity, cardIdentity, GOKU_CARD_ID, GOKU_TEST_DROP_PERCENT, TRANSCEND_CHANCE_PERCENT, CARDS_PER_BOOSTER, DROP_RATES, STOCK_CAP, formatCountdown, inPack, type Card } from "./cards";
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
  it("guarantees Goku in Shonen Mix only", () => {
    expect(GOKU_TEST_DROP_PERCENT).toBe(100);
    expect(GOKU_CARD_ID).toBe("al-246");
    expect(migration).toContain("IF _category = ''shonen'' THEN");
    expect(migration).toContain("c.id = ''al-246'' AND c.active AND c.rarity = ''mythique''");
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
  it("contains 5 cards", () => expect(CARDS_PER_BOOSTER).toBe(5));
  it("gives 2.7 % mythique per card and never transcendance", () => {
    expect(DROP_RATES.mythique).toBe(2.7);
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
