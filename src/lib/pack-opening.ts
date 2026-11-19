import type { Rarity } from "./cards";

/** Opening presentation is independent from database drop rules. */
export type OpeningRarity = Rarity;
const ORDER: OpeningRarity[] = ["commune", "non_commune", "rare", "epique", "legendaire", "mythique", "transcendance"];
export function bestOpeningRarity(rarities: OpeningRarity[]): OpeningRarity | null {
  return rarities.reduce<OpeningRarity | null>((best, rarity) => best === null || ORDER.indexOf(rarity) > ORDER.indexOf(best) ? rarity : best, null);
}
export function packSealToken(rarity?: OpeningRarity | null) {
  return `var(--opening-${rarity ?? "commune"})`;
}
export function openingEffects(rarity?: OpeningRarity | null) {
  return { sparks: rarity === "rare" ? 8 : rarity === "epique" ? 14 : rarity === "mythique" ? 30 : 0, rays: rarity === "legendaire" ? 7 : 0, jackpot: rarity === "mythique", suspense: rarity === "epique" || rarity === "legendaire" || rarity === "mythique" };
}