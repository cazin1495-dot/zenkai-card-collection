// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyRemoteRarityOverrides, CUSTOM_RARITY, DEMON_SLAYER_MYTHIC_CARDS, type Card } from "./cards";
import {
  addGuestCollectionCards,
  getGuestBalance,
  getGuestCollection,
  GUEST_COLLECTION_KEY,
  MARKET_AUCTIONS_KEY,
  setGuestPlusActive,
  updateGuestState,
} from "./guest-collection";
import { getSecretQuests } from "./quests";
import {
  bidOnGuestListing,
  auctionCountdown,
  buyoutGuestAuction,
  buyGuestListing,
  cancelGuestListing,
  ensureGuestAuctions,
  getGuestMarket,
  initializeGuestMarket,
  listGuestCopy,
  minimumAuctionBid,
  settleGuestMarket,
} from "./guest-market";
import { CUSTOM_TRANSCENDANCE_CARDS, customTranscendanceAsCard } from "./transcendance-cards";
import { seedLegacyAuction } from "@/test/legacy-market";

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
    seedLegacyAuction("r", now);
  });

  it("buys once and preserves every copy and the exact balance", () => {
    const listing = getGuestMarket().listings.find((item) => item.kind === "fixed")!;
    buyGuestListing(listing.id, now);
    expect(getGuestBalance()).toBe(500 - listing.price);
    expect(getGuestCollection().map((row) => row.card_id)).toEqual([listing.cardId]);
    expect(() => buyGuestListing(listing.id, now)).toThrow();
    expect(getGuestCollection()).toHaveLength(1);
  });

  it("débloque le succès si un achat vide exactement le solde", () => {
    const listing = getGuestMarket().listings.find((item) => item.kind === "fixed")!;
    updateGuestState((state) => ({ state: { ...state, zen: listing.price }, result: undefined }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage full"); });
    expect(() => buyGuestListing(listing.id, now)).toThrow("storage full");
    expect(getSecretQuests().unlocked).not.toContain("zero");
    vi.restoreAllMocks();
    buyGuestListing(listing.id, now);
    expect(getGuestBalance()).toBe(500);
    expect(getSecretQuests().unlocked).toContain("zero");
    expect(getSecretQuests().claimed).toContain("zero");
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
    bidOnGuestListing(auction.id, 150, now + 1);
    expect(getGuestBalance()).toBe(350);
    expect(() => bidOnGuestListing(auction.id, 1000, now + 1)).toThrow("insuffisant");
    settleGuestMarket(auction.endAt!);
    settleGuestMarket(auction.endAt!);
    expect(getGuestCollection().map((row) => row.card_id)).toEqual([auction.cardId]);
    expect(getGuestBalance()).toBe(350);
  });

  it("refunds reserved Zen when a fictitious rival outbids near the end", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const auction = getGuestMarket().listings.find((item) => item.kind === "auction")!;
    bidOnGuestListing(auction.id, 100, now);
    expect(getGuestBalance()).toBe(400);
    expect(settleGuestMarket(auction.endAt! - 10_001)).toEqual([]);
    expect(settleGuestMarket(auction.endAt! - 10_000)).toEqual(["Kuro_TCG a surenchéri sur Rare !"]);
    expect(getGuestBalance()).toBe(500);
    expect(getGuestMarket().listings.find((item) => item.id === auction.id)).toMatchObject({
      bid: 150, bidder: "npc", bidCount: 2, bidderName: "Kuro_TCG",
    });
    expect(settleGuestMarket(auction.endAt!)).toEqual([]);
    expect(getGuestBalance()).toBe(500);
  });

  it("applique le plus grand incrément entre 50 Zen et 10 %", () => {
    expect(minimumAuctionBid({ bid: null, price: 90 })).toBe(90);
    expect(minimumAuctionBid({ bid: 100, price: 90 })).toBe(150);
    expect(minimumAuctionBid({ bid: 1001, price: 90 })).toBe(1102);
  });

  it("affiche les jours, les heures et la dernière heure aux seuils exacts", () => {
    const hour = 3_600_000;
    expect(auctionCountdown(now + 38 * hour, now)).toEqual({ label: "1j 14h", urgent: false });
    expect(auctionCountdown(now + 24 * hour + 1, now)).toEqual({ label: "1j 0h", urgent: false });
    expect(auctionCountdown(now + 24 * hour, now)).toEqual({ label: "24h 0m", urgent: false });
    expect(auctionCountdown(now + 5 * hour + 42 * 60_000, now)).toEqual({ label: "5h 42m", urgent: false });
    expect(auctionCountdown(now + hour, now)).toEqual({ label: "1h 0m", urgent: false });
    expect(auctionCountdown(now + hour - 1000, now)).toEqual({ label: "59:59", urgent: true });
    expect(auctionCountdown(now + 1000, now)).toEqual({ label: "00:01", urgent: true });
    expect(auctionCountdown(now - 1, now)).toEqual({ label: "00:00", urgent: true });
  });

  it("n'accepte que les cinq nouvelles durées sans modifier les anciennes enchères", () => {
    addGuestCollectionCards([{ userCardId: "copy", card: cards[0]! }]);
    const legacy = getGuestMarket().listings.find((item) => item.kind === "auction")!;
    expect(legacy.endAt).toBe(now + 15 * 60_000);
    for (const duration of [60, 360, 720, 1440, 2880]) {
      const listing = listGuestCopy("copy", cards[0]!, "auction", 60, duration, now);
      expect(listing.endAt).toBe(now + duration * 60_000);
      cancelGuestListing(listing.id, now);
    }
    for (const duration of [2, 5, 10, 15, 30, 1441]) {
      expect(() => listGuestCopy("copy", cards[0]!, "auction", 60, duration, now)).toThrow("Durée");
    }
    expect(getGuestMarket().listings.find((item) => item.id === legacy.id)?.endAt).toBe(legacy.endAt);
    expect(getGuestCollection()).toHaveLength(1);
  });

  it("valide le prix d'achat immédiat avant de réserver une copie", () => {
    addGuestCollectionCards([{ userCardId: "copy", card: cards[0]! }]);
    for (const invalid of [0, -1, 50, 49, 50.5]) {
      expect(() => listGuestCopy("copy", cards[0]!, "auction", 50, 60, now, invalid)).toThrow();
      expect(getGuestCollection()).toHaveLength(1);
    }
    expect(() => listGuestCopy("copy", cards[0]!, "fixed", 50, 2, now, 120)).toThrow();
    const listing = listGuestCopy("copy", cards[0]!, "auction", 50, 60, now, 120);
    expect(getGuestMarket().listings.find((item) => item.id === listing.id)?.buyoutPrice).toBe(120);
    expect(JSON.parse(localStorage.getItem(MARKET_AUCTIONS_KEY)!).listings.find((item: { id: string }) => item.id === listing.id).buyoutPrice).toBe(120);
  });

  it("achète immédiatement une enchère en déduisant les Zen déjà réservés, une seule fois", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const auction = getGuestMarket().listings.find((item) => item.kind === "auction")!;
    const listings = getGuestMarket().listings.map((item) => item.id === auction.id ? { ...item, buyoutPrice: 200 } : item);
    updateGuestState((state) => ({ state: { ...state, market: { listings } }, result: undefined }));
    bidOnGuestListing(auction.id, 100, now);
    expect(getGuestBalance()).toBe(400);
    buyoutGuestAuction(auction.id, now + 1);
    expect(getGuestBalance()).toBe(300);
    expect(getGuestCollection().map((row) => row.card_id)).toEqual(["r"]);
    expect(() => buyoutGuestAuction(auction.id, now + 1)).toThrow();
    expect(getGuestBalance()).toBe(300);
  });

  it("transforme une offre au prix immédiat en achat au prix fixé", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const auction = getGuestMarket().listings.find((item) => item.kind === "auction")!;
    const listings = getGuestMarket().listings.map((item) => item.id === auction.id ? { ...item, buyoutPrice: 120 } : item);
    updateGuestState((state) => ({ state: { ...state, market: { listings } }, result: undefined }));
    bidOnGuestListing(auction.id, 100, now);
    const result = bidOnGuestListing(auction.id, 120, now + 1);
    expect(result).toMatchObject({ purchased: true, amount: 120 });
    expect(getGuestBalance()).toBe(380);
    expect(getGuestCollection()).toHaveLength(1);
  });

  it("débloque le succès si l'achat immédiat laisse exactement zéro Zen", () => {
    const auction = getGuestMarket().listings.find((item) => item.kind === "auction")!;
    const listings = getGuestMarket().listings.map((item) => item.id === auction.id ? { ...item, buyoutPrice: 120 } : item);
    updateGuestState((state) => ({ state: { ...state, zen: 120, market: { listings } }, result: undefined }));
    buyoutGuestAuction(auction.id, now);
    expect(getSecretQuests().claimed).toContain("zero");
    expect(getGuestBalance()).toBe(500);
    expect(getGuestCollection()).toHaveLength(1);
  });

  it("refuse les achats indisponibles, expirés ou insuffisamment financés sans perdre l'offre", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const auction = getGuestMarket().listings.find((item) => item.kind === "auction")!;
    expect(() => buyoutGuestAuction(auction.id, now)).toThrow();
    const listings = getGuestMarket().listings.map((item) => item.id === auction.id ? { ...item, buyoutPrice: 600 } : item);
    updateGuestState((state) => ({ state: { ...state, market: { listings } }, result: undefined }));
    bidOnGuestListing(auction.id, 100, now);
    expect(() => buyoutGuestAuction(auction.id, now + 1)).toThrow("insuffisant");
    expect(() => buyoutGuestAuction(auction.id, auction.endAt!)).toThrow();
    expect(getGuestBalance()).toBe(400);
    expect(getGuestMarket().listings.find((item) => item.id === auction.id)?.bid).toBe(100);
    expect(getGuestCollection()).toHaveLength(0);
  });

  it("rembourse une offre quand un rival atteint le prix d'achat immédiat", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const auction = getGuestMarket().listings.find((item) => item.kind === "auction")!;
    const listings = getGuestMarket().listings.map((item) => item.id === auction.id ? { ...item, buyoutPrice: 130 } : item);
    updateGuestState((state) => ({ state: { ...state, market: { listings } }, result: undefined }));
    bidOnGuestListing(auction.id, 100, now);
    expect(settleGuestMarket(auction.endAt! - 10_000)).toEqual([
      "Kuro_TCG a acheté Rare immédiatement ! Ton offre a été remboursée.",
    ]);
    expect(getGuestBalance()).toBe(500);
    expect(getGuestMarket().listings.some((item) => item.id === auction.id)).toBe(false);
    expect(settleGuestMarket(auction.endAt!)).toEqual([]);
  });

  it("conserve l'offre et les Zen réservés si la sauvegarde de l'achat échoue", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const auction = getGuestMarket().listings.find((item) => item.kind === "auction")!;
    const listings = getGuestMarket().listings.map((item) => item.id === auction.id ? { ...item, buyoutPrice: 200 } : item);
    updateGuestState((state) => ({ state: { ...state, market: { listings } }, result: undefined }));
    bidOnGuestListing(auction.id, 100, now);
    const stored = localStorage.getItem(MARKET_AUCTIONS_KEY);
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === GUEST_COLLECTION_KEY) throw new Error("storage full");
      return setItem.call(this, key, value);
    });
    expect(() => buyoutGuestAuction(auction.id, now)).toThrow("storage full");
    expect(getGuestBalance()).toBe(400);
    expect(getGuestCollection()).toHaveLength(0);
    expect(localStorage.getItem(MARKET_AUCTIONS_KEY)).toBe(stored);
    expect(getGuestMarket().listings.find((item) => item.id === auction.id)?.bid).toBe(100);
  });

  it("crédite une vente immédiate fictive attractive à 30 secondes et ne la crédite qu'une fois", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.2);
    addGuestCollectionCards([{ userCardId: "copy", card: cards[0]! }]);
    const item = listGuestCopy("copy", cards[0]!, "auction", 50, 60, now, 120);
    expect(() => buyoutGuestAuction(item.id, now)).toThrow();
    expect(settleGuestMarket(now + 29_999)).toEqual([]);
    expect(settleGuestMarket(now + 30_000)).toEqual(["Vente immédiate réalisée : Commune vendue pour 120 Zen !"]);
    expect(getGuestBalance()).toBe(620);
    expect(getGuestCollection()).toHaveLength(0);
    expect(settleGuestMarket(now + 120_000)).toEqual([]);
    expect(getGuestBalance()).toBe(620);
  });

  it("laisse les offres non attractives ou ignorées se terminer normalement", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.9);
    addGuestCollectionCards([{ userCardId: "a", card: cards[0]! }, { userCardId: "b", card: cards[0]! }]);
    const expensive = listGuestCopy("a", cards[0]!, "auction", 50, 60, now, 121);
    const declined = listGuestCopy("b", cards[0]!, "auction", 50, 60, now, 120);
    settleGuestMarket(now + 30_000);
    expect(getGuestMarket().listings.filter((item) => [expensive.id, declined.id].includes(item.id)).map((item) => item.bid)).toEqual([50, 50]);
    expect(getGuestBalance()).toBe(500);
    random.mockReturnValue(0.2);
    settleGuestMarket(now + 3_600_000);
    expect(getGuestBalance()).toBe(600);
  });

  it("maintient six enchères variées, avec échéance et stockage dédié", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.2);
    const catalog: Card[] = [
      { ...cards[0]!, id: "epic", rarity: "epique" },
      { ...cards[0]!, id: "legend", rarity: "legendaire" },
      { ...cards[0]!, id: "myth", rarity: "mythique" },
      customTranscendanceAsCard(CUSTOM_TRANSCENDANCE_CARDS[0]!),
    ];
    ensureGuestAuctions(catalog, now);
    const auctions = getGuestMarket().listings.filter((item) => item.kind === "auction" && item.seller === "npc");
    expect(auctions).toHaveLength(6);
    expect(new Set(auctions.map((item) => item.rarity))).toEqual(new Set(["rare", "epique", "legendaire", "mythique", "transcendance"]));
    expect(auctions.filter((item) => item.rarity !== "rare").every((item) => item.endAt! >= now + 30 * 60_000 && item.endAt! <= now + 24 * 3_600_000)).toBe(true);
    expect(JSON.parse(localStorage.getItem(MARKET_AUCTIONS_KEY)!).listings).toHaveLength(6);
    settleGuestMarket(now + 900_000);
    ensureGuestAuctions(catalog, now + 900_000);
    expect(getGuestMarket().listings.filter((item) => item.kind === "auction" && item.seller === "npc")).toHaveLength(6);
  });

  it("génère des durées fictives couvrant les bornes de 30 minutes à 24 heures", () => {
    const random = vi.spyOn(Math, "random");
    const catalog: Card[] = [{ ...cards[0]!, id: "epic", rarity: "epique" }];
    for (const [value, expected] of [[0, 30], [0.999999, 1440]] as const) {
      localStorage.clear();
      initializeGuestMarket(catalog, now);
      random.mockReturnValue(value);
      ensureGuestAuctions(catalog, now);
      const auctions = getGuestMarket().listings.filter((item) => item.kind === "auction");
      expect(auctions).toHaveLength(6);
      expect(auctions.every((item) => item.endAt === now + expected * 60_000)).toBe(true);
    }
  });

  it("initialise six enchères uniquement de haute rareté et répare l'index après interruption", () => {
    localStorage.clear();
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const catalog: Card[] = [
      { ...cards[0]!, id: "epic", rarity: "epique" },
      { ...cards[0]!, id: "legend", rarity: "legendaire" },
      { ...cards[0]!, id: "myth", rarity: "mythique" },
    ];
    initializeGuestMarket(catalog, now);
    ensureGuestAuctions(catalog, now);
    const active = getGuestMarket().listings.filter((item) => item.kind === "auction");
    expect(active).toHaveLength(6);
    expect(new Set(active.map((item) => item.rarity))).toEqual(new Set(["epique", "legendaire", "mythique"]));
    localStorage.setItem(MARKET_AUCTIONS_KEY, '{"listings":[]}');
    expect(getGuestMarket().listings.filter((item) => item.kind === "auction")).toHaveLength(6);
    expect(JSON.parse(localStorage.getItem(MARKET_AUCTIONS_KEY)!).listings).toHaveLength(6);
  });

  it("protège les enchères et le solde si l'écriture de la collection échoue", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const auction = getGuestMarket().listings.find((item) => item.kind === "auction")!;
    const prior = localStorage.getItem(MARKET_AUCTIONS_KEY);
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === GUEST_COLLECTION_KEY) throw new Error("storage full");
      return setItem.call(this, key, value);
    });
    expect(() => bidOnGuestListing(auction.id, 100, now)).toThrow("storage full");
    expect(localStorage.getItem(MARKET_AUCTIONS_KEY)).toBe(prior);
    expect(getGuestBalance()).toBe(500);
  });

  it("ne débite pas une offre si l'écriture de l'index des enchères échoue", () => {
    const auction = getGuestMarket().listings.find((item) => item.kind === "auction")!;
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === MARKET_AUCTIONS_KEY) throw new Error("storage full");
      return setItem.call(this, key, value);
    });
    expect(() => bidOnGuestListing(auction.id, 100, now)).toThrow("storage full");
    expect(getGuestBalance()).toBe(500);
    expect(getGuestMarket().listings.find((item) => item.id === auction.id)?.bid).toBeNull();
  });

  it("settles a player's auction and survives failed storage writes without losing a copy", () => {
    addGuestCollectionCards([{ userCardId: "copy", card: cards[0]! }]);
    const listing = listGuestCopy("copy", cards[0]!, "auction", 60, 60, now);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage full");
    });
    expect(() => settleGuestMarket(listing.endAt!)).toThrow("storage full");
    expect(getGuestMarket().listings.some((item) => item.id === listing.id)).toBe(true);
    expect(getGuestBalance()).toBe(500);
    vi.restoreAllMocks();
    settleGuestMarket(listing.endAt!);
    expect(getGuestBalance()).toBe(560);
    expect(getGuestCollection()).toEqual([]);
  });

  it("refuse l'annulation après l'offre d'un rival et crédite une vente d'une heure une seule fois", () => {
    addGuestCollectionCards([{ userCardId: "copy", card: cards[0]! }]);
    const listing = listGuestCopy("copy", cards[0]!, "auction", 60, 60, now);
    settleGuestMarket(now + 30_000);
    expect(() => cancelGuestListing(listing.id, now + 30_001)).toThrow();
    expect(getGuestBalance()).toBe(500);
    settleGuestMarket(listing.endAt!);
    settleGuestMarket(listing.endAt!);
    expect(getGuestBalance()).toBe(560);
    expect(getGuestCollection()).toEqual([]);
  });

  it("preserves active listings when the guest balance or collection changes elsewhere", () => {
    addGuestCollectionCards([{ userCardId: "copy", card: cards[0]! }]);
    const listing = listGuestCopy("copy", cards[0]!, "auction", 60, 60, now);
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

  it("updates old listing rarities without changing prices or awakened copies", () => {
    const nami: Card = { ...cards[0]!, id: "nami", name: "Nami" };
    addGuestCollectionCards([
      { userCardId: "base", card: nami },
      { userCardId: "awake", card: nami, transcended: true },
    ]);
    const base = listGuestCopy("base", nami, "fixed", 80, 2, now);
    const awake = listGuestCopy("awake", nami, "fixed", 90, 2, now);
    const listings = getGuestMarket().listings;
    expect(listings.find((item) => item.id === base.id)).toMatchObject({ rarity: "mythique", price: 80 });
    expect(listings.find((item) => item.id === awake.id)).toMatchObject({ rarity: "transcendance", price: 90 });
    cancelGuestListing(awake.id, now + 1);
    expect(getGuestCollection()[0]).toMatchObject({ id: "awake", transcended: true });
  });

  it("reclassifies old Demon Slayer listings and restores their copies as Mythique", () => {
    const hero = DEMON_SLAYER_MYTHIC_CARDS[0]!;
    const copy = { id: "legacy", card_id: hero.id, obtained_at: new Date(now).toISOString(), transcended: false, awaken_attempted: false, customTranscendance: true };
    const state = JSON.parse(localStorage.getItem(GUEST_COLLECTION_KEY)!);
    state.market.listings.push({
      id: "legacy-listing", seller: "guest", sellerName: "Toi", kind: "fixed",
      cardId: hero.id, cardName: hero.name, rarity: "transcendance", copy,
      price: 600, endAt: null, npcAt: now + 30000, bid: null, bidder: null,
    });
    state.market.listings.push({
      id: "legacy-npc", seller: "npc", sellerName: "Marchand fictif", kind: "fixed",
      cardId: hero.id, cardName: hero.name, rarity: "transcendance", copy: null,
      price: 5000, endAt: null, npcAt: null, bid: null, bidder: null,
    });
    localStorage.setItem(GUEST_COLLECTION_KEY, JSON.stringify(state));
    expect(getGuestMarket().listings.find((item) => item.id === "legacy-listing")).toMatchObject({
      rarity: "mythique", price: 600, copy: { id: "legacy", customTranscendance: false },
    });
    expect(getGuestMarket().listings.find((item) => item.id === "legacy-npc")).toMatchObject({ rarity: "mythique", price: 5000 });
    cancelGuestListing("legacy-listing", now + 1);
    expect(getGuestCollection()).toContainEqual({ ...copy, customTranscendance: false });
  });

  it("applies custom overrides to existing listings but not awakened copies", () => {
    const card: Card = { ...cards[0]!, id: "test", name: "Test" };
    addGuestCollectionCards([
      { userCardId: "base", card },
      { userCardId: "awake", card, transcended: true },
    ]);
    const base = listGuestCopy("base", card, "fixed", 80, 2, now);
    const awake = listGuestCopy("awake", card, "fixed", 90, 2, now);
    CUSTOM_RARITY["test"] = "mythique";
    try {
      const listings = getGuestMarket().listings;
      expect(listings.find((item) => item.id === base.id)?.rarity).toBe("mythique");
      expect(listings.find((item) => item.id === awake.id)?.rarity).toBe("transcendance");
    } finally {
      delete CUSTOM_RARITY["test"];
    }
  });

  it("applies global id overrides to existing listings without changing prices or awakened copies", () => {
    const card: Card = { ...cards[0]!, id: "test-id", name: "Test" };
    addGuestCollectionCards([{ userCardId: "base", card }, { userCardId: "awake", card, transcended: true }]);
    const base = listGuestCopy("base", card, "fixed", 80, 2, now);
    const awake = listGuestCopy("awake", card, "fixed", 90, 2, now);
    applyRemoteRarityOverrides({ "test-id": "mythique" });
    expect(getGuestMarket().listings.find((item) => item.id === base.id)).toMatchObject({ rarity: "mythique", price: 80 });
    expect(getGuestMarket().listings.find((item) => item.id === awake.id)?.rarity).toBe("transcendance");
    applyRemoteRarityOverrides({});
  });

  it("applies fixed id rarities to existing market listings without changing their price", () => {
    const card: Card = { ...cards[0]!, id: "hsr-20", name: "Test" };
    addGuestCollectionCards([{ userCardId: "base", card }]);
    const listing = listGuestCopy("base", card, "fixed", 80, 2, now);
    expect(getGuestMarket().listings.find((item) => item.id === listing.id)).toMatchObject({ rarity: "legendaire", price: 80 });
  });
});
