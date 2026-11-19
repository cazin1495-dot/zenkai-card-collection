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

export type Rarity = "commune" | "rare" | "epique" | "legendaire";

export type Card = {
  id: string;
  name: string;
  title: string;
  rarity: Rarity;
  description: string;
  sort_order: number;
};

/** Minutes a player waits between two free boosters. Mirrors public.open_booster(). */
export const BOOSTER_COOLDOWN_MINUTES = 10;
export const BOOSTER_COOLDOWN_MS = BOOSTER_COOLDOWN_MINUTES * 60 * 1000;
export const CARDS_PER_BOOSTER = 3;

export const CARD_ART: Record<string, string> = {
  riku,
  mei,
  taro,
  hana,
  kaito,
  yuki,
  sora,
  akira,
  lyra,
  ryujin,
};

export const RARITY_ORDER: Rarity[] = ["legendaire", "epique", "rare", "commune"];

export const RARITY: Record<
  Rarity,
  { label: string; text: string; border: string; glow: string; bg: string }
> = {
  commune: {
    label: "Commune",
    text: "text-rarity-commune",
    border: "border-rarity-commune",
    glow: "glow-commune",
    bg: "bg-rarity-commune",
  },
  rare: {
    label: "Rare",
    text: "text-rarity-rare",
    border: "border-rarity-rare",
    glow: "glow-rare",
    bg: "bg-rarity-rare",
  },
  epique: {
    label: "Épique",
    text: "text-rarity-epique",
    border: "border-rarity-epique",
    glow: "glow-epique",
    bg: "bg-rarity-epique",
  },
  legendaire: {
    label: "Légendaire",
    text: "text-rarity-legendaire",
    border: "border-rarity-legendaire",
    glow: "glow-legendaire",
    bg: "bg-rarity-legendaire",
  },
};

/** When the next free booster unlocks, given the last opening time. */
export function nextBoosterAt(lastOpenedAt: string | Date | null | undefined): Date | null {
  if (!lastOpenedAt) return null;
  return new Date(new Date(lastOpenedAt).getTime() + BOOSTER_COOLDOWN_MS);
}

/** Milliseconds left before the next free booster (0 when available). */
export function cooldownRemaining(lastOpenedAt: string | Date | null | undefined, now: number) {
  const next = nextBoosterAt(lastOpenedAt);
  if (!next) return 0;
  return Math.max(0, next.getTime() - now);
}

/** "mm:ss" countdown label. */
export function formatCountdown(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
