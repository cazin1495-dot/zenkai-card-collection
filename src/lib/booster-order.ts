import { CARDS_PER_BOOSTER, type Rarity, type PulledCard } from "./cards";

const RARITY_WEIGHT: Record<Rarity, number> = {
  commune: 1,
  non_commune: 2,
  rare: 3,
  epique: 4,
  legendaire: 5,
  mythique: 6,
  transcendance: 7,
};

/** Sort cards from each booster independently, preserving the original order for ties. */
export function sortBoosterCardsByRarity(cards: PulledCard[]): PulledCard[] {
  const sorted: PulledCard[] = [];
  for (let start = 0; start < cards.length; start += CARDS_PER_BOOSTER) {
    sorted.push(
      ...cards.slice(start, start + CARDS_PER_BOOSTER).sort((left, right) => {
        const leftRarity = left.customTranscendance || left.transcended ? "transcendance" : left.card.rarity;
        const rightRarity = right.customTranscendance || right.transcended ? "transcendance" : right.card.rarity;
        return RARITY_WEIGHT[leftRarity] - RARITY_WEIGHT[rightRarity];
      }),
    );
  }
  return sorted;
}
