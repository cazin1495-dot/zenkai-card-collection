import { z } from "zod";
import { characterRarity, getCardMarketPrice, isLegacyDemonSlayerTranscendanceCardId, isTranscendanceCatalogCard, rarityRank, type Card, type Rarity } from "./cards";
import { getGuestState, syncGuestAuctionStorage, updateGuestState, type GuestOwnedRow, type GuestState } from "./guest-collection";
import { withUnlockedSecrets } from "./quests";

const rowSchema = z.object({
  id: z.string(),
  card_id: z.string(),
  obtained_at: z.string(),
  transcended: z.boolean(),
  awaken_attempted: z.boolean(),
  customTranscendance: z.boolean().optional(),
});
const listingSchema = z.object({
  id: z.string(),
  seller: z.enum(["guest", "npc"]),
  sellerName: z.string(),
  kind: z.enum(["fixed", "auction"]),
  cardId: z.string(),
  cardName: z.string(),
  rarity: z.enum([
    "commune",
    "non_commune",
    "rare",
    "epique",
    "legendaire",
    "mythique",
    "transcendance",
  ]),
  copy: rowSchema.nullable(),
  price: z.number().int().positive().safe(),
  endAt: z.number().finite().nullable(),
  npcAt: z.number().finite().nullable(),
  bid: z.number().int().positive().safe().nullable(),
  bidder: z.enum(["guest", "npc"]).nullable(),
  bidCount: z.number().int().nonnegative().safe().default(0),
  bidderName: z.string().nullable().default(null),
  rivalAt: z.number().finite().nullable().default(null),
  buyoutPrice: z.number().int().positive().safe().nullable().default(null),
});
const marketSchema = z.object({ listings: z.array(listingSchema) });
export type MarketListing = z.infer<typeof listingSchema>;
type Market = z.infer<typeof marketSchema>;

function readMarket(raw: unknown): Market {
  const parsed = marketSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Données du marché local invalides.");
  const ids = new Set(parsed.data.listings.map((item) => item.id));
  if (
    ids.size !== parsed.data.listings.length ||
    parsed.data.listings.some(
      (item) =>
        (item.seller === "guest") !== (item.copy !== null) ||
        (item.copy !== null && item.copy.card_id !== item.cardId) ||
        (item.kind === "auction") !== (item.endAt !== null) ||
        (item.bid === null) !== (item.bidder === null) ||
        (item.kind === "fixed" && item.bid !== null) ||
        (item.buyoutPrice !== null && (item.kind !== "auction" ||
          item.buyoutPrice <= item.price || (item.bid !== null && item.bid >= item.buyoutPrice))) ||
        (item.seller === "guest" && item.bidder === "guest"),
    )
  )
    throw new Error("Données du marché local incohérentes.");
  return {
    listings: parsed.data.listings.map((item) => {
      const reclassified = isLegacyDemonSlayerTranscendanceCardId(item.cardId);
      const copy = reclassified && item.copy?.customTranscendance
        ? { ...item.copy, customTranscendance: false }
        : item.copy;
      const rarity = reclassified && item.rarity === "transcendance" && !copy?.transcended
        ? "mythique"
        : item.rarity;
      return {
        ...item,
        copy,
        bidCount: Math.max(item.bidCount, item.bid === null ? 0 : 1),
        rarity: copy?.transcended || copy?.customTranscendance
          ? "transcendance"
          : characterRarity(item.cardName, rarity, item.cardId),
      };
    }),
  };
}

export const AUCTION_PRICE_SUGGESTIONS: Record<Rarity, { start: number; buyout: number }> = {
  commune: { start: 50, buyout: 120 },
  non_commune: { start: 80, buyout: 200 },
  rare: { start: 120, buyout: 300 },
  epique: { start: 300, buyout: 750 },
  legendaire: { start: 700, buyout: 1600 },
  mythique: { start: 1500, buyout: 3500 },
  transcendance: { start: 4000, buyout: 9500 },
};

export const AUCTION_DURATIONS = [
  { minutes: 60, label: "1 heure" },
  { minutes: 360, label: "6 heures" },
  { minutes: 720, label: "12 heures" },
  { minutes: 1440, label: "24 heures" },
  { minutes: 2880, label: "48 heures" },
] as const;

export function auctionCountdown(endAt: number, now: number) {
  const remaining = Math.max(0, endAt - now);
  const hour = 60 * 60_000;
  const day = 24 * hour;
  if (remaining > day) {
    const hours = Math.floor(remaining / hour);
    return { label: `${Math.floor(hours / 24)}j ${hours % 24}h`, urgent: false };
  }
  if (remaining >= hour) {
    const minutes = Math.floor(remaining / 60_000);
    return { label: `${Math.floor(minutes / 60)}h ${minutes % 60}m`, urgent: false };
  }
  const seconds = Math.ceil(remaining / 1000);
  return {
    label: `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`,
    urgent: true,
  };
}

function checkedPrice(price: number) {
  if (!Number.isSafeInteger(price) || price <= 0)
    throw new Error("Le prix doit être un nombre entier positif.");
}

function npcOffers(cards: Card[]): MarketListing[] {
  const byRarity = new Map<string, Card>();
  for (const card of cards) {
    const rarity = card.transcendance_series_number ? "transcendance" : card.rarity;
    if (!byRarity.has(rarity)) byRarity.set(rarity, card);
  }
  return [...byRarity.values()].map((card, index) => {
    const effectiveRarity = card.transcendance_series_number ? "transcendance" : card.rarity;
    return {
      id: crypto.randomUUID(),
      seller: "npc",
      sellerName: index % 2 ? "Rival fictif" : "Marchand fictif",
      kind: "fixed",
      cardId: card.id,
      cardName: card.name,
      rarity: effectiveRarity,
      copy: null,
      price: getCardMarketPrice({ ...card, rarity: effectiveRarity }),
      endAt: null,
      npcAt: null,
      bid: null,
      bidder: null,
      bidCount: 0,
      bidderName: null,
      rivalAt: null,
      buyoutPrice: null,
    };
  });
}

const RIVALS = ["Kuro_TCG", "Aoi_Sora", "Ryu_Zenkai", "Mina_Collector"] as const;
function rivalName() {
  return RIVALS[Math.floor(Math.random() * RIVALS.length)]!;
}

export function minimumAuctionBid(item: Pick<MarketListing, "bid" | "price">) {
  if (item.bid === null) return item.price;
  const amount = item.bid + Math.max(50, Math.ceil(item.bid * 0.1));
  if (!Number.isSafeInteger(amount)) throw new Error("Montant d'enchère trop élevé.");
  return amount;
}

export function ensureGuestAuctions(cards: Card[], now = Date.now()) {
  const normal = cards.filter((card) =>
    !isTranscendanceCatalogCard(card) && ["epique", "legendaire", "mythique"].includes(card.rarity));
  const special = cards.filter(isTranscendanceCatalogCard);
  const available = normal.length ? normal : special;
  if (!available.length) return;
  const current = getGuestMarket().listings.filter((item) => item.seller === "npc" && item.kind === "auction").length;
  if (current >= 6) return;
  updateGuestState((state) => {
    const market = readMarket(state.market);
    const count = market.listings.filter((item) => item.seller === "npc" && item.kind === "auction").length;
    const remaining = [...available];
    const additions: MarketListing[] = [];
    for (let index = count; index < 6; index++) {
      const desired = ["epique", "legendaire", "mythique"][(index - count) % 3];
      let candidates = remaining.filter((card) => card.rarity === desired);
      if (!candidates.length) candidates = remaining.length ? remaining : available;
      const specialOffer = index === 5 && normal.length && special.length && Math.random() < 0.25;
      if (specialOffer) candidates = special;
      const card = candidates[Math.floor(Math.random() * candidates.length)]!;
      const selectedIndex = remaining.indexOf(card);
      if (selectedIndex !== -1) remaining.splice(selectedIndex, 1);
      const rarity = isTranscendanceCatalogCard(card) ? "transcendance" : card.rarity;
      const price = getCardMarketPrice({ ...card, rarity });
      const buyoutPrice = Math.max(AUCTION_PRICE_SUGGESTIONS[rarity].buyout, price + Math.max(50, Math.ceil(price * 0.1)));
      checkedPrice(buyoutPrice);
      additions.push({
        id: crypto.randomUUID(), seller: "npc", sellerName: rivalName(), kind: "auction",
        cardId: card.id, cardName: card.name, rarity, copy: null, price,
        endAt: now + (30 + Math.floor(Math.random() * (24 * 60 - 30 + 1))) * 60_000,
        npcAt: null, bid: price, bidder: "npc", bidCount: 1, bidderName: rivalName(), rivalAt: null, buyoutPrice,
      });
    }
    return { state: { ...state, market: { listings: [...market.listings, ...additions] } }, result: undefined };
  });
}

export function getGuestMarket() {
  const state = getGuestState();
  const listings = state.market === undefined ? [] : readMarket(state.market).listings;
  syncGuestAuctionStorage(state.market);
  return {
    listings,
    zen: state.zen,
  };
}

export function initializeGuestMarket(cards: Card[], now = Date.now()) {
  updateGuestState((state) => {
    if (state.market !== undefined) return { state, result: undefined };
    if (!cards.length) throw new Error("Catalogue indisponible pour les offres fictives.");
    return { state: { ...state, market: { listings: npcOffers(cards) } }, result: undefined };
  });
}

export function restockGuestMarket(cards: Card[], now = Date.now()) {
  updateGuestState((state) => {
    const market = readMarket(state.market);
    if (!cards.length) throw new Error("Catalogue indisponible pour les offres fictives.");
    if (market.listings.some((item) => item.seller === "npc" && item.kind === "fixed"))
      throw new Error("Des offres fictives sont encore disponibles.");
    return {
      state: { ...state, market: { listings: [...market.listings, ...npcOffers(cards)] } },
      result: undefined,
    };
  });
}

export function listGuestCopy(
  copyId: string,
  card: Card,
  kind: "fixed" | "auction",
  price: number,
  duration: number,
  now = Date.now(),
  buyoutPrice: number | null = null,
) {
  checkedPrice(price);
  if (buyoutPrice !== null) {
    checkedPrice(buyoutPrice);
    if (kind !== "auction" || buyoutPrice <= price)
      throw new Error("Le prix d'achat immédiat doit dépasser le prix de départ de l'enchère.");
  }
  if (kind === "auction" && !AUCTION_DURATIONS.some((option) => option.minutes === duration))
    throw new Error("Durée d'enchère invalide.");
  return updateGuestState((state) => {
    const market = readMarket(state.market);
    const copy = state.rows.find((row) => row.id === copyId && row.card_id === card.id);
    if (!copy) throw new Error("Cette copie n'est plus dans ta collection.");
    const listing: MarketListing = {
      id: crypto.randomUUID(),
      seller: "guest",
      sellerName: "Toi",
      kind,
      cardId: card.id,
      cardName: card.name,
      rarity: copy.transcended || copy.customTranscendance || isTranscendanceCatalogCard(card) ? "transcendance" : card.rarity,
      copy,
      price,
      endAt: kind === "auction" ? now + duration * 60_000 : null,
      npcAt: now + 30_000,
      bid: null,
      bidder: null,
      bidCount: 0,
      bidderName: null,
      rivalAt: null,
      buyoutPrice,
    };
    return {
      state: {
        ...state,
        rows: state.rows.filter((row) => row.id !== copyId),
        market: { listings: [...market.listings, listing] },
      },
      result: listing,
    };
  });
}

function makeCopy(item: MarketListing, now: number): GuestOwnedRow {
  return {
    id: `guest-${crypto.randomUUID()}`,
    card_id: item.cardId,
    obtained_at: new Date(now).toISOString(),
    transcended: false,
    awaken_attempted: false,
    customTranscendance: item.rarity === "transcendance",
  };
}

export function buyGuestListing(id: string, now = Date.now()) {
  return updateGuestState((state) => {
    const market = readMarket(state.market);
    const item = market.listings.find((listing) => listing.id === id);
    if (!item || item.kind !== "fixed" || item.seller !== "npc")
      throw new Error("Cette offre n'est plus disponible.");
    if (state.zen < item.price) throw new Error("Solde de Zen insuffisant.");
    return {
      state: withUnlockedSecrets({
        ...state,
        zen: state.zen - item.price,
        rows: [...state.rows, makeCopy(item, now)],
        market: { listings: market.listings.filter((listing) => listing.id !== id) },
      }, state.zen === item.price ? ["zero"] : []),
      result: item,
    };
  });
}

function purchaseAuction(state: GuestState, market: Market, item: MarketListing, now: number) {
  if (item.seller !== "npc" || item.kind !== "auction" || item.endAt === null ||
      now >= item.endAt || item.buyoutPrice === null)
    throw new Error("Cet achat immédiat n'est plus disponible.");
  const reserved = item.bidder === "guest" ? item.bid ?? 0 : 0;
  const payable = item.buyoutPrice - reserved;
  if (state.zen < payable) throw new Error("Solde de Zen insuffisant.");
  const zen = state.zen - payable;
  return withUnlockedSecrets({
    ...state,
    zen,
    rows: [...state.rows, makeCopy(item, now)],
    market: { listings: market.listings.filter((listing) => listing.id !== item.id) },
  }, zen === 0 ? ["zero"] : []);
}

export function buyoutGuestAuction(id: string, now = Date.now()) {
  return updateGuestState((state) => {
    const market = readMarket(state.market);
    const item = market.listings.find((listing) => listing.id === id);
    if (!item) throw new Error("Cet achat immédiat n'est plus disponible.");
    return { state: purchaseAuction(state, market, item, now), result: item };
  });
}

export function cancelGuestListing(id: string, now = Date.now()) {
  return updateGuestState((state) => {
    const market = readMarket(state.market);
    const item = market.listings.find((listing) => listing.id === id);
    if (
      !item ||
      item.seller !== "guest" ||
      !item.copy ||
      (item.endAt !== null && now >= item.endAt) ||
      (item.kind === "auction" && item.bid !== null) ||
      (item.npcAt !== null && now >= item.npcAt)
    ) {
      throw new Error("Cette annonce ne peut plus être annulée.");
    }
    if (state.rows.some((row) => row.id === item.copy?.id))
      throw new Error("Cette copie existe déjà dans la collection.");
    return {
      state: {
        ...state,
        rows: [...state.rows, item.copy],
        market: { listings: market.listings.filter((listing) => listing.id !== id) },
      },
      result: item,
    };
  });
}

export function bidOnGuestListing(id: string, amount: number, now = Date.now()) {
  checkedPrice(amount);
  return updateGuestState((state) => {
    const market = readMarket(state.market);
    const item = market.listings.find((listing) => listing.id === id);
    if (
      !item ||
      item.seller !== "npc" ||
      item.kind !== "auction" ||
      item.endAt === null ||
      now >= item.endAt
    )
      throw new Error("Cette enchère est terminée ou indisponible.");
    if (item.buyoutPrice !== null && amount >= item.buyoutPrice) {
      return {
        state: purchaseAuction(state, market, item, now),
        result: { outbid: false, amount: item.buyoutPrice, purchased: true },
      };
    }
    const minimum = minimumAuctionBid(item);
    if (amount < minimum)
      throw new Error(`L'offre minimale est de ${minimum} Zen.`);
    if (!Number.isSafeInteger(item.bidCount + 1)) throw new Error("Nombre d'offres invalide.");
    const reserved = item.bidder === "guest" ? (item.bid ?? 0) : 0;
    if (state.zen + reserved < amount) throw new Error("Solde de Zen insuffisant.");
    item.bid = amount;
    item.bidder = "guest";
    item.bidderName = "Toi";
    item.bidCount++;
    item.rivalAt = rarityRank(item.rarity) <= rarityRank("rare") &&
      Number.isSafeInteger(amount + Math.max(50, Math.ceil(amount * 0.1))) && Math.random() < 0.3
      ? Math.max(now + 1000, item.endAt - 10_000) : null;
    return {
      state: { ...state, zen: state.zen + reserved - amount, market },
      result: { outbid: false, amount: item.bid, purchased: false },
    };
  });
}

export function settleGuestMarket(now = Date.now()) {
  return updateGuestState((state) => {
    const market = readMarket(state.market);
    const notices: string[] = [];
    const remaining: MarketListing[] = [];
    let zen = state.zen;
    const rows = [...state.rows];
    for (const item of market.listings) {
      if (item.seller === "guest" && item.npcAt !== null && now >= item.npcAt) {
        if (item.kind === "fixed") {
          zen += item.price;
          notices.push(`${item.cardName} achetée par un marchand fictif · +${item.price} Zen`);
          continue;
        }
        if (item.buyoutPrice !== null && item.buyoutPrice <= AUCTION_PRICE_SUGGESTIONS[item.rarity].buyout &&
            Math.random() < 0.5) {
          zen += item.buyoutPrice;
          notices.push(`Vente immédiate réalisée : ${item.cardName} vendue pour ${item.buyoutPrice} Zen !`);
          continue;
        }
        if (item.bid === null) {
          item.bid = item.price;
          item.bidder = "npc";
          item.bidderName = rivalName();
          item.bidCount++;
        }
        item.npcAt = null;
      }
      if (item.seller === "npc" && item.bidder === "guest" && item.rivalAt !== null &&
          now >= item.rivalAt && item.rivalAt < item.endAt!) {
        if (!Number.isSafeInteger(item.bidCount + 1)) throw new Error("Nombre d'offres invalide.");
        zen += item.bid!;
        const nextBid = minimumAuctionBid(item);
        if (item.buyoutPrice !== null && nextBid >= item.buyoutPrice) {
          notices.push(`${rivalName()} a acheté ${item.cardName} immédiatement ! Ton offre a été remboursée.`);
          continue;
        }
        item.bid = nextBid;
        item.bidder = "npc";
        item.bidderName = rivalName();
        item.bidCount++;
        item.rivalAt = null;
        notices.push(`${item.bidderName} a surenchéri sur ${item.cardName} !`);
      }
      if (item.kind === "auction" && item.endAt !== null && now >= item.endAt) {
        if (item.seller === "guest" && item.copy) {
          if (item.bidder === "npc" && item.bid !== null) {
            zen += item.bid;
            notices.push(`${item.cardName} vendue aux enchères fictives · +${item.bid} Zen`);
          } else {
            if (rows.some((row) => row.id === item.copy?.id))
              throw new Error("Cette copie existe déjà dans la collection.");
            rows.push(item.copy);
            notices.push(`${item.cardName} rendue : aucune enchère.`);
          }
        } else if (item.bidder === "guest") {
          rows.push(makeCopy(item, now));
          notices.push(`Enchère remportée : ${item.cardName} ajoutée à ta collection.`);
        }
        continue;
      }
      remaining.push(item);
    }
    if (!Number.isSafeInteger(zen)) throw new Error("Solde invité invalide.");
    return { state: { ...state, zen, rows, market: { listings: remaining } }, result: notices };
  });
}
