import type { Rarity } from "./cards";

/** Opening presentation is independent from database drop rules. */
export type OpeningRarity = Rarity;
const ORDER: OpeningRarity[] = ["commune", "non_commune", "rare", "epique", "legendaire", "mythique", "transcendance"];
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