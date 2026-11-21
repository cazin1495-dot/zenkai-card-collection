import { rarityRank, type PulledCard } from "./cards";

export function markNewBoosterCards(cards: PulledCard[], ownedIdsBeforeOpen: Iterable<string>): PulledCard[] {
  const knownIds = new Set(ownedIdsBeforeOpen);
  return cards.map((item) => {
    const isNew = !knownIds.has(item.card.id);
    knownIds.add(item.card.id);
    return { ...item, isNew };
  });
}

/** Sort the full reveal from least to most rare, preserving draw order for ties. */
export function sortBoosterCardsByRarity(cards: PulledCard[]): PulledCard[] {
  return [...cards].sort((left, right) => {
    const leftRarity = left.customTranscendance || left.transcended ? "transcendance" : left.card.rarity;
    const rightRarity = right.customTranscendance || right.transcended ? "transcendance" : right.card.rarity;
    return rarityRank(rightRarity) - rarityRank(leftRarity);
  });
}
