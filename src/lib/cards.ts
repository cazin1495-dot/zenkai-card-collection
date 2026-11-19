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

/** Rarities stored on cards. "transcendance" only exists as an evolved copy of a mythique card. */
export type BaseRarity = "commune" | "non_commune" | "rare" | "epique" | "legendaire" | "mythique";
export type Rarity = BaseRarity | "transcendance";

export type Genre = "shonen" | "seinen" | "shojo" | "sport";
export type CardRole = "protagoniste" | "antagoniste";

export type Card = {
  id: string;
  name: string;
  title: string;
  rarity: BaseRarity;
  description: string;
  sort_order: number;
  category?: Genre | null;
  series?: string | null;
  role?: CardRole | null;
  image_url?: string | null;
  quote?: string | null;
};

/** One owned copy coming out of a booster. */
export type PulledCard = { userCardId: string; card: Card };

/** Booster rules — mirror public.open_boosters(). */
export const CARDS_PER_BOOSTER = 5;
export const STOCK_CAP = 15;
export const STOCK_REGEN_MINUTES = 10;
export const STOCK_REGEN_MS = STOCK_REGEN_MINUTES * 60 * 1000;
export const OPEN_COUNTS = [1, 5, 10] as const;
/** Temporary test values; restore normal probabilities after testing. */
export const GOKU_TEST_DROP_PERCENT = 100;
export const TRANSCEND_CHANCE_PERCENT = 100;
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
  mythique: 2.7,
  legendaire: 3,
  epique: 10,
  rare: 27,
  non_commune: 10,
  commune: 47.3,
};

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

export type PackId = "shonen" | "seinen" | "shojo" | "sport" | "antagoniste" | "protagoniste";

export const PACKS: { id: PackId; label: string; hint: string; accent: string }[] = [
  { id: "shonen", label: "Shonen Mix", hint: "Dragon Ball, Naruto, Bleach", accent: "var(--pack-shonen)" },
  { id: "seinen", label: "Seinen", hint: "Berserk, Vinland Saga, Tokyo Ghoul, Monster", accent: "var(--pack-seinen)" },
  { id: "shojo", label: "Shojo", hint: "Fruits Basket, Nana, Sailor Moon, Sakura", accent: "var(--pack-shojo)" },
  { id: "sport", label: "Sport", hint: "Blue Lock, Haikyuu!!, Kuroko, Ippo", accent: "var(--pack-sport)" },
  { id: "antagoniste", label: "Antagoniste", hint: "Les méchants de toutes les sagas", accent: "var(--pack-antagoniste)" },
  { id: "protagoniste", label: "Protagoniste", hint: "Les héros principaux", accent: "var(--pack-protagoniste)" },
];

/** Does a card belong to a booster pack / collection filter? */
export function inPack(card: Card, pack: PackId) {
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
