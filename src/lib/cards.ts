import riku from "@/assets/characters/riku.jpg";
import mei from "@/assets/characters/mei.jpg";
import taro from "@/assets/characters/taro.jpg";
import hana from "@/assets/characters/hana.jpg";
import kaito from "@/assets/characters/kaito.jpg";
import yuki from "@/assets/characters/yuki.jpg";
import sora from "@/assets/characters/sora.jpg";
import akira from "@/assets/characters/akira.jpg";
import lyra from "@/assets/characters/lyra.jpg";
import ryujin from "@/assets/characters/ryujin.jpg";
import ultraInstinct from "@/assets/goku-ultra-instinct.png.asset.json";

/** Rarities used by draw, display, and economy rules. */
export type BaseRarity = "commune" | "non_commune" | "rare" | "epique" | "legendaire" | "mythique" | "transcendance";
/** Standard catalogue cards never store Transcendance; that is a copy/custom-card state. */
export type CatalogRarity = Exclude<BaseRarity, "transcendance">;
export type Rarity = BaseRarity;

export const CATALOG_RARITIES = ["commune", "non_commune", "rare", "epique", "legendaire", "mythique"] as const satisfies readonly CatalogRarity[];
export const USER_RARITY_OVERRIDES: Record<string, CatalogRarity> = {
  "al-64771": "mythique",
  "al-162969": "mythique",
  "al-162213": "mythique",
  "al-245": "mythique",
  "al-907": "mythique",
  "al-906": "mythique",
  "al-1080": "mythique",
  "al-7": "mythique",
  "al-85": "mythique",
  "al-13": "mythique",
  "al-2423": "mythique",
  "al-88412": "mythique",
  "al-87277": "mythique",
  "al-309": "mythique",
  "al-167444": "legendaire",
  "al-169395": "legendaire",
  "al-169401": "mythique",
  "al-914": "legendaire",
  "al-67321": "legendaire",
  "al-67333": "legendaire",
  "al-67323": "legendaire",
  "al-36820": "mythique",
  "al-845": "legendaire",
  "al-42038": "mythique",
  "al-21332": "mythique",
  "al-18770": "mythique",
  "al-145": "legendaire",
  "al-2367": "legendaire",
  "al-88411": "legendaire",
  "al-137974": "legendaire",
  "al-158154": "legendaire",
  "hsr-20": "legendaire",
  "al-162214": "legendaire",
  "al-169394": "epique",
  "al-169397": "legendaire",
  "al-186875": "mythique",
  "al-187546": "epique",
  "al-187524": "epique",
  "al-22253": "legendaire",
  "al-53563": "legendaire",
  "al-22254": "legendaire",
  "al-45975": "legendaire",
  "al-307": "legendaire",
  "al-2767": "mythique",
  "al-2455": "mythique",
  "al-728": "legendaire",
  "al-124077": "legendaire",
  "al-2064": "legendaire",
  "al-120536": "legendaire",
  "al-187523": "epique",
  "al-2093": "epique",
  "al-169403": "legendaire",
  "al-191409": "legendaire",
  "al-169400": "epique",
  "al-196502": "legendaire",
  "al-42804": "legendaire",
};
export const USER_RARITY_OVERRIDES_KEY = "zenkai_admin_rarity_overrides";
export const USER_RARITY_OVERRIDES_UPDATED = "zenkai:rarity-overrides-updated";

export function isCatalogRarity(value: unknown): value is CatalogRarity {
  return CATALOG_RARITIES.some((rarity) => rarity === value);
}

export function parseUserRarityOverrides(raw: string | null): Record<string, CatalogRarity> {
  if (raw === null) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Configuration des raretés locales invalide.");
  }
  const entries: [string, CatalogRarity][] = [];
  for (const [key, rarity] of Object.entries(parsed)) {
    if (!key.trim() || !isCatalogRarity(rarity)) throw new Error("Configuration des raretés locales invalide.");
    entries.push([key, rarity]);
  }
  return Object.fromEntries(entries);
}

export function getUserRarityOverridesSnapshot(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(USER_RARITY_OVERRIDES_KEY);
}

export function getUserRarityOverrides(): Record<string, CatalogRarity> {
  return parseUserRarityOverrides(getUserRarityOverridesSnapshot());
}

export function setUserRarityOverride(cardIdOrName: string, rarity: CatalogRarity) {
  const key = cardIdOrName.trim();
  if (!key || !isCatalogRarity(rarity)) throw new Error("Rareté locale invalide.");
  if (typeof window === "undefined") throw new Error("Stockage local indisponible.");
  const next = { ...getUserRarityOverrides(), [key]: rarity };
  window.localStorage.setItem(USER_RARITY_OVERRIDES_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(USER_RARITY_OVERRIDES_UPDATED));
}

export function subscribeUserRarityOverrides(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === USER_RARITY_OVERRIDES_KEY || event.key === null) onChange();
  };
  window.addEventListener(USER_RARITY_OVERRIDES_UPDATED, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(USER_RARITY_OVERRIDES_UPDATED, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export type Genre = "shonen" | "seinen" | "shojo" | "sport";
export type CardRole = "protagoniste" | "antagoniste";

export type Card = {
  id: string;
  name: string;
  title: string;
  rarity: CatalogRarity;
  serverRarity?: CatalogRarity;
  description: string;
  sort_order: number;
  transcendance_series_number?: string;
  category?: Genre | null;
  series?: string | null;
  role?: CardRole | null;
  image_url?: string | null;
  quote?: string | null;
  voiceAudioUrl?: string | null;
  subtitleText?: string | null;
  popularity?: number;
};

/** One owned copy coming out of a booster. */
export type PulledCard = { userCardId: string; card: Card; transcended?: boolean; customTranscendance?: boolean; isNew?: boolean };

export function isTranscendanceCatalogCard(card: { id: string; name?: string; rarity: string }): boolean {
  const name = card.name?.trim().toLowerCase();
  if (name === "goku black" && !card.id.toUpperCase().endsWith("-TR")) return false;
  return card.rarity.toLowerCase() === "transcendance"
    || card.id.toUpperCase().endsWith("-TR")
    || name === "son goku (ultra instinct)"
    || name === "goku ultra instinct";
}

export const CHARACTER_RARITY_OVERRIDES: Readonly<Record<string, CatalogRarity>> = {
  hancock: "mythique", "boa hancock": "mythique", "hancock boa": "mythique",
  whitebeard: "mythique", "edward newgate": "mythique", "newgate edward": "mythique", "barbe blanche": "mythique",
  pain: "mythique", nagato: "mythique",
  shikamaru: "mythique", "shikamaru nara": "mythique",
  yamato: "mythique", nami: "mythique",
  hinata: "mythique", "hinata hyuga": "mythique", "hinata hyuuga": "mythique",
  trunks: "mythique", "mirai trunks": "mythique", "future trunks": "mythique",
  hashirama: "mythique", "hashirama senju": "mythique",
  "mei mei": "mythique",
  tobirama: "mythique", "tobirama senju": "mythique",
  kawaki: "mythique", kenjaku: "mythique",
  minato: "mythique", "minato namikaze": "mythique",
  grimmjow: "legendaire", "grimmjow jaegerjaquez": "legendaire",
  zaraki: "legendaire", "kenpachi zaraki": "legendaire",
  orihime: "legendaire", "orihime inoue": "legendaire",
  hitsugaya: "legendaire", "toshiro hitsugaya": "legendaire", "toushirou hitsugaya": "legendaire",
  byakuya: "legendaire", "byakuya kuchiki": "legendaire",
  "rock lee": "legendaire", lee: "legendaire", tobi: "legendaire",
  choso: "legendaire", chousou: "legendaire", mahito: "legendaire",
  doflamingo: "legendaire", "donquixote doflamingo": "legendaire", "doflamingo donquixote": "legendaire",
  franky: "legendaire", jinbe: "legendaire", jinbei: "legendaire",
  renji: "legendaire", "renji abarai": "legendaire",
  beerus: "legendaire", neji: "legendaire", "neji hyuga": "legendaire", "neji hyuuga": "legendaire",
  kurama: "legendaire", kyubi: "legendaire", kyuubi: "legendaire",
  sabo: "legendaire", bardock: "legendaire", whis: "legendaire",
  sarada: "legendaire", "sarada uchiha": "legendaire", mitsuki: "legendaire",
  "killer bee": "legendaire", "killer b": "legendaire",
};

export const CUSTOM_RARITY: Record<string, "mythique" | "legendaire"> = {
  // === MYTHIQUES (14) ===
  "hancock": "mythique",
  "boa hancock": "mythique",
  "whitebeard": "mythique",
  "edward newgate": "mythique",
  "barbe blanche": "mythique",
  "pain": "mythique",
  "nagato": "mythique",
  "shikamaru": "mythique",
  "shikamaru nara": "mythique",
  "yamato": "mythique",
  "nami": "mythique",
  "hinata": "mythique",
  "hinata hyuga": "mythique",
  "trunks": "mythique",
  "mirai trunks": "mythique",
  "future trunks": "mythique",
  "hashirama": "mythique",
  "hashirama senju": "mythique",
  "mei mei": "mythique",
  "tobirama": "mythique",
  "tobirama senju": "mythique",
  "kawaki": "mythique",
  "kenjaku": "mythique",
  "minato": "mythique",
  "minato namikaze": "mythique",

  // === OR / LÉGENDAIRES (22) ===
  "grimmjow": "legendaire",
  "grimmjow jaegerjaquez": "legendaire",
  "zaraki": "legendaire",
  "kenpachi zaraki": "legendaire",
  "orihime": "legendaire",
  "orihime inoue": "legendaire",
  "hitsugaya": "legendaire",
  "toshiro hitsugaya": "legendaire",
  "byakuya": "legendaire",
  "byakuya kuchiki": "legendaire",
  "rock lee": "legendaire",
  "lee": "legendaire",
  "tobi": "legendaire",
  "choso": "legendaire",
  "chousou": "legendaire",
  "mahito": "legendaire",
  "doflamingo": "legendaire",
  "donquixote doflamingo": "legendaire",
  "franky": "legendaire",
  "jinbe": "legendaire",
  "jinbei": "legendaire",
  "renji": "legendaire",
  "renji abarai": "legendaire",
  "beerus": "legendaire",
  "neji": "legendaire",
  "neji hyuga": "legendaire",
  "kurama": "legendaire",
  "kyubi": "legendaire",
  "sabo": "legendaire",
  "bardock": "legendaire",
  "whis": "legendaire",
  "sarada": "legendaire",
  "sarada uchiha": "legendaire",
  "mitsuki": "legendaire",
  "killer bee": "legendaire",
  "killer b": "legendaire",
};


export function characterRarity(
  name: string,
  rarity: BaseRarity,
  cardId?: string,
  overrides = getUserRarityOverrides(),
): BaseRarity {
  if (rarity === "transcendance") return rarity;
  const normalizedName = name.trim().toLowerCase();
  const override = (cardId && Object.hasOwn(overrides, cardId) ? overrides[cardId] : undefined)
    ?? (Object.hasOwn(overrides, normalizedName) ? overrides[normalizedName] : undefined)
    ?? Object.entries(overrides).find(([key]) => key.trim().toLowerCase() === normalizedName)?.[1];
  if (override) return override;
  const fixedOverride = cardId && Object.hasOwn(USER_RARITY_OVERRIDES, cardId) ? USER_RARITY_OVERRIDES[cardId] : undefined;
  if (fixedOverride) return fixedOverride;
  const lowercaseName = name.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (Object.hasOwn(CUSTOM_RARITY, lowercaseName) && CUSTOM_RARITY[lowercaseName]) return CUSTOM_RARITY[lowercaseName];
  const words = lowercaseName.split(/[\s\-·()]+/);
  for (const [key, customR] of Object.entries(CUSTOM_RARITY)) {
    const cleanKey = key.normalize("NFD").replace(/\p{M}/gu, "");
    if (cleanKey.includes(" ") ? lowercaseName.includes(cleanKey) : words.includes(cleanKey)) {
      return customR;
    }
  }
  const key = lowercaseName.replace(/\s+/g, " ");
  return Object.hasOwn(CHARACTER_RARITY_OVERRIDES, key) ? CHARACTER_RARITY_OVERRIDES[key] ?? rarity : rarity;
}


/** Applies local catalog overrides for known cards without creating duplicate records. */
export function normalizeCatalogCard(card: Card, overrides = getUserRarityOverrides()): Card {
  if (isTranscendanceCatalogCard(card) || card.transcendance_series_number) return card;
  const baseRarity = card.serverRarity ?? card.rarity;
  if (card.name.trim().toLowerCase() === "goku black") {
    const rarity = characterRarity(card.name, "mythique", card.id, overrides);
    return { ...card, serverRarity: baseRarity, rarity: rarity === "transcendance" ? "mythique" : rarity, category: "shonen", role: "antagoniste" };
  }
  const rarity = characterRarity(card.name, baseRarity, card.id, overrides);
  return rarity === baseRarity || rarity === "transcendance"
    ? { ...card, rarity: baseRarity }
    : { ...card, serverRarity: baseRarity, rarity };
}

/** Booster rules — mirror public.open_boosters(). */
export const CARDS_PER_BOOSTER = 5;
export const STOCK_CAP = 15;
export const STOCK_REGEN_MINUTES = 10;
export const STOCK_REGEN_MS = STOCK_REGEN_MINUTES * 60 * 1000;
export const OPEN_COUNTS = [1, 5, 10] as const;
export const TRANSCEND_CHANCE_PERCENT = 0.05;
export const TRANSCEND_CHANCE_LABEL = `${TRANSCEND_CHANCE_PERCENT} %`;
export const GOKU_CARD_ID = "al-246";

export function cardIdentity(card: Card, transcended = false) {
  if (transcended && card.id === GOKU_CARD_ID) {
    return { name: "Son Goku (Ultra Instinct)", title: "Ultra Instinct · Guerrier Saiyan" };
  }
  return { name: card.name, title: card.title };
}

/** Drop chance per card, in percent (mirrors the SQL thresholds). */
export const DROP_RATES: Record<BaseRarity, number> = {
  commune: 54,
  non_commune: 26.5,
  rare: 14,
  epique: 4,
  legendaire: 1.2,
  mythique: 0.25,
  transcendance: 0.05,
};

export const ZENKAI_DROP_RATES: Record<BaseRarity, number> = {
  commune: 10, non_commune: 25, rare: 35, epique: 19,
  legendaire: 8, mythique: 2.5, transcendance: 0.5,
};
export const ZENKAI_BOOSTER_COST = 500;

const CARD_BASE_MARKET_PRICES: Record<BaseRarity, number> = {
  commune: 10, non_commune: 25, rare: 60, epique: 150,
  legendaire: 400, mythique: 1200, transcendance: 5000,
};

export function getCardPopularityFactor(card: Pick<Card, "popularity">): number {
  return 1 + Math.min(1, Math.max(0, (card.popularity ?? 0) / 80000));
}

export function getCardMarketPrice(card: { rarity: BaseRarity; popularity?: number }): number {
  return Math.round((CARD_BASE_MARKET_PRICES[card.rarity] * getCardPopularityFactor(card)) / 5) * 5;
}

export function getCardRecycleValue(card: { rarity: BaseRarity; popularity?: number }): number {
  return card.rarity === "transcendance" ? 0 : Math.max(2, Math.round(getCardMarketPrice(card) * 0.4));
}

export const PITY_LIMIT = 200;

export function rarityFromRoll(roll: number): BaseRarity {
  if (roll < 54) return "commune";
  if (roll < 80.5) return "non_commune";
  if (roll < 94.5) return "rare";
  if (roll < 98.5) return "epique";
  if (roll < 99.7) return "legendaire";
  if (roll < 99.95) return "mythique";
  return "transcendance";
}

export function effectiveDropRate(rarity: BaseRarity, pack?: PackId) {
  return (pack === "zenkai" ? ZENKAI_DROP_RATES : DROP_RATES)[rarity];
}

/** Legacy fictional test art, kept for cards without an AniList portrait. */
export const CARD_ART: Record<string, string> = {
  riku, mei, taro, hana, kaito, yuki, sora, akira, lyra, ryujin,
};

export function cardArt(card: Pick<Card, "id" | "image_url">, transcended = false) {
  if (transcended && card.id === GOKU_CARD_ID) return ultraInstinct.url;
  return card.image_url || CARD_ART[card.id] || "";
}

export const RARITY_ORDER: Rarity[] = ["transcendance", "mythique", "legendaire", "epique", "rare", "non_commune", "commune"];

export function rarityRank(r: Rarity) {
  return RARITY_ORDER.indexOf(r);
}

export const RARITY: Record<Rarity, { label: string; text: string; border: string; glow: string; bg: string }> = {
  commune: { label: "Commune", text: "text-rarity-commune", border: "border-rarity-commune", glow: "glow-commune", bg: "bg-rarity-commune" },
  non_commune: { label: "Peu Commune", text: "text-rarity-non-commune", border: "border-rarity-non-commune", glow: "glow-non-commune", bg: "bg-rarity-non-commune" },
  rare: { label: "Rare", text: "text-rarity-rare", border: "border-rarity-rare", glow: "glow-rare", bg: "bg-rarity-rare" },
  epique: { label: "Épique", text: "text-rarity-epique", border: "border-rarity-epique", glow: "glow-epique", bg: "bg-rarity-epique" },
  legendaire: { label: "Légendaire", text: "text-rarity-legendaire", border: "border-rarity-legendaire", glow: "glow-legendaire", bg: "bg-rarity-legendaire" },
  mythique: { label: "Mythique", text: "text-rarity-mythique", border: "border-rarity-mythique", glow: "glow-mythique", bg: "bg-rarity-mythique" },
  transcendance: { label: "Transcendance", text: "text-gradient-transcend", border: "border-rarity-transcendance", glow: "glow-transcendance", bg: "bg-rarity-transcendance" },
};

export type PackId = "shonen" | "seinen" | "shojo" | "sport" | "antagoniste" | "protagoniste" | "zenkai";

export const PACK_ARTWORK = "/image_c1811ac7.jpg";
export const PACK_ARTWORK_BY_PACK: Record<PackId, string> = {
  shonen: PACK_ARTWORK, seinen: "/pack%20sienen%201.jpg", shojo: PACK_ARTWORK,
  sport: "/pack-sport-2.png", antagoniste: "/pack%20antagoniste.png",
  protagoniste: PACK_ARTWORK, zenkai: PACK_ARTWORK,
};
export const CARD_BACK_BY_PACK: Record<PackId, string> = {
  shonen: "/image_39f4fe98.jpg", seinen: "/card-back-seinen.png",
  shojo: "/image_39f4fe98.jpg", sport: "/carte%20sport.jpg",
  antagoniste: "/pack%20antagoniste.png", protagoniste: "/image_39f4fe98.jpg",
  zenkai: "/image_39f4fe98.jpg",
};

export const PACKS: { id: PackId; label: string; hint: string; accent: string }[] = [
  { id: "shonen", label: "Shonen Mix", hint: "All-Star · Toutes les cartes de toutes les catégories réunies", accent: "var(--pack-shonen)" },
  { id: "seinen", label: "Seinen", hint: "Berserk, Vinland Saga, Tokyo Ghoul, Monster", accent: "var(--pack-seinen)" },
  { id: "shojo", label: "Shojo", hint: "Fruits Basket, Nana, Sailor Moon, Sakura", accent: "var(--pack-shojo)" },
  { id: "sport", label: "Sport", hint: "Blue Lock, Haikyuu!!, Kuroko, Ippo", accent: "var(--pack-sport)" },
  { id: "antagoniste", label: "Antagoniste", hint: "Les méchants de toutes les sagas", accent: "var(--pack-antagoniste)" },
  { id: "protagoniste", label: "Protagoniste", hint: "Les héros principaux", accent: "var(--pack-protagoniste)" },
  { id: "zenkai", label: "Booster Zenkai", hint: "Tout le catalogue avec des taux boostés", accent: "#c084fc" },
];

/** Does a card belong to a booster pack / collection filter? */
export function inPack(card: Card, pack: PackId) {
  if (pack === "shonen" || pack === "zenkai") return true;
  if (pack === "antagoniste" || pack === "protagoniste") return card.role === pack;
  return card.category === pack;
}

/** Live booster stock: +1 every 10 minutes, capped at 15 (mirrors the server). */
export function boosterStock(stored: number, updatedAt: string | Date, now: number) {
  const upd = new Date(updatedAt).getTime();
  const ticks = Math.floor(Math.max(0, now - upd) / STOCK_REGEN_MS);
  const count = Math.min(STOCK_CAP, stored + ticks);
  if (count >= STOCK_CAP) return { count: STOCK_CAP, nextInMs: null as number | null };
  return { count, nextInMs: upd + (ticks + 1) * STOCK_REGEN_MS - now };
}

/** Highest rarity among pulled cards. */
export function bestRarity(rarities: Rarity[]): Rarity | null {
  return rarities.reduce<Rarity | null>((a, r) => (a === null || rarityRank(r) < rarityRank(a) ? r : a), null);
}

/** "mm:ss" countdown label. */
export function formatCountdown(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
