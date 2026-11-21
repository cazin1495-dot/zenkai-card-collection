// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "./cards";
import {
  addGuestCollectionCards,
  getGuestBalance,
  getGuestCollection,
  setGuestPlusActive,
} from "./guest-collection";
import {
  bidOnGuestListing,
  buyGuestListing,
  cancelGuestListing,
  getGuestMarket,
  initializeGuestMarket,
  listGuestCopy,
  settleGuestMarket,
} from "./guest-market";
import { CUSTOM_TRANSCENDANCE_CARDS, customTranscendanceAsCard } from "./transcendance-cards";

const cards: Card[] = [
  { id: "c", name: "Commune", title: "", description: "", rarity: "commune", sort_order: 0 },
  { id: "r", name: "Rare", title: "", description: "", rarity: "rare", sort_order: 1 },
];
const now = 1_700_000_000_000;

describe("guest market", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    initializeGuestMarket(cards, now);
  });

  it("buys once and preserves every copy and the exact balance", () => {
    const listing = getGuestMarket().listings.find((item) => item.kind === "fixed")!;
    buyGuestListing(listing.id, now);
    expect(getGuestBalance()).toBe(500 - listing.price);
    expect(getGuestCollection().map((row) => row.card_id)).toEqual([listing.cardId]);
    expect(() => buyGuestListing(listing.id, now)).toThrow();
    expect(getGuestCollection()).toHaveLength(1);
  });

  it("escrows and restores the exact copy, or credits a simulated sale once", () => {
    addGuestCollectionCards([{ userCardId: "copy", card: cards[0]! }]);
    const saved = getGuestCollection()[0];
    const listing = listGuestCopy("copy", cards[0]!, "fixed", 80, 2, now);
    expect(getGuestCollection()).toEqual([]);
    cancelGuestListing(listing.id, now + 1);
    expect(getGuestCollection()[0]).toEqual(saved);
    listGuestCopy("copy", cards[0]!, "fixed", 80, 2, now);
    expect(settleGuestMarket(now + 30_000)).toHaveLength(1);
    expect(settleGuestMarket(now + 30_000)).toEqual([]);
    expect(getGuestBalance()).toBe(580);
    expect(getGuestCollection()).toEqual([]);
  });

  it("reserves bids, supports raising one's bid, and delivers only once after expiry", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const auction = getGuestMarket().listings.find((item) => item.kind === "auction")!;
    bidOnGuestListing(auction.id, 100, now);
    expect(getGuestBalance()).toBe(400);
    bidOnGuestListing(auction.id, 120, now + 1);
    expect(getGuestBalance()).toBe(380);
    expect(() => bidOnGuestListing(auction.id, 1000, now + 1)).toThrow("insuffisant");
    settleGuestMarket(auction.endAt!);
    settleGuestMarket(auction.endAt!);
    expect(getGuestCollection().map((row) => row.card_id)).toEqual([auction.cardId]);
    expect(getGuestBalance()).toBe(380);
  });

  it("refunds reserved Zen immediately when a fictitious rival outbids", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.9);
    const auction = getGuestMarket().listings.find((item) => item.kind === "auction")!;
    bidOnGuestListing(auction.id, 100, now);
    random.mockReturnValue(0.1);
    expect(bidOnGuestListing(auction.id, 120, now + 1).outbid).toBe(true);
    expect(getGuestBalance()).toBe(500);
    expect(getGuestMarket().listings.find((item) => item.id === auction.id)?.bid).toBe(130);
  });

  it("settles a player's auction and survives failed storage writes without losing a copy", () => {
    addGuestCollectionCards([{ userCardId: "copy", card: cards[0]! }]);
    const listing = listGuestCopy("copy", cards[0]!, "auction", 60, 2, now);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage full");
    });
    expect(() => settleGuestMarket(now + 120_000)).toThrow("storage full");
    expect(getGuestMarket().listings.some((item) => item.id === listing.id)).toBe(true);
    expect(getGuestBalance()).toBe(500);
    vi.restoreAllMocks();
    settleGuestMarket(now + 120_000);
    expect(getGuestBalance()).toBe(560);
    expect(getGuestCollection()).toEqual([]);
  });

  it("preserves active listings when the guest balance or collection changes elsewhere", () => {
    addGuestCollectionCards([{ userCardId: "copy", card: cards[0]! }]);
    const listing = listGuestCopy("copy", cards[0]!, "auction", 60, 2, now);
    setGuestPlusActive(true);
    addGuestCollectionCards([{ userCardId: "new", card: cards[1]! }]);
    expect(getGuestMarket().listings.some((item) => item.id === listing.id)).toBe(true);
    cancelGuestListing(listing.id, now + 1);
    expect(
      getGuestCollection()
        .map((row) => row.id)
        .sort(),
    ).toEqual(["copy", "new"]);
    expect(getGuestBalance()).toBe(800);
  });

  it("keeps custom Transcendance offers at their true rarity and price", () => {
    localStorage.clear();
    const card = customTranscendanceAsCard(CUSTOM_TRANSCENDANCE_CARDS[0]!);
    initializeGuestMarket([card], now);
    const listing = getGuestMarket().listings[0]!;
    expect(listing.rarity).toBe("transcendance");
    expect(listing.price).toBe(5000);
    expect(() => buyGuestListing(listing.id, now)).toThrow("insuffisant");
    expect(getGuestCollection()).toEqual([]);
  });
});
