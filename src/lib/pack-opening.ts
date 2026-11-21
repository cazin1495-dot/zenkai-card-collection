import type { Rarity } from "./cards";

/** Opening presentation is independent from database drop rules. */
export type OpeningRarity = Rarity;
const ORDER: OpeningRarity[] = ["commune", "non_commune", "rare", "epique", "legendaire", "mythique", "transcendance"];

export type RarityGlowEffect = "none" | "neutral" | "soft" | "pulse" | "double" | "holographic";
export type RarityParticleTone = "none" | "gold" | "light";

type RarityGlowConfig = {
  color: string;
  effect: RarityGlowEffect;
  flash: boolean;
  particles: number;
  particleTone: RarityParticleTone;
  shake: boolean;
};

export const RARITY_GLOW_CONFIG: Record<OpeningRarity, RarityGlowConfig> = {
  commune: {
    color: "transparent",
    effect: "none",
    flash: false,
    particles: 0,
    particleTone: "none",
    shake: false,
  },
  non_commune: {
    color: "#94a3b8",
    effect: "neutral",
    flash: false,
    particles: 0,
    particleTone: "none",
    shake: false,
  },
  rare: {
    color: "#3b82f6",
    effect: "soft",
    flash: false,
    particles: 0,
    particleTone: "none",
    shake: false,
  },
  epique: {
    color: "#a855f7",
    effect: "pulse",
    flash: true,
    particles: 0,
    particleTone: "none",
    shake: false,
  },
  legendaire: {
    color: "#f59e0b",
    effect: "double",
    flash: true,
    particles: 6,
    particleTone: "gold",
    shake: false,
  },
  mythique: {
    color: "#ef4444",
    effect: "holographic",
    flash: true,
    particles: 8,
    particleTone: "light",
    shake: true,
  },
  transcendance: {
    color: "#e2e8f0",
    effect: "holographic",
    flash: true,
    particles: 16,
    particleTone: "light",
    shake: true,
  },
};

export function normalizeOpeningRarity(value?: string | null): OpeningRarity {
  const key = (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s_-]/g, "");
  const aliases: Record<string, OpeningRarity> = {
    commun: "commune", commune: "commune", common: "commune",
    peucommun: "non_commune", peucommune: "non_commune", noncommun: "non_commune", noncommune: "non_commune", uncommon: "non_commune",
    rare: "rare", epique: "epique", epic: "epique", legendaire: "legendaire", legendary: "legendaire", mythique: "mythique", mythic: "mythique", transcendance: "transcendance", transcendence: "transcendance",
  };
  return aliases[key] ?? "commune";
}
export function bestOpeningRarity(rarities: string[]): OpeningRarity | null {
  return rarities.map(normalizeOpeningRarity).reduce<OpeningRarity | null>((best, rarity) => best === null || ORDER.indexOf(rarity) > ORDER.indexOf(best) ? rarity : best, null);
}
export function packSealToken(rarity?: string | null) {
  return `var(--opening-${normalizeOpeningRarity(rarity)})`;
}
export function openingEffects(value?: string | null) {
  const rarity = normalizeOpeningRarity(value);
  return { sparks: rarity === "rare" ? 8 : rarity === "epique" ? 14 : rarity === "mythique" || rarity === "transcendance" ? 30 : 0, rays: rarity === "legendaire" ? 7 : 0, jackpot: rarity === "mythique" || rarity === "transcendance", suspense: rarity === "epique" || rarity === "legendaire" || rarity === "mythique" || rarity === "transcendance" };
}