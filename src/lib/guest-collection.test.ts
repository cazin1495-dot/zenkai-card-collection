// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "./cards";
import {
  addGuestCollectionCards,
  getGuestBalance,
  getGuestCollection,
  guestDuplicates,
  guestRecycleGroups,
  GUEST_COLLECTION_KEY,
  recycleGuestCollection,
  getGuestPlus,
  setGuestPlusActive,
  setGuestPlusAvatar,
} from "./guest-collection";
import { GUEST_ZEN_KEY } from "./shards";

const card: Card = {
  id: "card",
  name: "Card",
  title: "",
  rarity: "rare",
  description: "",
  sort_order: 0,
  popularity: 40000,
};

describe("guest collection", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("preserves each draw, keeps the oldest copy and credits the exact value", () => {
    expect(getGuestBalance()).toBe(500);
    addGuestCollectionCards([
      { userCardId: "first", card },
      { userCardId: "second", card },
      { userCardId: "third", card },
    ]);
    const rows = getGuestCollection();
    const duplicates = guestDuplicates([...rows].reverse(), [card]);
    expect(duplicates.map((row) => row.id)).toEqual(["second", "third"]);
    expect(
      recycleGuestCollection(
        duplicates.map((row) => row.id),
        [card],
      ),
    ).toBe(72);
    expect(getGuestCollection().map((row) => row.id)).toEqual(["first"]);
    expect(getGuestBalance()).toBe(572);
  });

  it("protects transcended and custom copies and rejects stale selections", () => {
    addGuestCollectionCards([
      { userCardId: "first", card },
      { userCardId: "second", card, transcended: true },
      { userCardId: "third", card, customTranscendance: true },
    ]);
    expect(guestDuplicates(getGuestCollection(), [card])).toEqual([]);
    expect(() => recycleGuestCollection(["first"], [card])).toThrow();
    expect(getGuestCollection()).toHaveLength(3);
    expect(getGuestBalance()).toBe(500);
  });

  it("preserves the chronologically oldest copy even with different timestamp offsets", () => {
    const row = { card_id: card.id, transcended: false, awaken_attempted: false };
    const duplicates = guestDuplicates([
      { ...row, id: "newer", obtained_at: "2025-01-01T09:00:00Z" },
      { ...row, id: "oldest", obtained_at: "2025-01-01T10:00:00+02:00" },
    ], [card]);
    expect(duplicates.map((item) => item.id)).toEqual(["newer"]);
  });

  it("keeps an existing balance and rejects malformed storage", () => {
    localStorage.setItem(GUEST_ZEN_KEY, "0");
    expect(getGuestBalance()).toBe(0);
    localStorage.setItem(GUEST_COLLECTION_KEY, "{");
    expect(() => getGuestCollection()).toThrow();
  });

  it("does not delete copies or credit Zen when the atomic write fails", () => {
    addGuestCollectionCards([
      { userCardId: "first", card },
      { userCardId: "second", card },
    ]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage full");
    });
    expect(() => recycleGuestCollection(["second"], [card])).toThrow("storage full");
    expect(getGuestCollection()).toHaveLength(2);
    expect(getGuestBalance()).toBe(500);
  });

  it("awards the welcome bonus only once and credits the rounded bonus on recycling", () => {
    expect(setGuestPlusActive(true)).toBe(300);
    setGuestPlusAvatar("goku");
    addGuestCollectionCards([
      { userCardId: "first", card },
      { userCardId: "second", card },
    ]);
    expect(recycleGuestCollection(["second"], [card])).toBe(44);
    expect(getGuestBalance()).toBe(844);
    expect(getGuestPlus()).toEqual({ active: true, avatar: "goku", welcomeClaimed: true });
    setGuestPlusActive(false);
    expect(setGuestPlusActive(true)).toBe(0);
    expect(getGuestBalance()).toBe(844);
  });

  it("rounds the VIP gain up per rarity and rejects stale batch selections", () => {
    const common: Card = { ...card, id: "common", rarity: "commune", popularity: 32000 };
    const rare: Card = { ...card, id: "rare", rarity: "rare", popularity: 0 };
    setGuestPlusActive(true);
    addGuestCollectionCards([
      { userCardId: "c1", card: common }, { userCardId: "c2", card: common },
      { userCardId: "r1", card: rare }, { userCardId: "r2", card: rare },
      { userCardId: "awakened", card: rare, transcended: true },
    ]);
    const groups = guestRecycleGroups(getGuestCollection(), [common, rare], true);
    expect(groups.get("commune")?.gain).toBe(8);
    expect(groups.get("rare")?.gain).toBe(29);
    expect(() => recycleGuestCollection(["c2"], [common, rare], { rarities: ["commune", "rare"], total: 37 })).toThrow("changé");
    expect(() => recycleGuestCollection(["c2", "r2"], [common, rare], { rarities: ["commune", "rare"], total: 36 })).toThrow("gain a changé");
    expect(getGuestBalance()).toBe(800);
    expect(recycleGuestCollection(["c2", "r2"], [common, rare], { rarities: ["commune", "rare"], total: 37 })).toBe(37);
    expect(getGuestBalance()).toBe(837);
    expect(getGuestCollection().map((row) => row.id)).toEqual(["c1", "r1", "awakened"]);
  });

  it("does not mark welcome as claimed if the activation write fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage full");
    });
    expect(() => setGuestPlusActive(true)).toThrow("storage full");
    expect(getGuestBalance()).toBe(500);
    expect(getGuestPlus().welcomeClaimed).toBe(false);
  });
});
