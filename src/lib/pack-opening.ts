import type { Rarity } from "./cards";

/** Opening cues differ from the card frame palette for common and rare packs. */
export function packSealToken(rarity?: Rarity | null) {
  if (!rarity || rarity === "commune" || rarity === "rare") return "var(--flash)";
  return `var(--rarity-${rarity})`;
}