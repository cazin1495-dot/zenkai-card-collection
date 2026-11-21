import { z } from "zod";
import { characterRarity, getCardMarketPrice, rarityRank, type Card } from "./cards";
import { getGuestState, updateGuestState, type GuestOwnedRow } from "./guest-collection";

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
        (item.seller === "guest" && item.bidder === "guest"),
    )
  )
    throw new Error("Données du marché local incohérentes.");
  return {
    listings: parsed.data.listings.map((item) => ({
      ...item,
      rarity: item.copy?.transcended || item.copy?.customTranscendance
        ? "transcendance"
        : characterRarity(item.cardName, item.rarity, item.cardId),
    })),
  };
}

function checkedPrice(price: number) {
  if (!Number.isSafeInteger(price) || price <= 0)
    throw new Error("Le prix doit être un nombre entier positif.");
}

function npcOffers(cards: Card[], now: number): MarketListing[] {
  const byRarity = new Map<string, Card>();
  for (const card of cards) {
    const rarity = card.transcendance_series_number ? "transcendance" : card.rarity;
    if (!byRarity.has(rarity)) byRarity.set(rarity, card);
  }
  return [...byRarity.values()].map((card, index) => {
    const effectiveRarity = card.transcendance_series_number ? "transcendance" : card.rarity;
    const auction = index % 2 === 1;
    return {
      id: crypto.randomUUID(),
      seller: "npc",
      sellerName: index % 2 ? "Rival fictif" : "Marchand fictif",
      kind: auction ? "auction" : "fixed",
      cardId: card.id,
      cardName: card.name,
      rarity: effectiveRarity,
      copy: null,
      price: getCardMarketPrice({ ...card, rarity: effectiveRarity }),
      endAt: auction ? now + 15 * 60_000 : null,
      npcAt: null,
      bid: null,
      bidder: null,
    };
  });
}

export function getGuestMarket() {
  const state = getGuestState();
  return {
    listings: state.market === undefined ? [] : readMarket(state.market).listings,
    zen: state.zen,
  };
}

export function initializeGuestMarket(cards: Card[], now = Date.now()) {
  updateGuestState((state) => {
    if (state.market !== undefined) return { state, result: undefined };
    if (!cards.length) throw new Error("Catalogue indisponible pour les offres fictives.");
    return { state: { ...state, market: { listings: npcOffers(cards, now) } }, result: undefined };
  });
}

export function restockGuestMarket(cards: Card[], now = Date.now()) {
  updateGuestState((state) => {
    const market = readMarket(state.market);
    if (!cards.length) throw new Error("Catalogue indisponible pour les offres fictives.");
    if (market.listings.some((item) => item.seller === "npc"))
      throw new Error("Des offres fictives sont encore disponibles.");
    return {
      state: { ...state, market: { listings: [...market.listings, ...npcOffers(cards, now)] } },
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
) {
  checkedPrice(price);
  if (kind === "auction" && ![2, 5, 15].includes(duration))
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
      rarity: copy.transcended || copy.customTranscendance ? "transcendance" : card.rarity,
      copy,
      price,
      endAt: kind === "auction" ? now + duration * 60_000 : null,
      npcAt: now + 30_000,
      bid: null,
      bidder: null,
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
      state: {
        ...state,
        zen: state.zen - item.price,
        rows: [...state.rows, makeCopy(item, now)],
        market: { listings: market.listings.filter((listing) => listing.id !== id) },
      },
      result: item,
    };
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
      (item.kind === "fixed" && item.npcAt !== null && now >= item.npcAt)
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
    const minimum = item.bid === null ? item.price : item.bid + 10;
    if (!Number.isSafeInteger(minimum) || amount < minimum)
      throw new Error(`L'offre minimale est de ${minimum} Zen.`);
    const reserved = item.bidder === "guest" ? (item.bid ?? 0) : 0;
    if (state.zen + reserved < amount) throw new Error("Solde de Zen insuffisant.");
    const outbid =
      rarityRank(item.rarity) <= rarityRank("rare") &&
      Math.random() < 0.3 &&
      Number.isSafeInteger(amount + 10);
    item.bid = outbid ? amount + 10 : amount;
    item.bidder = outbid ? "npc" : "guest";
    return {
      state: { ...state, zen: state.zen + reserved - (outbid ? 0 : amount), market },
      result: { outbid, amount: item.bid },
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
        if (item.bid === null) {
          item.bid = item.price;
          item.bidder = "npc";
        }
        item.npcAt = null;
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
